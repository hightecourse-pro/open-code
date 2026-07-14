import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { JobCard } from "@/components/patterns/job-card";
import type { JobSource } from "@/types/database";

export const metadata: Metadata = { title: "משרות" };
// Always fresh — a newly published job shows immediately.
export const dynamic = "force-dynamic";

const TABS: { id: JobSource; label: string; desc: string }[] = [
  { id: "ours", label: "משרות שלנו", desc: "חברות שעובדות איתנו" },
  { id: "open", label: "משרות פתוחות", desc: "מהשוק, מותאמות לך" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeTab: JobSource = type === "open" ? "open" : "ours";

  const supabase = await createClient();
  const user = await getUser();

  const [{ data: jobs }, { data: saved }, { data: applied }, { data: myAnswers }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .eq("source", activeTab)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      user ? supabase.from("saved_jobs").select("job_id").eq("profile_id", user.id) : Promise.resolve({ data: [] }),
      user ? supabase.from("applications").select("job_id").eq("applicant_id", user.id) : Promise.resolve({ data: [] }),
      user
        ? supabase.from("profile_answers").select("value").eq("profile_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

  const savedIds = new Set((saved ?? []).map((s) => s.job_id));
  const appliedIds = new Set((applied ?? []).map((a) => a.job_id));

  // Best-effort: pull the member's tech stack from her profile answers to mark matches.
  const myTech = (myAnswers ?? [])
    .flatMap((a) => (Array.isArray(a.value) ? (a.value as unknown[]) : []))
    .filter((v): v is string => typeof v === "string");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">משרות שמתאימות לך</h1>
        <p className="t-body-sm text-ink-700">לא מציפים אותך בהכל — רק מה שתואם את הפרופיל שלך.</p>
      </div>

      <div className="flex gap-2.5 items-center bg-tint-indigo border border-[#C9D2F0] rounded-md p-3 px-4 text-[13.5px] text-ink-700">
        <Sparkles size={18} className="text-brand-indigo shrink-0" />
        <span>
          ההתאמה מבוססת על הפרופיל שלך. רוצה לדייק?{" "}
          <a href="/profile" className="text-brand-purple font-semibold">
            עדכון הפרופיל
          </a>
        </span>
      </div>

      <div className="flex gap-2.5">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <a
              key={tab.id}
              href={`/jobs?type=${tab.id}`}
              className={
                "flex-1 rounded-md p-3.5 px-[18px] border-[1.5px] transition-all " +
                (active
                  ? "border-transparent bg-brand-gradient text-white shadow-glow-pink"
                  : "border-ink-200 bg-white hover:border-brand-purple")
              }
            >
              <div className="font-display font-bold text-[15px]">{tab.label}</div>
              <div className={"text-xs mt-0.5 " + (active ? "opacity-85" : "text-ink-500")}>
                {tab.desc}
              </div>
            </a>
          );
        })}
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              saved={savedIds.has(job.id)}
              applied={appliedIds.has(job.id)}
              myTech={myTech}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          אין כרגע משרות בקטגוריה הזו. בקרוב נוסיף עוד 💜
        </div>
      )}
    </div>
  );
}
