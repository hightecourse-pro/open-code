"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isSubscriber } from "@/lib/auth";
import { withUserKey, type AiReason } from "@/lib/ai/keys";
import {
  interviewReply,
  interviewFeedback,
  type InterviewConfig,
  type Turn,
} from "@/lib/ai/interview";
import type { InterviewAgent, InterviewDifficulty, Json } from "@/types/database";

const AGENTS: InterviewAgent[] = ["hr", "tech", "friendly"];
const DIFFS: InterviewDifficulty[] = ["basic", "standard", "hard"];

export const REASON_MSG: Record<AiReason, string> = {
  no_key: "כדי לתרגל ראיון תצטרכי מפתח Google — תוכלי להוסיף אותו בעמוד מפתחות ה-AI.",
  exhausted: "המפתח הגיע למכסת השימוש. הוסיפי מפתח נוסף ונמשיך 💜",
  invalid: "המפתח לא תקין יותר. בדקי אותו או הוסיפי חדש.",
  error: "משהו השתבש. בואי ננסה שוב.",
};

export type StartState = { error?: string; reason?: AiReason };
export type TurnState = { error?: string; reason?: AiReason };

export async function startInterview(_prev: StartState, formData: FormData): Promise<StartState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const me = await getProfile();
  if (!me || !isSubscriber(me)) {
    return { error: "סימולטור הראיונות נפתח עם מנוי לקהילה 💜" };
  }

  const agentRaw = String(formData.get("agent") ?? "hr");
  const diffRaw = String(formData.get("difficulty") ?? "standard");
  const agent: InterviewAgent = AGENTS.includes(agentRaw as InterviewAgent)
    ? (agentRaw as InterviewAgent)
    : "hr";
  const difficulty: InterviewDifficulty = DIFFS.includes(diffRaw as InterviewDifficulty)
    ? (diffRaw as InterviewDifficulty)
    : "standard";
  const tech = formData.getAll("tech").map(String);
  const cfg: InterviewConfig = { agent, difficulty, tech };

  // Generate the opening question first — this both validates the key and
  // avoids creating an empty session if there's no usable key.
  const first = await withUserKey((apiKey) => interviewReply(apiKey, cfg, []));
  if (!first.ok) return { reason: first.reason, error: REASON_MSG[first.reason] };

  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert({ profile_id: user.id, agent, difficulty, tech_tags: tech, status: "live" })
    .select("id")
    .single();
  if (error || !session) return { error: "לא הצלחנו לפתוח ראיון כרגע. בואי ננסה שוב." };

  await supabase
    .from("interview_turns")
    .insert({ session_id: session.id, role: "agent", text: first.data });

  redirect(`/ai/interview/${session.id}`);
}

async function loadSession(sessionId: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("id, agent, difficulty, tech_tags, status")
    .eq("id", sessionId)
    .single();
  const { data: turns } = await supabase
    .from("interview_turns")
    .select("role, text")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return { supabase, session, turns: (turns ?? []) as Turn[] };
}

export async function sendAnswer(
  sessionId: string,
  _prev: TurnState,
  formData: FormData
): Promise<TurnState> {
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return {};

  // Gate every turn, not just the first — otherwise a session started while
  // subscribed keeps running the paid tool after the membership lapses.
  const me = await getProfile();
  if (!me || !isSubscriber(me)) {
    return { error: "סימולטור הראיונות נפתח עם מנוי לקהילה 💜" };
  }

  const { supabase, session, turns } = await loadSession(sessionId);
  if (!session || session.status !== "live") return {};

  const cfg: InterviewConfig = {
    agent: session.agent,
    difficulty: session.difficulty,
    tech: session.tech_tags,
  };

  // Generate the reply first; only persist if it succeeds, so the member can
  // resend the same answer after adding a key.
  const reply = await withUserKey((apiKey) =>
    interviewReply(apiKey, cfg, [...turns, { role: "candidate", text: answer }])
  );
  if (!reply.ok) return { reason: reply.reason, error: REASON_MSG[reply.reason] };

  await supabase.from("interview_turns").insert([
    { session_id: sessionId, role: "candidate", text: answer },
    { session_id: sessionId, role: "agent", text: reply.data },
  ]);

  revalidatePath(`/ai/interview/${sessionId}`);
  return {};
}

export async function finishInterview(
  sessionId: string,
  _prev: TurnState,
  _formData: FormData
): Promise<TurnState> {
  const me = await getProfile();
  if (!me || !isSubscriber(me)) {
    return { error: "סימולטור הראיונות נפתח עם מנוי לקהילה 💜" };
  }

  const { supabase, session, turns } = await loadSession(sessionId);
  if (!session) return {};

  const cfg: InterviewConfig = {
    agent: session.agent,
    difficulty: session.difficulty,
    tech: session.tech_tags,
  };

  const fb = await withUserKey((apiKey) => interviewFeedback(apiKey, cfg, turns));
  if (!fb.ok) return { reason: fb.reason, error: REASON_MSG[fb.reason] };

  await supabase.from("interview_feedback").upsert(
    {
      session_id: sessionId,
      overall_score: fb.data.overall_score,
      summary: fb.data.summary,
      strengths: fb.data.strengths as unknown as Json,
      improvements: fb.data.improvements as unknown as Json,
    },
    { onConflict: "session_id" }
  );
  await supabase
    .from("interview_sessions")
    .update({ status: "done", ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath(`/ai/interview/${sessionId}`);
  return {};
}
