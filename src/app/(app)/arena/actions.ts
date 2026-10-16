"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { arenaRoleFor, loadArenaMentors, pickRandomMentor } from "@/lib/arena";
import { ARENA_ANSWER_POINTS, ARENA_HELPFUL_POINTS, ARENA_TOPICS, NUDGE_AFTER_HOURS, PRESENCE_HOURS } from "@/lib/arena-shared";
import { sendResendEmail } from "@/lib/email/resend";
import { arenaAnsweredEmail, arenaFollowUpEmail, arenaHelpfulEmail, arenaNudgeEmail, arenaQuestionEmail } from "@/lib/email/templates";
import { sanitizeArenaHtml } from "@/lib/rich-text";
import { getSiteUrl } from "@/lib/site";

export interface ArenaFormState {
  ok?: boolean;
  error?: string;
  info?: string;
}

async function contact(profileId: string): Promise<{ first: string | undefined; email: string | null }> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: prof }] = await Promise.all([
    admin.rpc("member_emails", { p_ids: [profileId] }),
    admin.from("profiles").select("first_name, full_name").eq("id", profileId).maybeSingle(),
  ]);
  const email = ((rows ?? []) as { id: string; email: string | null }[])[0]?.email ?? null;
  return { first: prof?.first_name ?? prof?.full_name?.split(" ")[0] ?? undefined, email };
}

async function contacts(ids: string[]): Promise<Map<string, { first: string | undefined; email: string | null }>> {
  const out = new Map<string, { first: string | undefined; email: string | null }>();
  if (ids.length === 0) return out;
  const admin = createAdminClient();
  const [{ data: rows }, { data: profs }] = await Promise.all([
    admin.rpc("member_emails", { p_ids: ids }),
    admin.from("profiles").select("id, first_name, full_name").in("id", ids),
  ]);
  const emailOf = new Map(((rows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email]));
  for (const p of profs ?? []) out.set(p.id, { first: p.first_name ?? p.full_name?.split(" ")[0] ?? undefined, email: emailOf.get(p.id) ?? null });
  return out;
}

const questionUrl = (id: string) => `${getSiteUrl()}/arena?q=${id}`;

/**
 * A question into the arena: to a random mentor (present ones first), to a
 * random mentor who knows AI, or to a chosen one; with a topic, optionally
 * private (mentors, the team and she alone see it). Rich body - code and
 * screenshots embedded as data URIs, so nothing depends on a blocked host.
 */
