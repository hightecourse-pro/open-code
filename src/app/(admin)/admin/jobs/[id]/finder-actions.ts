"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPoolKey } from "@/lib/ai/system-keys";
import { geminiJson } from "@/lib/ai/gemini";
import { MEMBER_INTERNAL_TAGS } from "./internal-tags";

export type TriageStatus = "new" | "fit" | "maybe" | "no";

/** Save one triage verdict (the finder's table row / card buttons). */
export async function setCandidateStatus(
  jobId: string,
  profileId: string,
  status: TriageStatus
): Promise<{ ok: boolean }> {
  const me = await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("job_candidate_reviews").upsert(
    {
      job_id: jobId,
      profile_id: profileId,
      status,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id,profile_id" }
  );
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

/** Toggle one internal tag on HER profile (member_crm.internal_tags). */
export async function toggleMemberInternalTag(
  profileId: string,
  tag: string,
  on: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin");
  if (!(MEMBER_INTERNAL_TAGS as readonly string[]).includes(tag)) {
    return { ok: false, error: "תגית לא מוכרת" };
  }
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("member_crm")
    .select("internal_tags")
    .eq("profile_id", profileId)
    .maybeSingle();
  const current = new Set(((existing?.internal_tags as string[] | null) ?? []).filter(Boolean));
  if (on) current.add(tag);
  else current.delete(tag);
  const { error } = await admin
    .from("member_crm")
    .upsert({ profile_id: profileId, internal_tags: [...current] }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: "השמירה נכשלה — ייתכן שחסרה המיגרציה" };
  return { ok: true };
}

/** The cross-job internal note, editable right in the review pane (3/9). */
export async function saveMemberInternalNote(
  profileId: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("member_crm")
    .upsert({ profile_id: profileId, internal_notes: note.trim().slice(0, 2000) || null }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: "השמירה נכשלה — נסי שוב." };
  return { ok: true };
}

const AI_BATCH_LIMIT = 60;

const AI_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["results"],
} as const;

/**
 * AI ranking over the finder's candidates (the owner, 2/9) — runs on the
 * system key pool (/admin/ai-keys, her free keys). Scores 0–100 with a one-
 * sentence Hebrew reason, stored on job_candidate_reviews. Practical
 * experience is weighted; learned-only tech is explicitly discounted.
 */
export async function aiRankCandidates(
  jobId: string,
  candidates: {
    profileId: string;
    name: string;
    years: number | null;
    practical: string[];
    workSummary: string;
  }[]
): Promise<{ ok: boolean; error?: string; ranked?: number }> {
  const me = await requireRole("admin");
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, title, description, description_html, tech_tags")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "המשרה לא נמצאה" };

  const jobText = (job.description_html ?? job.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 2500);

  const batch = candidates.slice(0, AI_BATCH_LIMIT);
  if (!batch.length) return { ok: false, error: "אין מועמדות לדירוג" };

  const prompt = `משרה: ${job.title}
טכנולוגיות נדרשות: ${(job.tech_tags ?? []).join(", ")}
תיאור: ${jobText}

לפנייך רשימת מועמדות. דרגי כל אחת 0-100 לפי התאמה מעשית למשרה, עם נימוק של משפט אחד בעברית (בלשון נקבה, ישיר וקצר).
כלל חשוב: רק ניסיון מעשי נחשב — עבודה, פרקטיקום, פרויקטים אמיתיים. טכנולוגיה שנלמדה בקורס בלבד אינה יתרון.

המועמדות:
${batch
  .map(
    (c) =>
      `id:${c.profileId} | ${c.name} | שנות ניסיון: ${c.years ?? "לא צוין"} | טכנולוגיות מניסיון מעשי: ${c.practical.join(", ") || "—"} | תקציר עבודה: ${c.workSummary.slice(0, 400) || "—"}`
  )
  .join("\n")}`;

  const res = await withPoolKey((apiKey) =>
    geminiJson<{ results: { id: string; score: number; reason: string }[] }>({
      apiKey,
      contents: [{ role: "user", text: prompt }],
      jsonSchema: AI_SCHEMA,
      maxOutputTokens: 8192,
    })
  );
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.reason === "no_key"
          ? "אין מפתח AI במאגר — הוסיפי מפתח במסך מפתחות AI."
          : res.reason === "exhausted"
            ? "כל מפתחות ה-AI מוצו להיום — נסי מאוחר יותר או הוסיפי מפתח."
            : "דירוג ה-AI נכשל — נסי שוב.",
    };
  }

  const valid = new Set(batch.map((c) => c.profileId));
  let ranked = 0;
  for (const r of res.data.results ?? []) {
    if (!valid.has(r.id)) continue;
    const score = Math.max(0, Math.min(100, Math.round(r.score)));
    await admin.from("job_candidate_reviews").upsert(
      {
        job_id: jobId,
        profile_id: r.id,
        ai_score: score,
        ai_reason: String(r.reason).slice(0, 400),
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_id,profile_id", ignoreDuplicates: false }
    );
    ranked += 1;
  }
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true, ranked };
}
