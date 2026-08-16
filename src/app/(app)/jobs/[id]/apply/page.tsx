import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireCommunityAccess } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { ApplyForm, type ApplyCvDoc } from "./apply-form";

export const metadata: Metadata = { title: "הגשת מועמדות" };
// The job's questions and open/closed state must always be fresh.
export const dynamic = "force-dynamic";

/**
 * Her CV documents, the one she marked as default first. is_default arrives
 * with supabase/_cv_default.sql — before it runs the select fails with 42703
 * and we fall back to newest-first, exactly the old behaviour.
 */
async function loadCvDocs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
): Promise<ApplyCvDoc[]> {
  const marked = await supabase
    .from("cv_documents")
    .select("id, label, created_at, is_default")
    .eq("profile_id", profileId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (!marked.error) {
    return (marked.data ?? []).map((d) => ({
      id: d.id,
      label: d.label,
      created_at: d.created_at,
      is_default: d.is_default === true,
    }));
  }
  const { data } = await supabase
    .from("cv_documents")
    .select("id, label, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({ ...d, is_default: false }));
}

/**
 * The application wizard for OUR jobs: per-job required questions, the
 * built-in "fit" question, and a CV choice (main / job-tailored upload).
 * Same gating as the board itself — any community member may apply; RLS keeps
 * targeted jobs visible only to their audience.
 */
export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireCommunityAccess();
  const supabase = await createClient();

  // RLS decides visibility (targeted jobs only for their audience).
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, company, source, status, description, description_html, location, employment_type")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.source !== "ours" || job.status !== "open") notFound();

  const [{ data: questions }, cvDocs, { data: existing }] = await Promise.all([
    supabase
      .from("job_questions")
      .select("id, question, sort_order, required, answer_type, options")
      .eq("job_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    loadCvDocs(supabase, profile.id),
    supabase
      .from("applications")
      .select("id")
      .eq("job_id", id)
      .eq("applicant_id", profile.id)
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-5 max-w-[640px]">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline self-start"
      >
        <ArrowRight size={15} /> חזרה למשרות
      </Link>

      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הגשה/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">
          הגשת מועמדות: {job.title}
        </h1>
        {/* The client's identity stays internal — she applies to the role. */}
        <p className="t-body-sm text-ink-700">משרה בלעדית דרך קוד פתוח 💜</p>
      </div>

      {/* The requirements exactly as the admin styled them (sanitized at save
          time by the allowlist in lib/rich-text — brand styles apply here). */}
      {(job.description_html || job.description) && (
        <section className="rounded-[18px] border border-ink-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink-1000 mb-3">דרישות המשרה</h2>
          {job.description_html ? (
            <div
              dir="rtl"
              className={[
                "font-body text-[15px] leading-relaxed text-ink-900",
                "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-1.5",
                "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-brand-purple",
                "[&_a]:text-brand-purple [&_a]:underline",
                "[&_p]:my-1.5 [&_b]:text-ink-1000 [&_strong]:text-ink-1000",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: job.description_html }}
            />
          ) : (
            <p className="t-body whitespace-pre-line text-ink-900">{job.description}</p>
          )}
        </section>
      )}

      {existing ? (
        <Alert variant="info" title="כבר הגשת למשרה הזו 💜">
          ההגשה שלך אצלנו — נעדכן אותך בכל התקדמות.{" "}
          <Link href="/jobs" className="font-semibold underline">
            חזרה למשרות
          </Link>
        </Alert>
      ) : (
        <ApplyForm
          jobId={job.id}
          // options is jsonb — coerce to a clean string[] for the form.
          questions={(questions ?? []).map((q) => ({
            id: q.id,
            question: q.question,
            sort_order: q.sort_order,
            required: q.required,
            answer_type: q.answer_type ?? "paragraph",
            options: Array.isArray(q.options)
              ? q.options.filter((o): o is string => typeof o === "string")
              : [],
          }))}
          cvDocs={cvDocs}
        />
      )}
    </div>
  );
}
