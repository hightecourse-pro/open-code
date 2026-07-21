"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CvLanguage } from "@/types/database";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const LANGS: CvLanguage[] = ["he", "en", "job"];

export type CvDocState = { error?: string; ok?: boolean };

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

  const { error } = await supabase.from("cv_documents").insert({
    profile_id: user.id,
    label,
    language,
    file_path: path,
    file_name: file.name,
  });
  if (error) return { error: "הקובץ הועלה אבל לא נשמר. נסי שוב." };

  revalidatePath("/cv");
  return { ok: true };
}

/** Delete a CV document (storage object + row). Owner only. */
export async function deleteCv(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: doc } = await supabase
    .from("cv_documents")
    .select("file_path")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (doc) await supabase.storage.from("cvs").remove([doc.file_path]);
  await supabase.from("cv_documents").delete().eq("id", id);
  revalidatePath("/cv");
}
