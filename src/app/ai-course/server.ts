import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUESTIONS, recommendFor, type Recommendation } from "./questions";

/*
  Server side of the public AI-course quiz (/ai-course), reached through plain
  JSON route handlers (src/app/api/ai-course/[action]) - NOT server actions.
  Server actions tie every call to a deployment id and run through the app
  router's reducer; a filtered or stale response there can take the whole page
  down (the owner's "משהו השתבש" after the second question, 20/10). A fetch
  to a route handler can only fail inside its own try/catch.

  The anonymous visitor talks only to these functions, which write with the
  service role - the table itself is admin-only under RLS. The row is created
  at the details step and updated per answer, so the admin screen can show
  mid-form abandonment. Scoring happens HERE, never in the browser.
*/

export type SignupStatus = "registered" | "planning";

const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const GENERIC = "משהו השתבש אצלנו - נסי שוב בעוד רגע.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now = () => new Date().toISOString();

export type StartQuizResult = { ok: true; id: string } | { ok: false; error: string };

/** Details step: record her (or refresh her previous attempt) and hand back the row id. */
export async function startQuiz(input: Record<string, unknown>): Promise<StartQuizResult> {
  // Honeypot - real people leave it empty; a bot gets a fake id and nothing is stored.
  if (input.website) return { ok: true, id: "00000000-0000-0000-0000-000000000000" };
  const email = normalizeEmail(input.email);
  if (!emailOk(email)) return { ok: false, error: "הכתובת לא נראית תקינה - בדקי אותה שוב." };
  const firstName = String(input.firstName ?? "").trim().replace(/\s+/g, " ");
  const lastName = String(input.lastName ?? "").trim().replace(/\s+/g, " ");
  if (firstName.length < 2 || firstName.length > 40) return { ok: false, error: "איך קוראים לך? שם פרטי בבקשה." };
  if (lastName.length < 2 || lastName.length > 40) return { ok: false, error: "ושם המשפחה?" };
  const signupStatus: SignupStatus = input.signupStatus === "registered" ? "registered" : "planning";

  const admin = createAdminClient();
  const { data: existing } = await admin.from("ai_course_quiz_submissions").select("id").ilike("email", email).maybeSingle();

  if (existing) {
    // A fresh take starts the answers over, but her last completed result
    // stands until the new one completes - so a second visit never turns a
    // finished quiz into "נעצרה אחרי הפרטים" on the admin screen.
    const { error } = await admin
      .from("ai_course_quiz_submissions")
      .update({ first_name: firstName, last_name: lastName, signup_status: signupStatus, answers: {}, questions_done: 0, updated_at: now() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: GENERIC };
    return { ok: true, id: existing.id };
  }

  const { data, error } = await admin
    .from("ai_course_quiz_submissions")
    .insert({ email, first_name: firstName, last_name: lastName, signup_status: signupStatus })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, id: data.id };
}

/** Only known question ids with a 0/1/2 score survive. */
function cleanScores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const q of QUESTIONS) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (v === 0 || v === 1 || v === 2) out[q.id] = v;
  }
  return out;
}

/** One answer picked (also fires when she goes back and changes her mind). Best effort. */
export async function saveAnswer(id: unknown, questionIndex: unknown, score: unknown): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false };
  if (typeof questionIndex !== "number" || questionIndex < 0 || questionIndex >= QUESTIONS.length) return { ok: false };
  if (score !== 0 && score !== 1 && score !== 2) return { ok: false };
  const admin = createAdminClient();
  const { data: row } = await admin.from("ai_course_quiz_submissions").select("answers, questions_done").eq("id", id).maybeSingle();
  if (!row) return { ok: false };
  const answers = { ...cleanScores(row.answers), [QUESTIONS[questionIndex].id]: score };
  const { error } = await admin
    .from("ai_course_quiz_submissions")
    .update({ answers, questions_done: Math.max(row.questions_done ?? 0, questionIndex + 1), updated_at: now() })
    .eq("id", id);
  return { ok: !error };
}

export type FinishQuizResult = { ok: true; recommendation: Recommendation; score: number } | { ok: false; error: string };

/** All answered: the server adds up and decides the track. The client sends
 *  its full set of scores too, so a save that was lost on the way (a filtered
 *  network, a dropped connection) never blocks the result. */
export async function finishQuiz(id: unknown, clientScores: unknown): Promise<FinishQuizResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "משהו השתבש - נסי להתחיל מחדש." };
  const admin = createAdminClient();
  const { data: row } = await admin.from("ai_course_quiz_submissions").select("answers").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "לא מצאנו את השאלון - נסי להתחיל מחדש." };

  const answers = { ...cleanScores(row.answers), ...cleanScores(clientScores) };
  const missing = QUESTIONS.filter((q) => typeof answers[q.id] !== "number");
  if (missing.length > 0) return { ok: false, error: "נשארו עוד כמה שאלות קטנות לפני ההמלצה." };

  const { score, recommendation } = recommendFor(answers);
  const { error } = await admin
    .from("ai_course_quiz_submissions")
    .update({ answers, questions_done: QUESTIONS.length, score, recommendation, wants_placement: null, completed_at: now(), updated_at: now() })
    .eq("id", id);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true, recommendation, score };
}

/** "רוצה שנשבץ אותך למסלול הזה?" */
export async function setPlacement(id: unknown, wants: unknown): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID.test(id) || typeof wants !== "boolean") return { ok: false };
  const admin = createAdminClient();
  const { error } = await admin.from("ai_course_quiz_submissions").update({ wants_placement: wants, updated_at: now() }).eq("id", id);
  return { ok: !error };
}

/** She downloaded the syllabus - nice to see on the admin screen. */
export async function markSyllabusDownload(id: unknown): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false };
  const admin = createAdminClient();
  const { error } = await admin.from("ai_course_quiz_submissions").update({ downloaded_syllabus: true, updated_at: now() }).eq("id", id);
  return { ok: !error };
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

/** A client-side failure (window error, unhandled rejection, the error boundary) - kept for the admin. */
export async function reportEvent(input: Record<string, unknown>, userAgent: string | null): Promise<{ ok: boolean }> {
  const kind = input.kind === "boundary" || input.kind === "api_error" ? input.kind : "client_error";
  const subId = typeof input.subId === "string" && UUID.test(input.subId) ? input.subId : null;
  const admin = createAdminClient();
  const { error } = await admin.from("ai_course_quiz_events").insert({
    kind,
    submission_id: subId,
    step: clip(input.step, 40),
    message: clip(input.message, 600),
    digest: clip(input.digest, 80),
    stack: clip(input.stack, 2000),
    user_agent: userAgent ? userAgent.slice(0, 300) : null,
    href: clip(input.href, 300),
  });
  return { ok: !error };
}
