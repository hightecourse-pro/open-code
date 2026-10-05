"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { challengeByKey } from "@/lib/hackathon";

const BUCKET = "attachments";

/**
 * Step 1 of a material upload: a signed upload slot in the private bucket.
 * The browser PUTs the file straight to storage (Vercel caps a request body at
 * ~4.5 MB; the sample PDFs are 13 MB), then calls finalizeHackathonMaterial.
 */
export async function createHackathonMaterialUpload(
  challengeKey: string,
  fileName: string
): Promise<{ token?: string; path?: string; error?: string }> {
  await requireRole("admin");
  if (!challengeByKey(challengeKey)) return { error: "אתגר לא מוכר." };
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
  const path = `hackathon/${challengeKey}/${Date.now()}-${safe}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "לא הצלחנו לפתוח העלאה. נסי שוב." };
  return { token: data.token, path: data.path };
}

export async function finalizeHackathonMaterial(input: {
  challengeKey: string;
  title: string;
  path: string;
  sizeBytes: number;
}): Promise<{ error?: string }> {
  await requireRole("admin");
  const title = input.title.trim();
  if (!title) return { error: "צריך שם לקובץ." };
  if (!input.path.startsWith(`hackathon/${input.challengeKey}/`)) return { error: "נתיב לא תקין." };
  const admin = createAdminClient();
  // The object must actually be there before we list it.
  const { data: head } = await admin.storage.from(BUCKET).list(`hackathon/${input.challengeKey}`, { search: input.path.split("/").pop() });
  if (!head?.length) return { error: "הקובץ לא הגיע לאחסון. נסי להעלות שוב." };
  const { error } = await admin
    .from("hackathon_materials")
    .insert({ challenge_key: input.challengeKey, title, file_path: input.path, size_bytes: input.sizeBytes });
  if (error) return { error: error.message };
  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon");
  revalidatePath(`/hackathon/${input.challengeKey}`);
  return {};
}

export async function deleteHackathonMaterial(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: m } = await admin.from("hackathon_materials").select("file_path, challenge_key").eq("id", id).maybeSingle();
  if (!m) return {};
  await admin.storage.from(BUCKET).remove([m.file_path]);
  const { error } = await admin.from("hackathon_materials").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/hackathon");
  revalidatePath(`/hackathon/${m.challenge_key}`);
  return {};
}

/** Team removes a registration (a member who left, a duplicate). */
export async function adminRemoveHackathonRegistration(profileId: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("hackathon_registrations").update({ partner_profile_id: null }).eq("partner_profile_id", profileId);
  const { error } = await admin.from("hackathon_registrations").delete().eq("profile_id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon");
  return {};
}
