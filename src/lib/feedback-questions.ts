import { createClient } from "@/lib/supabase/server";

/**
 * The session-feedback rating questions. The four rating slots are fixed
 * columns in session_feedback (content/practical/clarity/speaker) — what the
 * admin edits (הגדרות → שאלות המשוב על סשן) is the wording each slot asks.
 */
export type FeedbackAspect = { name: string; label: string };

export const DEFAULT_FEEDBACK_LABELS: Record<string, string> = {
  content: "התוכן עצמו",
  practical: "כמה זה מעשי",
  clarity: "כמה זה היה מובן",
  speaker: "המרצה",
};

const ORDER = ["content", "practical", "clarity", "speaker"] as const;

export function mergeFeedbackLabels(value: unknown): FeedbackAspect[] {
  const v = (value ?? {}) as Record<string, unknown>;
  return ORDER.map((name) => ({
    name,
    label:
      typeof v[name] === "string" && (v[name] as string).trim()
        ? (v[name] as string).trim()
        : DEFAULT_FEEDBACK_LABELS[name],
  }));
}

export async function getFeedbackAspects(): Promise<FeedbackAspect[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "session_feedback_labels")
    .maybeSingle();
  return mergeFeedbackLabels(data?.value);
}