export async function askArenaQuestion(_prev: ArenaFormState, formData: FormData): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (!role) return { error: "הזירה פתוחה לרשומות להאקתון ולמנטוריות." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const body = sanitizeArenaHtml(String(formData.get("body") ?? "").slice(0, 400000));
  const target = String(formData.get("target") ?? "random");
  const chosenId = String(formData.get("mentor_id") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const isPrivate = formData.get("is_private") === "on";
  if (title.length < 3) return { error: "כתבי כותרת קצרה לשאלה." };
  if (!body) return { error: "כתבי את השאלה עצמה." };
  if (topic && !ARENA_TOPICS.some((t) => t.key === topic)) return { error: "בחרי נושא מהרשימה." };

  const mentors = (await loadArenaMentors()).filter((m) => m.id !== me.id);
  let chosen = null as ReturnType<typeof pickRandomMentor>;
  let aiOnly = false;
  if (target === "random_ai") {
    aiOnly = true;
    chosen = pickRandomMentor(mentors, true);
  } else if (target === "pick") {
    chosen = mentors.find((m) => m.id === chosenId) ?? null;
    if (!chosen) return { error: "בחרי מנטורית מהרשימה." };
    aiOnly = chosen.ai;
  } else {
    chosen = pickRandomMentor(mentors, false);
  }

  const admin = createAdminClient();
  const { data: q, error } = await admin
    .from("arena_questions")
    .insert({ author_id: me.id, title, body, target_mentor_id: chosen?.id ?? null, ai_only: aiOnly, is_private: isPrivate, topic: topic || null })
    .select("id")
    .single();
  if (error || !q) return { error: "השאלה לא נשמרה. נסי שוב." };

  if (chosen) {
    const { first, email } = await contact(chosen.id);
    if (email) {
      const mail = arenaQuestionEmail(first, title, me.full_name, questionUrl(q.id));
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  }
  revalidatePath("/arena");
  const who = chosen ? `${chosen.name}${chosen.present ? " (כאן עכשיו 🟢)" : aiOnly ? " (מבינה ב-AI)" : ""}` : null;
  return {
    ok: true,
    info: who
      ? `השאלה פורסמה בזירה ונשלחה ל${who}. ${isPrivate ? "רק המנטוריות רואות אותה." : "כל המנטוריות רואות אותה,"} והתשובה תגיע גם למייל שלך.`
      : `השאלה פורסמה בזירה${isPrivate ? " (פרטית - רק למנטוריות)" : ""}. התשובה תגיע גם למייל שלך.`,
  };
}

/** A mentor's answer. Her first answer to a question earns the arena points; the asker hears by email. */
export async function answerArenaQuestion(questionId: string, _prev: ArenaFormState, formData: FormData): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (role !== "mentor" && role !== "admin") return { error: "רק מנטוריות עונות בזירה." };
  const body = sanitizeArenaHtml(String(formData.get("body") ?? "").slice(0, 400000));
  if (!body) return { error: "כתבי תשובה." };

  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id, title, status").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.status === "closed") return { error: "השאלה נסגרה." };
  if (q.author_id === me.id) return { error: "לא עונים לעצמנו 🙂" };

  const { count: before } = await admin.from("arena_answers").select("id", { count: "exact", head: true }).eq("question_id", q.id).eq("mentor_id", me.id).eq("author_role", "mentor");
  const { error } = await admin.from("arena_answers").insert({ question_id: q.id, mentor_id: me.id, author_role: "mentor", body });
  if (error) return { error: "התשובה לא נשמרה. נסי שוב." };
  if (q.status === "open") await admin.from("arena_questions").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", q.id);

  const { first, email } = await contact(q.author_id);
  if (email) {
    const mail = arenaAnsweredEmail(first, q.title, me.full_name, questionUrl(q.id));
    await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
  }
  revalidatePath("/arena");
  const firstAnswer = (before ?? 0) === 0;
  return { ok: true, info: role === "mentor" && firstAnswer ? `התשובה פורסמה · +${ARENA_ANSWER_POINTS} נק' 🎉` : "התשובה פורסמה." };
}

/** The asker continues the thread (the owner, 16/10): the question re-opens and the mentors who answered hear. */
export async function replyFollowUp(questionId: string, _prev: ArenaFormState, formData: FormData): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const body = sanitizeArenaHtml(String(formData.get("body") ?? "").slice(0, 400000));
  if (!body) return { error: "כתבי את שאלת ההמשך." };
  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id, title, status").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.author_id !== me.id) return { error: "רק מי ששאלה ממשיכה את השרשור." };
  const { error } = await admin.from("arena_answers").insert({ question_id: q.id, mentor_id: me.id, author_role: "asker", body });
  if (error) return { error: "לא נשמר. נסי שוב." };
  await admin.from("arena_questions").update({ status: "open", closed_at: null }).eq("id", q.id);
  const { data: answerers } = await admin.from("arena_answers").select("mentor_id").eq("question_id", q.id).eq("author_role", "mentor");
  const ids = [...new Set((answerers ?? []).map((a) => a.mentor_id))];
  const cs = await contacts(ids);
  for (const [, c] of cs) {
    if (!c.email) continue;
    const mail = arenaFollowUpEmail(c.first, q.title, me.full_name, questionUrl(q.id));
    await sendResendEmail({ to: c.email, subject: mail.subject, html: mail.html });
  }
  revalidatePath("/arena");
  return { ok: true, info: "שאלת ההמשך פורסמה - השאלה חזרה להיות פתוחה." };
}

