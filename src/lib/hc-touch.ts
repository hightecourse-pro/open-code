import { createAdminClient } from "@/lib/supabase/admin";
import { TOUCH_A, TOUCH_Q, emptyCounts, type TouchResults } from "@/app/touch/content";

// Server side of ״תני לנו את הטאצ' שלך״: anonymous answers in, counts out.

export type TouchAnswer = { sid: string; q: number; a: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only well-formed answers (a random session id, question 1-10, answer 1-4). */
export function cleanAnswers(input: unknown): TouchAnswer[] {
  if (!Array.isArray(input)) return [];
  const out = new Map<string, TouchAnswer>();
  for (const raw of input.slice(0, 60)) {
    const r = raw as Partial<TouchAnswer> | null;
    if (!r || typeof r.sid !== "string" || !UUID.test(r.sid)) continue;
    const q = Number(r.q);
    const a = Number(r.a);
    if (!Number.isInteger(q) || q < 1 || q > TOUCH_Q || !Number.isInteger(a) || a < 1 || a > TOUCH_A) continue;
    out.set(`${r.sid}:${q}`, { sid: r.sid.toLowerCase(), q, a }); // the later answer of the same question wins
  }
  return [...out.values()];
}

export async function saveAnswers(answers: TouchAnswer[]): Promise<void> {
  if (!answers.length) return;
  const { error } = await createAdminClient()
    .from("hc_touch_answers")
    .upsert(answers.map((x) => ({ session_id: x.sid, q: x.q, a: x.a })), { onConflict: "session_id,q" });
  if (error) throw new Error(error.message);
}

export async function touchResults(): Promise<TouchResults> {
  const counts = emptyCounts();
  const { data, error } = await createAdminClient().rpc("hc_touch_counts");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const q = Number(row.q) - 1;
    const a = Number(row.a) - 1;
    if (counts[q] && a >= 0 && a < TOUCH_A) counts[q][a] = Number(row.n);
  }
  // every woman answers the first question first, so the fullest question is the head count
  const total = Math.max(0, ...counts.map((row) => row.reduce((s, n) => s + n, 0)));
  return { counts, total, at: Date.now() };
}

export async function clearAnswers(): Promise<void> {
  const { error } = await createAdminClient().from("hc_touch_answers").delete().gte("q", 1);
  if (error) throw new Error(error.message);
}
