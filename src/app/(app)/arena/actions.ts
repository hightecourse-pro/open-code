"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { arenaRoleFor, loadArenaMentors, pickRandomMentor } from "@/lib/arena";
import { ARENA_ANSWER_POINTS } from "@/lib/arena-shared";
import { sendResendEmail } from "@/lib/email/resend";
import { arenaAnsweredEmail, arenaQuestionEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";

export interface ArenaFormState {
  ok?: boolean;
  error?: string;
  info?: string;
}

async function firstNameAndEmail(profileId: string): Promise<{ first: string | undefined; email: string | null }> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: prof }] = await Promise.all([
    admin.rpc("member_emails", { p_ids: [profileId] }),
    admin.from("profiles").select("first_name, full_name").eq("id", profileId).maybeSingle(),
  ]);
  const email = ((rows ?? []) as { id: string; email: string | null }[])[0]?.email ?? null;
  return { first: prof?.first_name ?? prof?.full_name?.split(" ")[0] ?? undefined, email };
}

/**
 * A question into the arena: to a random mentor, to a random mentor who
 * knows AI, or to a chosen one. The chosen mentor hears right away (email);
 * every mentor sees the question on the board; the daily digest covers the
 * rest.
 */
export async function askArenaQuestion(_prev: ArenaFormState, formData: FormData): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (!role) return { error: "הזירה פתוחה לרשומות להאקתון ולמנטוריות." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const target = String(formData.get("target") ?? "random");
  const chosenId = String(formData.get("mentor_id") ?? "").trim();
  if (title.length < 3) return { error: "כתבי כותרת קצרה לשאלה." };
  if (body.length < 3) return { error: "כתבי את השאלה עצמה." };

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
    .insert({ author_id: me.id, title, body, target_mentor_id: chosen?.id ?? null, ai_only: aiOnly })
    .select("id")
    .single();
  if (error || !q) return { error: "השאלה לא נשמרה. נסי שוב." };

  if (chosen) {
    const { first, email } = await firstNameAndEmail(chosen.id);
    if (email) {
      const mail = arenaQuestionEmail(first, title, me.full_name, `${getSiteUrl()}/arena?q=${q.id}`);
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  }
  revalidatePath("/arena");
  return {
    ok: true,
    info: chosen
      ? `השאלה פורסמה בזירה ונשלחה ל${chosen.name}${aiOnly ? " (מבינה ב-AI)" : ""}. כל המנטוריות רואות אותה, והתשובה תגיע גם למייל שלך.`
      : "השאלה פורסמה בזירה - כל המנטוריות רואות אותה, והתשובה תגיע גם למייל שלך.",
  };
}

/** A mentor's answer. Her first answer to a question earns the arena points; the asker hears by email. */
export async function answerArenaQuestion(questionId: string, _prev: ArenaFormState, formData: FormData): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const role = await arenaRoleFor(me);
  if (role !== "mentor" && role !== "admin") return { error: "רק מנטוריות עונות בזירה." };
  const body = String(formData.get("body") ?? "").trim().slice(0, 6000);
  if (!body) return { error: "כתבי תשובה." };

  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id, title, status").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.status === "closed") return { error: "השאלה נסגרה." };
  if (q.author_id === me.id) return { error: "לא עונים לעצמנו 🙂" };

  const { count: before } = await admin.from("arena_answers").select("id", { count: "exact", head: true }).eq("question_id", q.id).eq("mentor_id", me.id);
  const { error } = await admin.from("arena_answers").insert({ question_id: q.id, mentor_id: me.id, body });
  if (error) return { error: "התשובה לא נשמרה. נסי שוב." };
  if (q.status === "open") {
    await admin.from("arena_questions").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", q.id);
  }

  const { first, email } = await firstNameAndEmail(q.author_id);
  if (email) {
    const mail = arenaAnsweredEmail(first, q.title, me.full_name, `${getSiteUrl()}/arena?q=${q.id}`);
    await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
  }
  revalidatePath("/arena");
  const firstAnswer = (before ?? 0) === 0;
  return {
    ok: true,
    info: role === "mentor" && firstAnswer ? `התשובה פורסמה · +${ARENA_ANSWER_POINTS} נק' 🎉` : "התשובה פורסמה.",
  };
}

/** The asker (or the team) closes a question that no longer needs answers. */
export async function closeArenaQuestion(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: q } = await admin.from("arena_questions").select("id, author_id").eq("id", questionId).maybeSingle();
  if (!q) return { error: "השאלה לא נמצאה." };
  if (q.author_id !== me.id && me.role !== "admin") return { error: "רק מי ששאלה יכולה לסגור." };
  await admin.from("arena_questions").update({ status: "closed" }).eq("id", q.id);
  revalidatePath("/arena");
  return { ok: true };
}

/** Team moderation: the question and its answers disappear. */
export async function deleteArenaQuestion(questionId: string): Promise<ArenaFormState> {
  const me = await requireCommunityAccess();
  if (me.role !== "admin") return { error: "רק הצוות מוחק שאלות." };
  await createAdminClient().from("arena_questions").delete().eq("id", questionId);
  revalidatePath("/arena");
  return { ok: true };
}
