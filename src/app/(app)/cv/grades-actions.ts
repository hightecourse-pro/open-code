"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const OK_NAME = /\.(pdf|docx?|jpe?g|png)$/i;

export type GradeSheetState = { error?: string; ok?: boolean };

/**
 * Grade sheets (the owner, 19/9): a transcript she may attach - optional in
 * the questionnaire, manageable here. Same private bucket as the CVs, own
 * folder, own table so no CV reader ever mistakes it for a CV.
 */
export async function uploadGradeSheet(_prev: GradeSheetState, formData: FormData): Promise<GradeSheetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "צריך להתחבר מחדש." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "בחרי קובץ להעלאה." };
  if (file.size > MAX_BYTES) return { error: "הקובץ גדול מדי - עד 10MB." };
  if (!OK_NAME.test(file.name)) return { error: "אפשר להעלות PDF, Word או תמונה (JPG/PNG)." };
  const label = String(formData.get("label") ?? "").trim() || "גליון ציונים";

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${user.id}/grades/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("cvs")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: "ההעלאה נכשלה. נסי שוב." };

  const { error } = await supabase
    .from("grade_sheets")
    .insert({ profile_id: user.id, label, file_path: path, file_name: file.name });
  if (error) return { error: "הקובץ עלה אבל לא נשמר. נסי שוב." };

  revalidatePath("/cv");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGradeSheet(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: row } = await supabase
    .from("grade_sheets")
    .select("id, file_path")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!row) return;
  await supabase.storage.from("cvs").remove([row.file_path]);
  await supabase.from("grade_sheets").delete().eq("id", row.id);
  revalidatePath("/cv");
  revalidatePath("/", "layout");
}
