"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { QUESTIONS, type Recommendation } from "./questions";

/*
  Server side of the public AI-course quiz (/ai-course). Mirrors the
  masters-course pattern: the anonymous visitor talks only to these actions,
  which write with the service role - the table itself is admin-only under RLS.
  The row is created at the details step and updated per answer, so the admin
  screen can show mid-form abandonment. Scoring happens HERE, never in the
  browser.
*/

export type SignupStatus = "registered" | "planning";

const normalizeEmail = (raw: string) => (raw ?? "").trim().toLowerCase();
const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

export type StartQuizResult = { ok: true; id: string } | { ok: false; error: string };

export interface StartQuizInput {
  email: string;
  firstName: string;
  lastName: string;
  signupStatus: SignupStatus;
  /** Honeypot - real people leave it empty. */
  website?: string;
}

/** Details step: record her (or refresh her previous attempt) and hand back the row id. */
export async function startQuiz(input: StartQuizInput): Promise<StartQuizResult> {
  if (input.website) return { ok: true, id: "00000000-0000-0000-0000-000000000000" };
  const email = normalizeEmail(input.email);
  if (!emailOk(email)) return { ok: false, error: "הכתובת לא נראית תקינה - בדקי אותה שוב." };
  const firstName = (input.firstName ?? "").trim().replace(/\s+/g, " ");
  const lastName = (input.lastName ?? "").trim().replace(/\s+/g, " ");
  if (firstName.length < 2 || firstName.length > 40) return { ok: false, error: "איך קוראים לך? שם פרטי בבקשה." };
  if (lastName.length < 2 || lastName.length > 40) return { ok: false, error: "ושם המשפחה?" };
  const signupStatus: SignupStatus = input.signupStatus === "registered" ? "registered" : "planning";

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ai_course_quiz_submissions")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    // A fresh take replaces the old answers - her latest word counts.
    const { error } = await admin
      .from("ai_course_quiz_submissions")
      .update({
        first_name: firstName,
        last_name: lastName,
        signup_status: signupStatus,
        answers: {},
        questions_done: 0,
        score: null,
        recommendation: null,
        wants_placement: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "משהו השתבש אצלנו - נסי שוב בעוד רגע." };
    return { ok: true, id: existing.id };
  }

  const { data, error } = await admin
    .from("ai_course_quiz_submissions")
    .insert({ email, first_name: firstName, last_name: lastName, signup_status: signupStatus })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "משהו השתבש אצלנו - נסי שוב בעוד רגע." };
  return { ok: true, id: data.id };
}

/** One answer picked (also fires when she goes back and changes her mind). */
export async function saveAnswer(id: string, questionIndex: number, score: number): Promise<void> {
  if (!id || questionIndex < 0 || questionIndex >= QUESTIONS.length) return;
  if (![0, 1, 2].includes(score)) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ai_course_quiz_submissions")
    .select("answers, questions_done")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  const answers = { ...(row.answers as Record<string, number>), [QUESTIONS[questionIndex].id]: score };
  await admin
    .from("ai_course_quiz_submissions")
    .update({
      answers,
      questions_done: Math.max(row.questions_done ?? 0, questionIndex + 1),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export type FinishQuizResult = { ok: true; recommendation: Recommendation } | { ok: false; error: string };

/** All answered: the server adds up and decides the track. */
export async function finishQuiz(id: string): Promise<FinishQuizResult> {
  if (!id) return { ok: false, error: "משהו השתבש - נסי להתחיל מחדש." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ai_course_quiz_submissions")
    .select("answers")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "לא מצאנו את השאלון - נסי להתחיל מחדש." };

  const answers = (row.answers ?? {}) as Record<string, number>;
  const missing = QUESTIONS.filter((q) => typeof answers[q.id] !== "number");
  if (missing.length > 0) return { ok: false, error: "נשארו עוד כמה שאלות קטנות לפני ההמלצה." };

  const score = QUESTIONS.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
  // 0-10: a clear high is the fast track, a clear low is foundations, and the
  // middle goes by what she said she wants from the course (the pace question).
  const recommendation: Recommendation =
    score >= 7 ? "advanced" : score <= 4 ? "foundations" : (answers["pace"] ?? 0) === 2 ? "advanced" : "foundations";

  await admin
    .from("ai_course_quiz_submissions")
    .update({
      score,
      recommendation,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { ok: true, recommendation };
}

/** "האם את באמת מעוניינת שנשבץ אותך בקורס זה?" */
export async function setPlacement(id: string, wants: boolean): Promise<void> {
  if (!id) return;
  const admin = createAdminClient();
  await admin
    .from("ai_course_quiz_submissions")
    .update({ wants_placement: wants, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/** She downloaded the syllabus - nice to see on the admin screen. */
export async function markSyllabusDownload(id: string): Promise<void> {
  if (!id) return;
  const admin = createAdminClient();
  await admin
    .from("ai_course_quiz_submissions")
    .update({ downloaded_syllabus: true, updated_at: new Date().toISOString() })
    .eq("id", id);
}
