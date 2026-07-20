// The community's own pool of Google API keys, used by the employer portal's
// free-text search. Members bring their own key for their own tools; this
// pool is admin-managed, rotates when a key runs out, and records daily usage
// so the admin screen can show what each key is doing.

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "./crypto";
import { InvalidKeyError, QuotaError } from "./gemini";

export interface SystemKeyView {
  id: string;
  label: string | null;
  key_last4: string | null;
  status: string;
  last_error: string | null;
  created_at: string;
  last_used_at: string | null;
  /** Usage for the last N days, newest first. */
  usage: { day: string; calls: number; errors: number }[];
}

export async function addSystemKey(rawKey: string, label?: string): Promise<{ error?: string }> {
  const key = rawKey.trim();
  if (key.length < 20 || /\s/.test(key)) {
    return { error: "המפתח נראה קצר מדי או מכיל רווחים." };
  }
  const { error } = await createAdminClient().from("system_ai_keys").insert({
    label: label?.trim() || null,
    key_cipher: encryptSecret(key),
    key_last4: key.slice(-4),
    status: "active",
  });
  if (error) return { error: "לא הצלחנו לשמור את המפתח." };
  return {};
}

export async function deleteSystemKey(id: string): Promise<void> {
  await createAdminClient().from("system_ai_keys").delete().eq("id", id);
}

/** Put an exhausted/invalid key back in rotation (quotas reset daily). */
export async function reviveSystemKey(id: string): Promise<void> {
  await createAdminClient()
    .from("system_ai_keys")
    .update({ status: "active", last_error: null })
    .eq("id", id);
}

/** Keys with their recent daily usage, for the admin screen. */
export async function listSystemKeys(days = 7): Promise<SystemKeyView[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [{ data: keys }, { data: usage }] = await Promise.all([
    admin
      .from("system_ai_keys")
      .select("id, label, key_last4, status, last_error, created_at, last_used_at")
      .order("created_at", { ascending: true }),
    admin
      .from("system_ai_key_usage")
      .select("key_id, day, calls, errors")
      .gte("day", since)
      .order("day", { ascending: false }),
  ]);

  const byKey = new Map<string, { day: string; calls: number; errors: number }[]>();
  for (const u of usage ?? []) {
    const arr = byKey.get(u.key_id) ?? [];
    arr.push({ day: u.day, calls: u.calls, errors: u.errors });
    byKey.set(u.key_id, arr);
  }

  return (keys ?? []).map((k) => ({ ...k, usage: byKey.get(k.id) ?? [] }));
}

export type PoolResult<T> = { ok: true; data: T } | { ok: false; reason: "no_key" | "exhausted" | "error" };

/**
 * Run a Gemini call on the pool: try each active key in turn, stepping over
 * any that has run out, and record what happened. Exhausted keys are flagged
 * so the admin can see it — and revived automatically on their next success.
 */
export async function withPoolKey<T>(run: (apiKey: string) => Promise<T>): Promise<PoolResult<T>> {
  const admin = createAdminClient();
  const { data: keys } = await admin
    .from("system_ai_keys")
    .select("id, key_cipher")
    .eq("status", "active")
    .order("last_used_at", { ascending: true, nullsFirst: true });

  if (!keys?.length) return { ok: false, reason: "no_key" };

  let sawQuota = false;
  for (const k of keys) {
    let apiKey: string;
    try {
      apiKey = decryptSecret(k.key_cipher);
    } catch {
      continue;
    }

    try {
      const data = await run(apiKey);
      await Promise.all([
        admin.from("system_ai_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id),
        admin.rpc("bump_ai_key_usage", { p_key: k.id, p_error: false }),
      ]);
      return { ok: true, data };
    } catch (e) {
      await admin.rpc("bump_ai_key_usage", { p_key: k.id, p_error: true });
      if (e instanceof QuotaError) {
        sawQuota = true;
        await admin
          .from("system_ai_keys")
          .update({ status: "exhausted", last_error: "המכסה נגמרה" })
          .eq("id", k.id);
        continue; // try the next key in the pool
      }
      if (e instanceof InvalidKeyError) {
        await admin
          .from("system_ai_keys")
          .update({ status: "invalid", last_error: "מפתח לא תקין" })
          .eq("id", k.id);
        continue;
      }
      console.error("[system key] call failed:", e);
      return { ok: false, reason: "error" };
    }
  }

  return { ok: false, reason: sawQuota ? "exhausted" : "error" };
}
