"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { challengeByKey } from "@/lib/hackathon";
import { sendResendEmail } from "@/lib/email/resend";
import { hackathonJudgeAppointedEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";
import { runArenaDigest } from "@/lib/arena-digest";

const BUCKET = "hackathon";

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
  await admin.from("hackathon_registrations").update({ partner_profile_id: null, partner_confirmed_at: null }).eq("partner_profile_id", profileId);
  const { error } = await admin.from("hackathon_registrations").delete().eq("profile_id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon");
  return {};
}

/**
 * Appoint a mentor as a hackathon judge, or remove her (the owner, 16/10:
 * "מסך השופטות יופיע גם למשתתפות מנטוריות שאחליט לתת להן לעזור"). An
 * appointment mails her the link; her scores stay when she is removed.
 */
export async function setHackathonJudge(profileId: string, on: boolean): Promise<{ error?: string }> {
  const me = await requireRole("admin");
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("id, role, status, first_name, full_name").eq("id", profileId).maybeSingle();
  if (!p || p.role !== "mentor" || p.status !== "active") return { error: "רק מנטורית פעילה יכולה לשפוט." };
  if (!on) {
    await admin.from("hackathon_judges").delete().eq("profile_id", profileId);
  } else {
    const { error } = await admin.from("hackathon_judges").upsert({ profile_id: profileId, added_by: me.id }, { onConflict: "profile_id" });
    if (error) return { error: "המינוי נכשל. נסי שוב." };
    const { data: rows } = await admin.rpc("member_emails", { p_ids: [profileId] });
    const email = ((rows ?? []) as { id: string; email: string | null }[])[0]?.email;
    if (email) {
      const mail = hackathonJudgeAppointedEmail(p.first_name ?? p.full_name?.split(" ")[0], `${getSiteUrl()}/judge`);
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  }
  revalidatePath("/admin/hackathon");
  revalidatePath("/judge");
  return {};
}

/** The team pushes the open arena questions to every available mentor right now (16/10). */
export async function pushArenaToMentors(): Promise<{ error?: string; info?: string }> {
  await requireRole("admin");
  const r = await runArenaDigest({ everyone: true });
  if (r.open === 0) return { info: "אין שאלות פתוחות לדחוף." };
  return { info: `נשלח ל-${r.sent} מנטוריות${r.skipped ? ` · ${r.skipped} נחסמו (מגן סטייג'ינג)` : ""}${r.failed ? ` · ${r.failed} נכשלו` : ""}` };
}
