import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "./crypto";
import { InvalidKeyError, QuotaError, verifyGeminiKey } from "./gemini";

export interface KeyView {
  id: string;
  label: string | null;
  key_last4: string | null;
  status: string;
  created_at: string;
  last_used_at: string | null;
}

/** Non-secret view of the member's keys, for the management UI. */
export async function listUserKeys(): Promise<KeyView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_ai_keys")
    .select("id, label, key_last4, status, created_at, last_used_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Decrypt and return the first usable key (server only — never sent to client). */
export async function getUsableKey(): Promise<{ id: string; apiKey: string } | null> {
  const supabase = await createClient();
  // Google quotas reset daily, so an "exhausted" key is worth retrying —
  // prefer active keys, but fall back to exhausted ones instead of failing.
  // ("active" sorts before "exhausted" alphabetically.)
  const { data } = await supabase
    .from("user_ai_keys")
    .select("id, key_cipher")
    .in("status", ["active", "exhausted"])
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  try {
    return { id: data.id, apiKey: decryptSecret(data.key_cipher) };
  } catch {
    return null;
  }
}

export async function hasUsableKey(): Promise<boolean> {
  return (await getUsableKey()) !== null;
}

export type AddKeyResult = { ok: true } | { ok: false; error: string };

export async function addUserKey(rawKey: string, label?: string): Promise<AddKeyResult> {
  const key = rawKey.trim();
  // Google keys are typically ~39 chars (often "AIza…"), but the format can
  // vary — so we just sanity-check the length and let Google's API be the
  // real validator via verifyGeminiKey below.
  if (key.length < 20 || /\s/.test(key)) {
    return { ok: false, error: "המפתח נראה קצר מדי או מכיל רווחים. העתיקי אותו שוב מ-Google AI Studio." };
  }

  const valid = await verifyGeminiKey(key);
  if (!valid) {
    return { ok: false, error: "המפתח לא עבר אימות מול Google. בדקי שהעתקת אותו במלואו." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "תצטרכי להתחבר מחדש." };

  const { error } = await supabase.from("user_ai_keys").insert({
    profile_id: user.id,
    provider: "google",
    label: label?.trim() || null,
    key_cipher: encryptSecret(key),
    key_last4: key.slice(-4),
    status: "active",
  });
  if (error) return { ok: false, error: "לא הצלחנו לשמור את המפתח. נסי שוב." };
  return { ok: true };
}

export async function deleteUserKey(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("user_ai_keys").delete().eq("id", id);
}

export async function markKeyStatus(id: string, status: string, lastError?: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("user_ai_keys").update({ status, last_error: lastError ?? null }).eq("id", id);
}

export type AiReason = "no_key" | "exhausted" | "invalid" | "error";
export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: AiReason };

/**
 * Run a Gemini call with the member's active key. On quota exhaustion or an
 * invalid key, the key is flagged and the reason returned so the UI can prompt
 * the member to add another key.
 */
export async function withUserKey<T>(run: (apiKey: string) => Promise<T>): Promise<AiResult<T>> {
  const key = await getUsableKey();
  if (!key) return { ok: false, reason: "no_key" };

  try {
    const data = await run(key.apiKey);
    const supabase = await createClient();
    // A successful call also revives a previously-exhausted key.
    await supabase
      .from("user_ai_keys")
      .update({ last_used_at: new Date().toISOString(), status: "active", last_error: null })
      .eq("id", key.id);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof QuotaError) {
      await markKeyStatus(key.id, "exhausted", "מכסת השימוש נגמרה");
      return { ok: false, reason: "exhausted" };
    }
    if (e instanceof InvalidKeyError) {
      await markKeyStatus(key.id, "invalid", "מפתח לא תקין");
      return { ok: false, reason: "invalid" };
    }
    return { ok: false, reason: "error" };
  }
}
