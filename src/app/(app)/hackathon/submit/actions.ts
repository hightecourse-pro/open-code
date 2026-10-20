"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { hackathonSubmissionReceivedEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";
import { sanitizeRichHtml } from "@/lib/rich-text";
import { checklistOf, loadReflections, loadSubmission, loadTeam, VIDEO_EXTENSIONS, VIDEO_MAX_BYTES } from "@/lib/hackathon-submission";

export interface SubmitState {
  ok?: boolean;
  error?: string;
  info?: string;
}

const BUCKET = "hackathon";

function cleanUrl(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? "").trim().slice(0, 500);
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return "invalid";
    return u.toString();
  } catch {
    return "invalid";
  }
}

/** A rich-text field: the editor's HTML, sanitized to the brand allowlist; empty → null. */
function rich(raw: FormDataEntryValue | null, max: number): string | null {
  const v = sanitizeRichHtml(String(raw ?? "").slice(0, max));
  return v || null;
}

async function myTeamOrError() {
  const me = await requireCommunityAccess();
  const team = await loadTeam(me.id);
  if (!team) return { me, team: null, error: "ההגשה פתוחה לרשומות להאקתון." as string };
  return { me, team, error: null };
}

/** The shared part - the product, the repo, the architecture, the video link, the tools. Either partner may save it. */
export async function saveSubmission(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const { me, team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const productUrl = cleanUrl(formData.get("product_url"));
  const repoUrl = cleanUrl(formData.get("repo_url"));
  const videoUrl = cleanUrl(formData.get("video_url"));
  if (productUrl === "invalid") return { error: "הקישור למוצר לא נראה כמו כתובת אינטרנט." };
  if (repoUrl === "invalid") return { error: "הקישור לספריית הגיט לא נראה כמו כתובת אינטרנט." };
  if (videoUrl === "invalid") return { error: "הקישור לסרטון לא נראה כמו כתובת אינטרנט." };
  const admin = createAdminClient();
  const { error: dbErr } = await admin.from("hackathon_submissions").upsert(
    {
      team_key: team.teamKey,
      challenge_key: team.challengeKey,
      product_url: productUrl,
      repo_url: repoUrl,
      architecture: rich(formData.get("architecture"), 30000),
      challenges_solved: rich(formData.get("challenges_solved"), 30000),
      original_feature: rich(formData.get("original_feature"), 12000),
      video_url: videoUrl,
      ai_dev_tools: rich(formData.get("ai_dev_tools"), 12000),
      ai_models: rich(formData.get("ai_models"), 12000),
      created_by: me.id,
    },
    { onConflict: "team_key" }
  );
  if (dbErr) return { error: "השמירה נכשלה. נסי שוב." };
  revalidatePath("/hackathon/submit");
  return { ok: true, info: "נשמר ✓" };
}

/** Only the video link - the rest of the shared record stays as it is. */
export async function saveVideoUrl(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const { me, team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const videoUrl = cleanUrl(formData.get("video_url"));
  if (videoUrl === "invalid") return { error: "הקישור לסרטון לא נראה כמו כתובת אינטרנט." };
  const admin = createAdminClient();
  const current = await loadSubmission(team.teamKey);
  const { error: dbErr } = await admin.from("hackathon_submissions").upsert(
    { team_key: team.teamKey, challenge_key: team.challengeKey, video_url: videoUrl, created_by: current?.createdBy ?? me.id },
    { onConflict: "team_key" }
  );
  if (dbErr) return { error: "השמירה נכשלה. נסי שוב." };
  revalidatePath("/hackathon/submit");
  return { ok: true, info: videoUrl ? "הקישור נשמר ✓" : "הקישור הוסר" };
}

/** The personal part - hers alone, whatever her partner wrote. */
export async function saveReflection(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const { me, team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const { error: dbErr } = await createAdminClient().from("hackathon_reflections").upsert(
    {
      profile_id: me.id,
      team_key: team.teamKey,
      contributed: rich(formData.get("contributed"), 12000),
      learned: rich(formData.get("learned"), 12000),
      enjoyed: rich(formData.get("enjoyed"), 12000),
    },
    { onConflict: "profile_id" }
  );
  if (dbErr) return { error: "השמירה נכשלה. נסי שוב." };
  revalidatePath("/hackathon/submit");
  return { ok: true, info: "נשמר ✓" };
}

/** Step 1 of a video upload: a signed slot in the private bucket (the browser PUTs the file straight to storage). */
export async function createVideoUpload(fileName: string, size: number): Promise<{ token?: string; path?: string; error?: string }> {
  const { team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(ext)) return { error: `קובץ וידאו בלבד (${VIDEO_EXTENSIONS.join(" / ")}).` };
  if (size > VIDEO_MAX_BYTES) return { error: "הסרטון גדול מ-50MB. אפשר לכווץ, או להעלות ליוטיוב / דרייב ולהדביק קישור." };
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || `video.${ext}`;
  const path = `submissions/${team.teamKey}/${Date.now()}-${safe}`;
  const { data, error: upErr } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (upErr || !data) return { error: "לא הצלחנו לפתוח העלאה. נסי שוב." };
  return { token: data.token, path: data.path };
}

/** Step 2: the file is in storage - remember it on the team's submission (replacing a previous upload). */
export async function finalizeVideo(path: string, size: number): Promise<SubmitState> {
  const { me, team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  if (!path.startsWith(`submissions/${team.teamKey}/`)) return { error: "נתיב לא תקין." };
  const admin = createAdminClient();
  const { data: head } = await admin.storage.from(BUCKET).list(`submissions/${team.teamKey}`, { search: path.split("/").pop() });
  if (!head?.length) return { error: "הקובץ לא הגיע לאחסון. נסי להעלות שוב." };
  const current = await loadSubmission(team.teamKey);
  if (current?.videoPath && current.videoPath !== path) await admin.storage.from(BUCKET).remove([current.videoPath]);
  const { error: dbErr } = await admin.from("hackathon_submissions").upsert(
    { team_key: team.teamKey, challenge_key: team.challengeKey, video_path: path, video_size: size, created_by: current?.createdBy ?? me.id },
    { onConflict: "team_key" }
  );
  if (dbErr) return { error: "השמירה נכשלה. נסי שוב." };
  revalidatePath("/hackathon/submit");
  return { ok: true, info: "הסרטון הועלה ✓" };
}

export async function removeVideo(): Promise<SubmitState> {
  const { team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const admin = createAdminClient();
  const current = await loadSubmission(team.teamKey);
  if (current?.videoPath) await admin.storage.from(BUCKET).remove([current.videoPath]);
  if (current) await admin.from("hackathon_submissions").update({ video_path: null, video_size: null }).eq("team_key", team.teamKey);
  revalidatePath("/hackathon/submit");
  return { ok: true };
}

/** The final submission: everything required is there - stamp it and tell the whole team. Edits stay open afterwards. */
export async function submitFinal(): Promise<SubmitState> {
  const { me, team, error } = await myTeamOrError();
  if (!team) return { error: error ?? "" };
  const [sub, reflections] = await Promise.all([loadSubmission(team.teamKey), loadReflections([me.id])]);
  const c = checklistOf(sub, reflections.get(me.id) ?? null);
  const missing: string[] = [];
  if (!c.product) missing.push("קישור למוצר עובד");
  if (!c.repo) missing.push("ספריית גיט ציבורית");
  if (!c.architecture) missing.push("הסבר על הארכיטקטורה");
  if (!c.challenges) missing.push("בעיות משמעותיות ואיך פתרת אותן");
  if (!c.video) missing.push("סרטון (קובץ או קישור)");
  if (!c.tools) missing.push("כלי ה-AI לפיתוח");
  if (!c.models) missing.push("מודלי ה-AI של האיג׳נט");
  if (!c.reflection) missing.push("שלוש השאלות האישיות שלך");
  if (missing.length) return { error: `עוד חסר: ${missing.join(" · ")}` };
  const admin = createAdminClient();
  const first = !sub!.submittedAt;
  if (first) await admin.from("hackathon_submissions").update({ submitted_at: new Date().toISOString() }).eq("team_key", team.teamKey);
  if (first) {
    const ids = team.members.map((m) => m.id);
    const [{ data: rows }, { data: profs }] = await Promise.all([
      admin.rpc("member_emails", { p_ids: ids }),
      admin.from("profiles").select("id, first_name, full_name").in("id", ids),
    ]);
    const emailOf = new Map(((rows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email]));
    const names = team.members.map((m) => m.name).join(" ו-");
    for (const p of profs ?? []) {
      const email = emailOf.get(p.id);
      if (!email) continue;
      const mail = hackathonSubmissionReceivedEmail(p.first_name ?? p.full_name?.split(" ")[0], team.challenge?.short ?? team.challengeKey, names, `${getSiteUrl()}/hackathon/submit`);
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  }
  revalidatePath("/hackathon/submit");
  revalidatePath("/admin/hackathon");
  return { ok: true, info: first ? "ההגשה נקלטה 🎉" : "ההגשה עודכנה ✓" };
}