/** "עזר לי ✓" (the owner, 16/10): the mentor earns the bonus, the question closes. */
export async function markHelpful(answerId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: a } = await admin.from("arena_answers").select("id, question_id, mentor_id, author_role, helpful_at").eq("id", answerId).maybeSingle();
  if (!a || a.author_role !== "mentor") return { error: "התשובה לא נמצאה." };
  const { data: q } = await admin.from("arena_questions").select("id, author_id, title").eq("id", a.question_id).maybeSingle();
  if (!q || q.author_id !== me.id) return { error: "רק מי ששאלה מסמנת מה עזר." };
  if (a.helpful_at) return { ok: true };
  const now = new Date().toISOString();
  await admin.from("arena_answers").update({ helpful_at: now }).eq("id", a.id);
  await admin.from("arena_questions").update({ status: "closed", closed_at: now }).eq("id", q.id);
  const { first, email } = await contact(a.mentor_id);
  if (email) {
    const mail = arenaHelpfulEmail(first, q.title, me.full_name, questionUrl(q.id));
    await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
  }
  revalidatePath("/arena");
  return { ok: true, info: `סימנת שהתשובה עזרה - המנטורית קיבלה +${ARENA_HELPFUL_POINTS} נק' והשאלה נסגרה.` };
}

/** A question open for more than a day: the asker pushes it to every available mentor, once a day. */
export async function nudgeQuestion(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id, title, status, created_at, nudged_at").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.author_id !== me.id && me.role !== "admin") return { error: "רק מי ששאלה יכולה לדחוף." };
  if (q.status !== "open") return { error: "השאלה כבר נענתה." };
  const dayMs = NUDGE_AFTER_HOURS * 3600 * 1000;
  if (Date.now() - new Date(q.created_at).getTime() < dayMs) return { error: `אפשר לדחוף אחרי ${NUDGE_AFTER_HOURS} שעות בלי תשובה.` };
  if (q.nudged_at && Date.now() - new Date(q.nudged_at).getTime() < dayMs) return { error: "כבר דחפת היום - המנטוריות קיבלו." };
  const mentors = (await loadArenaMentors()).filter((m) => m.available && m.id !== me.id);
  const cs = await contacts(mentors.map((m) => m.id));
  let sent = 0;
  let skipped = 0;
  for (const [, c] of cs) {
    if (!c.email) continue;
    const mail = arenaNudgeEmail(c.first, q.title, questionUrl(q.id));
    const r = await sendResendEmail({ to: c.email, subject: mail.subject, html: mail.html });
    if (r.ok) sent++;
    else if (r.error === "blocked_by_allowlist") skipped++;
  }
  await admin.from("arena_questions").update({ nudged_at: new Date().toISOString() }).eq("id", q.id);
  revalidatePath("/arena");
  return { ok: true, info: `דחפנו ל-${mentors.length} מנטוריות${skipped ? ` (${skipped} נחסמו במגן סטייג'ינג)` : ""}${sent ? "" : "."}` };
}

/** "⭐ שווה לקרוא" - a mentor or the team pins an answered question to the top of its challenge. */
export async function togglePin(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (role !== "mentor" && role !== "admin") return { error: "רק מנטוריות מצמידות." };
  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, pinned_at").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  await admin.from("arena_questions").update({ pinned_at: q.pinned_at ? null : new Date().toISOString() }).eq("id", q.id);
  revalidatePath("/arena");
  return { ok: true };
}

/** "אני כאן עכשיו": present for the next hour - random picks prefer her, participants see the count. */
export async function setPresence(on: boolean): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (role !== "mentor" && role !== "admin") return { error: "רק מנטוריות מסמנות נוכחות." };
  const admin = createAdminClient();
  if (on) {
    const until = new Date(Date.now() + PRESENCE_HOURS * 3600 * 1000).toISOString();
    await admin.from("arena_presence").upsert({ profile_id: me.id, until, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  } else {
    await admin.from("arena_presence").delete().eq("profile_id", me.id);
  }
  revalidatePath("/arena");
  return { ok: true };
}

/** The asker (or the team) closes a question that no longer needs answers. */
export async function closeArenaQuestion(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.author_id !== me.id && me.role !== "admin") return { error: "רק מי ששאלה יכולה לסגור." };
  await admin.from("arena_questions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", q.id);
  revalidatePath("/arena");
  return { ok: true };
}

/** Team moderation: the question and its thread disappear. */
export async function deleteArenaQuestion(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  if (me.role !== "admin") return { error: "רק הצוות מוחק שאלות." };
  await createAdminClient().from("arena_questions").delete().eq("id", questionId);
  revalidatePath("/arena");
  return { ok: true };
}
