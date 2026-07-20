import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { JobCard } from "@/components/patterns/job-card";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
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
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  const [{ data: jobs }, { data: saved }, { data: applied }, { data: myAnswers }, { data: techTax }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .eq("source", activeTab)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      user ? supabase.from("saved_jobs").select("job_id").eq("profile_id", user.id) : Promise.resolve({ data: [] }),
      user
        ? supabase.from("applications").select("job_id, status").eq("applicant_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from("profile_answers").select("value").eq("profile_id", user.id)
        : Promise.resolve({ data: [] }),
      supabase.from("config_taxonomies").select("value, label_he").eq("kind", "tech"),
    ]);

  const savedIds = new Set((saved ?? []).map((s) => s.job_id));
  const appStatusByJob = new Map((applied ?? []).map((a) => [a.job_id, a.status]));

  // The member's tech stack from her profile answers, normalized for matching:
  // answers store taxonomy values (e.g. "react") while admins type job tags in
  // free text — so match on both the value and its Hebrew/English label.
  const labelByValue = new Map((techTax ?? []).map((t) => [t.value, t.label_he]));
  const myTech = new Set<string>();
  for (const a of myAnswers ?? []) {
    if (!Array.isArray(a.value)) continue;
    for (const v of a.value as unknown[]) {
      if (typeof v !== "string" || !v) continue;
      myTech.add(v.trim().toLowerCase());
      const label = labelByValue.get(v);
      if (label) myTech.add(label.trim().toLowerCase());
    }
  }

  const matchCount = (tags: string[]) =>
    tags.filter((t) => myTech.has(t.trim().toLowerCase())).length;

  // Profile-based ordering: best-matching jobs first, then newest.
  const sortedJobs = [...(jobs ?? [])].sort((a, b) => {
    const diff = matchCount(b.tech_tags) - matchCount(a.tech_tags);
    if (diff !== 0) return diff;
    return a.created_at < b.created_at ? 1 : -1;
  });

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
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

      {/* The priority policy is stated plainly — to free members and to all. */}
      <div className="flex gap-2.5 items-start bg-tint-warm border border-[#F0DCA8] rounded-md p-3 px-4 text-[13.5px] text-[#8C5E0E]">
        <Crown size={17} className="shrink-0 mt-0.5" />
        <span className="flex-1">
          <b className="font-display">עדיפות למנויות הקהילה.</b>{" "}
          {subscriber
            ? "המשרות שלנו מוצעות קודם כול לחברות עם מנוי פעיל — כלומר גם לך 💜"
            : "המשרות שלנו מוצעות קודם כול לחברות עם מנוי פעיל. את מוזמנת להגיש, ומנוי מקפיץ אותך לראש הרשימה."}
        </span>
        {!subscriber && (
          <Link href="/join" className="font-semibold whitespace-nowrap hover:underline">
            לשדרוג ←
          </Link>
        )}
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

      {sortedJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              saved={savedIds.has(job.id)}
              applied={appStatusByJob.has(job.id)}
              applicationStatus={appStatusByJob.get(job.id) ?? null}
              myTech={[...myTech]}
              matches={matchCount(job.tech_tags)}
              subscriber={subscriber}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          אין כאן משרות כרגע — בקרוב נוסיף עוד 💜
        </div>
      )}
    </div>
  );
}
