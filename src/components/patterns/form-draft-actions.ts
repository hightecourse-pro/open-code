"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/*
  The server copy of a form draft (the member Shoshana Ben-Haim, 14.11: the
  draft followed her only on the same computer; the owner, 19.11: ״תבנה״).
  Her rows only (RLS); the browser keeps its localStorage copy as before and
  the newer of the two wins when the form opens.
*/
const KEY_RE = /^draft:[a-z0-9:_-]{1,80}$/i;

export interface RemoteDraft {
  data: Record<string, unknown>;
  /** ms since epoch - when the snapshot was taken (the browser's clock, as in localStorage) */
  t: number;
}

export async function loadFormDraft(key: string): Promise<RemoteDraft | null> {
  if (typeof key !== "string" || !KEY_RE.test(key)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("form_drafts").select("data").eq("profile_id", user.id).eq("key", key).maybeSingle();
  const d = data?.data as { t?: unknown } | null;
  if (!d || typeof d !== "object") return null;
  return { data: d as Record<string, unknown>, t: typeof d.t === "number" ? d.t : 0 };
}

export async function saveFormDraft(key: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  if (typeof key !== "string" || !KEY_RE.test(key) || !data || typeof data !== "object") return { ok: false };
  // a draft is small; anything past 200KB is not a form any more
  if (JSON.stringify(data).length > 200_000) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("form_drafts").upsert({ profile_id: user.id, key, data: data as Json, updated_at: new Date().toISOString() }, { onConflict: "profile_id,key" });
  return { ok: !error };
}

export async function deleteFormDraft(key: string): Promise<{ ok: boolean }> {
  if (typeof key !== "string" || !KEY_RE.test(key)) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("form_drafts").delete().eq("profile_id", user.id).eq("key", key);
  return { ok: !error };
}
