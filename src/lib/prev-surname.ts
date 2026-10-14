import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll, inChunks } from "@/lib/chunk";
import { nameWithPrevSurname } from "@/lib/names";

/**
 * "שם משפחה קודם" on the team's side (the owner, 14/10): wherever the team,
 * a coordinator or an employer sees a member's name - the job screening flow
 * above all - it reads "שם פרטי שם משפחה (שם משפחה קודם)", because seminary
 * records and references live under the maiden name. The community itself
 * (forum, members list, hired banner) keeps the plain name.
 *
 * The value stays in her questionnaire answer (question key prev_surname) -
 * nothing is denormalised, so the answer remains the single source of truth
 * and keeps its owner-or-admin visibility. A failed lookup degrades to plain
 * names rather than breaking a screen.
 */
const QUESTION_KEY = "prev_surname";
const CACHE_MS = 10 * 60 * 1000;
let cached: { at: number; id: Promise<string | null> } | null = null;

function questionId(): Promise<string | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.id;
  const id = (async () => {
    try {
      const { data } = await createAdminClient().from("config_questions").select("id").eq("key", QUESTION_KEY).maybeSingle();
      return data?.id ?? null;
    } catch {
      return null;
    }
  })();
  cached = { at: Date.now(), id };
  return id;
}

/** profile id → previous surname, only for the women who have one. */
export async function prevSurnamesOf(profileIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(profileIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return out;
  try {
    const qid = await questionId();
    if (!qid) return out;
    const admin = createAdminClient();
    type Row = { profile_id: string; value: unknown };
    // A handful of ids go by `.in()`; a whole-community list reads the answer
    // column once (paged) instead of hundreds of chunked requests.
    const rows: Row[] =
      ids.length > 300
        ? await fetchAll<Row>((from, to) =>
            admin
              .from("profile_answers")
              .select("profile_id, value")
              .eq("question_id", qid)
              .order("profile_id", { ascending: true })
              .range(from, to)
          )
        : await inChunks<Row>(ids, (part) =>
            admin.from("profile_answers").select("profile_id, value").eq("question_id", qid).in("profile_id", part)
          );
    const wanted = new Set(ids);
    for (const r of rows) {
      if (!wanted.has(r.profile_id) || typeof r.value !== "string") continue;
      const v = r.value.trim();
      if (v) out.set(r.profile_id, v);
    }
  } catch {
    // Plain names are better than no screen.
  }
  return out;
}

type Named = { id: string; full_name: string | null };
type ByProfile = { profile_id: string | null; full_name: string | null };

/**
 * Copies of `rows` whose full_name carries the previous surname when there is
 * one. Generic over the ARRAY type so a supabase `{ data: [] }` fallback
 * (`never[] | Row[]`) keeps its row type instead of collapsing to never.
 */
export async function withPrevSurnames<A extends readonly Named[] | null | undefined>(rows: A): Promise<NonNullable<A>> {
  const list = (rows ?? []) as readonly Named[];
  const prev = await prevSurnamesOf(list.map((r) => r.id));
  if (prev.size === 0) return list as unknown as NonNullable<A>;
  return list.map((r) =>
    prev.has(r.id) ? { ...r, full_name: nameWithPrevSurname(r.full_name, prev.get(r.id)) } : r
  ) as unknown as NonNullable<A>;
}

/** Same, for rows that point at a profile through `profile_id` (hires, registrations). */
export async function withPrevSurnamesByProfile<A extends readonly ByProfile[] | null | undefined>(
  rows: A
): Promise<NonNullable<A>> {
  const list = (rows ?? []) as readonly ByProfile[];
  const prev = await prevSurnamesOf(list.map((r) => r.profile_id));
  if (prev.size === 0) return list as unknown as NonNullable<A>;
  return list.map((r) =>
    r.profile_id && prev.has(r.profile_id)
      ? { ...r, full_name: nameWithPrevSurname(r.full_name, prev.get(r.profile_id)) }
      : r
  ) as unknown as NonNullable<A>;
}

/** profile id → display name ("שם (שם קודם)") for the given members. */
export async function displayNamesOf(profileIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const admin = createAdminClient();
  const [profs, prev] = await Promise.all([
    inChunks<{ id: string; full_name: string | null }>(ids, (part) =>
      admin.from("profiles").select("id, full_name").in("id", part)
    ),
    prevSurnamesOf(ids),
  ]);
  for (const p of profs) out.set(p.id, nameWithPrevSurname(p.full_name, prev.get(p.id)));
  return out;
}
