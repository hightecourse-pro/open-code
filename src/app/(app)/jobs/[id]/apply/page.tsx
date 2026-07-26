import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireCommunityAccess } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "הגשת מועמדות" };
// The job's questions and open/closed state must always be fresh.
export const dynamic = "force-dynamic";

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
    .select("id, title, company, source, status")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.source !== "ours" || job.status !== "open") notFound();

  const [{ data: questions }, { data: cvDocs }, { data: existing }] = await Promise.all([
    supabase
      .from("job_questions")
      .select("id, question, sort_order, required")
      .eq("job_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("cv_documents")
      .select("id, label, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false }),
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
          questions={questions ?? []}
          cvDocs={cvDocs ?? []}
        />
      )}
    </div>
  );
}
