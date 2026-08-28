"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CvLanguage } from "@/types/database";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const LANGS: CvLanguage[] = ["he", "en", "job"];

export type CvDocState = { error?: string; ok?: boolean };

/**
 * Postgres "column does not exist" — cv_documents.is_default arrives with
 * supabase/_cv_default.sql, and the CV screen must keep working before it runs.
 */
function isMissingDefaultColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /is_default|column/i.test(error.message ?? "");
}

/** Upload a CV document (he / en / job-specific) to the private 'cvs' bucket. */
export async function uploadCv(_prev: CvDocState, formData: FormData): Promise<CvDocState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "צריך להתחבר מחדש." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "בחרי קובץ להעלאה." };
  if (file.size > MAX_BYTES) return { error: "הקובץ גדול מדי — עד 10MB." };
  // Server-side type check — the client `accept` attribute is only a hint.
  const okType =
    /\.(pdf|docx?)$/i.test(file.name) ||
    ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);
  if (!okType) return { error: "אפשר להעלות רק PDF או Word (doc/docx)." };

  const langRaw = String(formData.get("language") ?? "he");
  const language: CvLanguage = (LANGS as string[]).includes(langRaw)
    ? (langRaw as CvLanguage)
    : "he";
  const label = String(formData.get("label") ?? "").trim() || file.name;

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("cvs")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: "ההעלאה נכשלה. נסי שוב." };

  const row = {
    profile_id: user.id,
    label,
    language,
    file_path: path,
    file_name: file.name,
  };

  // Her very first document becomes the default — otherwise she'd have a CV
  // nothing is allowed to attach. A job-tailored upload never steals the flag.
  const { count } = await supabase
    .from("cv_documents")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);
  const first = (count ?? 0) === 0;

  let { error } = await supabase.from("cv_documents").insert({ ...row, is_default: first });
  if (error && isMissingDefaultColumn(error)) {
    ({ error } = await supabase.from("cv_documents").insert(row));
  }
  if (error) return { error: "הקובץ הועלה אבל לא נשמר. נסי שוב." };

  revalidatePath("/cv");
  revalidatePath("/jobs");
  return { ok: true };
}

/**
 * Mark one of her documents as the default — the CV every application attaches
 * unless she picked another. Cleared then set (two statements, not one
 * transaction) so the partial unique index can never be violated; if the second
 * write is lost she simply has no default, which every reader tolerates by
 * falling back to her newest file.
 */
export async function setDefaultCv(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Only ever promote a document that is actually hers.
  const { data: doc } = await supabase
    .from("cv_documents")
    .select("id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!doc) return;

  await supabase
    .from("cv_documents")
    .update({ is_default: false })
    .eq("profile_id", user.id)
    .eq("is_default", true);
  await supabase
    .from("cv_documents")
    .update({ is_default: true })
    .eq("id", id)
    .eq("profile_id", user.id);

  revalidatePath("/cv");
  revalidatePath("/jobs");
}

/** Delete a CV document (storage object + row). Owner only. */
export async function deleteCv(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: doc, error: readErr } = await supabase
    .from("cv_documents")
    .select("file_path, is_default")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  let wasDefault = doc?.is_default === true;
  let filePath = doc?.file_path;
  if (isMissingDefaultColumn(readErr)) {
    wasDefault = false;
    const { data: plain } = await supabase
      .from("cv_documents")
      .select("file_path")
      .eq("id", id)
      .eq("profile_id", user.id)
      .maybeSingle();
    filePath = plain?.file_path;
  }
  // Not hers → nothing to delete. Without this (and the profile_id on the
  // delete) an admin, whose RLS reaches every row, could remove another
  // member's document by id.
  if (!filePath) return;
  await supabase.storage.from("cvs").remove([filePath]);
  await supabase.from("cv_documents").delete().eq("id", id).eq("profile_id", user.id);

  // Deleting the default must not leave her without one — the newest survivor
  // takes over, which is exactly what the apply flow would have fallen back to.
  if (wasDefault) {
    const { data: next } = await supabase
      .from("cv_documents")
      .select("id")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("cv_documents")
        .update({ is_default: true })
        .eq("id", next.id)
        .eq("profile_id", user.id);
    }
  }

  revalidatePath("/cv");
  revalidatePath("/jobs");
}
