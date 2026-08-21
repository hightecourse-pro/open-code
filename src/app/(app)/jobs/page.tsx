import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { techKey } from "@/lib/tech-match";
import { Alert } from "@/components/ui";
import { JobCard } from "@/components/patterns/job-card";
import { JobsInstantList } from "@/components/patterns/jobs-instant-list";
import {
  MyApplications,
  type MyApplicationItem,
  type MySubmittedItem,
} from "@/components/patterns/my-applications";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import type { Job, JobSource } from "@/types/database";

export const metadata: Metadata = { title: "משרות" };
// Always fresh — a newly published job shows immediately.
export const dynamic = "force-dynamic";

const TABS: { id: JobSource; label: string; desc: string }[] = [
  { id: "ours", label: "משרות שלנו", desc: "חברות שעובדות איתנו" },
  { id: "open", label: "משרות פתוחות", desc: "מהשוק, לפי סדר ההתאמה שלך" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; applied?: string; q?: string; fit?: string }>;
}) {
  const { type, applied, q, fit } = await searchParams;
  const activeTab: JobSource = type === "open" ? "open" : "ours";
  // The search is instant and client-side now (JobsInstantList) — nothing is
  // written back to the URL. An incoming ?q= from an old link still lands in
  // the box as its initial value, and the client filter takes it from there.
  const initialQuery = (q ?? "").trim().slice(0, 60);
  const fitOnly = fit === "1";
  /** Keeps the tab on every link that leaves this screen. */
  const boardHref = (params: { type?: JobSource; fit?: boolean }) => {
    const sp = new URLSearchParams({ type: params.type ?? activeTab });
    if (params.fit) sp.set("fit", "1");
    return `/jobs?${sp.toString()}`;
  };

  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  // Mentors don't job-hunt here — the tab is hidden for them; this covers a
  // typed-in URL with the same sentence the action uses.
  if (profile.role === "mentor") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">משרות</h1>
        </div>
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14.5px] text-ink-700 leading-relaxed">
          לוח המשרות מיועד לחברות שמחפשות עבודה 💜 בתור מנטורית, המקום שלך הוא הפורום, הצ&apos;אט
          והסשנים — ואם את מכירה משרה שמתאימה לחברות הקהילה, נשמח שתכתבי לנו.
        </div>
      </div>
    );
  }
  const subscriber = isSubscriber(profile);

  // The whole open board of this tab loads here; searching filters it on the
  // client as she types — no query round-trip, no URL writes.
  const jobsQuery = supabase.from("jobs").select("*").eq("source", activeTab).eq("status", "open");

  const [
    { data: jobs },
    { data: saved },
    { data: myApplications },
    { data: myAnswers },
    { data: techTax },
    { data: questions },
    { data: myTargets },
  ] = await Promise.all([
    jobsQuery.order("created_at", { ascending: false }),
    user ? supabase.from("saved_jobs").select("job_id").eq("profile_id", user.id) : Promise.resolve({ data: [] }),
    user
      ? supabase.from("applications").select("job_id, status").eq("applicant_id", user.id)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("profile_answers").select("question_id, value").eq("profile_id", user.id)
      : Promise.resolve({ data: [] }),
    // Tech labels for matching, plus specialization labels — her מגמה is the
    // one non-tech signal that really appears in job tags (devops, fullstack…).
    supabase
      .from("config_taxonomies")
      .select("value, label_he")
      .in("kind", ["tech", "specialization"]),
    supabase.from("config_questions").select("id, taxonomy_kind").eq("active", true),
    user ? supabase.from("job_targets").select("job_id").eq("profile_id", user.id) : Promise.resolve({ data: [] }),
  ]);

  const savedIds = new Set((saved ?? []).map((s) => s.job_id));
  const appStatusByJob = new Map((myApplications ?? []).map((a) => [a.job_id, a.status]));

  // Jobs published specifically to this member — shown in their own top section.
  const targetIds = (myTargets ?? []).map((t) => t.job_id);
  let targetedJobs: Job[] = [];
  if (targetIds.length > 0) {
    const { data: tJobs } = await supabase
      .from("jobs")
      .select("*")
      .in("id", targetIds)
      .eq("status", "open")
      .eq("source", "ours")
      .eq("pipeline_status", "published")
      .order("published_at", { ascending: false });
    targetedJobs = tJobs ?? [];
  }
  const targetedSet = new Set(targetedJobs.map((j) => j.id));

  // "המשרות שלי": where each of her applications stands, plus jobs the admin
  // submitted her to proactively. job_candidates is admin-only under RLS, so
  // it (and the job titles, which may be closed/hidden by now) are resolved
  // with the service role — strictly filtered to her own profile_id.
  let myAppItems: MyApplicationItem[] = [];
  let submittedForHer: MySubmittedItem[] = [];
  if (user) {
    const adminClient = createAdminClient();
    const { data: candRows } = await adminClient
      .from("job_candidates")
      .select("job_id")
      .eq("profile_id", user.id);
    const appRows = (myApplications ?? []).filter((a) => a.status !== "draft");
    const appliedJobIds = new Set((myApplications ?? []).map((a) => a.job_id));
    const candJobIds = [...new Set((candRows ?? []).map((c) => c.job_id))].filter(
      (id) => !appliedJobIds.has(id)
    );
    const lookupIds = [...new Set([...appRows.map((a) => a.job_id), ...candJobIds])];
    if (lookupIds.length > 0) {
      const { data: jobRows } = await adminClient
        .from("jobs")
        .select("id, title, company")
        .in("id", lookupIds);
      const jobOf = new Map((jobRows ?? []).map((j) => [j.id, j]));
      myAppItems = appRows.flatMap((a) => {
        const j = jobOf.get(a.job_id);
        return j ? [{ jobId: a.job_id, title: j.title, company: j.company, status: a.status }] : [];
      });
      submittedForHer = candJobIds.flatMap((id) => {
        const j = jobOf.get(id);
        return j ? [{ jobId: id, title: j.title, company: j.company }] : [];
      });
    }
  }

  // The member's tech stack, normalized for matching: answers store taxonomy
  // values (e.g. "react") while admins type job tags in free text — so match on
  // both the value and its Hebrew/English label.
  //
  // ONLY answers to tech-taxonomy questions count. Reading every array answer
  // (as this did) meant "בדיקות תוכנה" in her certificate question, or "פולסטאק"
  // in her track, declared her a match for any job tagged qa — a promise of
  // personalization she never made.
  const techQuestionIds = new Set(
    (questions ?? []).filter((q) => q.taxonomy_kind === "tech").map((q) => q.id)
  );
  const labelByValue = new Map((techTax ?? []).map((t) => [t.value, t.label_he]));
  // Both sides reduce to canonical keys (see lib/tech-match): job tags are
  // free-typed by admins ("node", "JS", "SQL...", "pyton") while her skills are
  // taxonomy values ("nodejs", "javascript", "sql", "python") — exact string
  // comparison missed most real matches, which was BUG-007.
  const myTech = new Set<string>();
  const addSkill = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    myTech.add(techKey(value));
    const label = labelByValue.get(value);
    if (label) myTech.add(techKey(label));
  };
  for (const a of myAnswers ?? []) {
    if (!techQuestionIds.has(a.question_id) || !Array.isArray(a.value)) continue;
    for (const v of a.value as unknown[]) {
      if (typeof v === "string") addSkill(v);
    }
  }
  // Her specialization is a genuine second signal — it may hold a taxonomy
  // value or an already-Hebrew label, so both resolve.
  if (profile.specialization) addSkill(profile.specialization);

  // The tags a job and she actually share — the card names them, so "מתאימה"
  // is something she can check rather than trust.
  const matchedCache = new Map<string, string[]>();
  const matchedTags = (job: Job) => {
    let tags = matchedCache.get(job.id);
    if (!tags) {
      tags = job.tech_tags.filter((t) => myTech.has(techKey(t)));
      matchedCache.set(job.id, tags);
    }
    return tags;
  };

  // Profile-based ordering: best-matching jobs first, then newest. Jobs already
  // shown in the targeted section stay out of the main list. Nothing is hidden
  // unless she asked for it with ?fit=1.
  const boardJobs = (jobs ?? []).filter((j) => !targetedSet.has(j.id));
  const sortedJobs = (fitOnly ? boardJobs.filter((j) => matchedTags(j).length > 0) : boardJobs)
    .slice()
    .sort((a, b) => {
      const diff = matchedTags(b).length - matchedTags(a).length;
      if (diff !== 0) return diff;
      return a.created_at < b.created_at ? 1 : -1;
    });
  const fitCount = boardJobs.filter((j) => matchedTags(j).length > 0).length;

  const cardProps = (job: Job) => ({
    job,
    saved: savedIds.has(job.id),
    applied: appStatusByJob.has(job.id),
    applicationStatus: appStatusByJob.get(job.id) ?? null,
    myTech: [...myTech],
    matchedTags: matchedTags(job),
    subscriber,
  });

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">משרות שמתאימות לך</h1>
        <p className="t-body-sm text-ink-700">
          כל המשרות כאן — מסודרות לפי ההתאמה שלך, הכי מתאימות למעלה.
        </p>
      </div>

      {applied === "1" && (
        <Alert variant="success" title="המועמדות שלך נשלחה 🎉">
          קיבלנו את ההגשה שלך — נעדכן אותך בכל התקדמות 💜
        </Alert>
      )}

      <div className="flex gap-2.5 items-center bg-tint-indigo border border-[#C9D2F0] rounded-md p-3 px-4 text-[13.5px] text-ink-700">
        <Sparkles size={18} className="text-brand-indigo shrink-0" />
        <span>
          ההתאמה נמדדת לפי הטכנולוגיות שסימנת בפרופיל וההתמחות שלך, מול הטכנולוגיות שהמשרה
          מבקשת — ולכן כדאי שהפרופיל יהיה מדויק.{" "}
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

      {targetedJobs.length > 0 && (
        <section className="rounded-[20px] p-[2px] bg-brand-gradient shadow-glow-pink">
          <div className="rounded-[18px] bg-white p-4 flex flex-col gap-1">
            <h2 className="font-display text-[19px] font-black text-ink-1000">
              משרות בשבילך מקוד פתוח 💜
            </h2>
            <p className="text-[13px] text-ink-700 mb-2">
              פורסמו במיוחד לקבוצה מצומצמת של חברות שמתאימות להן — ואת אחת מהן.
              {fitOnly && " הן תמיד כאן, גם כשמסננים למטה."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targetedJobs.map((job) => (
                <JobCard key={job.id} {...cardProps(job)} />
              ))}
            </div>
          </div>
        </section>
      )}

      <MyApplications applications={myAppItems} submitted={submittedForHer} />

      {/* Instant search over the loaded board — the cards, their ordering and
          the empty states are all prepared here on the server; typing only
          shows/hides them. The haystack includes the company ONLY on the
          market tab: matching an internal job by its client's name would let
          a member infer the confidential company by typing names and watching
          which jobs come back (the card hides it for a reason). The styled
          description is searched as its visible text — tags stripped — so a
          latin tag name like "span" can no longer match markup. */}
      <JobsInstantList
        initialQuery={initialQuery}
        fitOnly={fitOnly}
        items={sortedJobs.map((job) => ({
          id: job.id,
          haystack: [
            job.title,
            job.description,
            job.description_html ? job.description_html.replace(/<[^>]+>/g, " ") : "",
            job.tech_tags.join(" "),
            activeTab === "open" ? job.company : "",
          ].join(" "),
          node: <JobCard {...cardProps(job)} />,
        }))}
        controls={
          <>
            {/* Opt-in only: the board never hides a job from her on its own. */}
            <a
              href={boardHref({ fit: !fitOnly })}
              className={
                "self-start inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
                (fitOnly
                  ? "bg-brand-pink-deep border-brand-pink-deep text-white"
                  : "bg-white border-ink-200 text-ink-700 hover:border-brand-purple")
              }
            >
              <Sparkles size={13} />
              {fitOnly
                ? "מציגות רק משרות עם הטכנולוגיות שלי — להצגת הכול"
                : `רק משרות עם הטכנולוגיות שלי (${fitCount})`}
            </a>

            <div className="flex gap-2.5">
              {TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <a
                    key={tab.id}
                    href={boardHref({ type: tab.id, fit: fitOnly })}
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
          </>
        }
        emptyFallback={
          <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
            {fitOnly ? (
              <>
                אין כרגע משרות עם הטכנולוגיות שסימנת בפרופיל.{" "}
                <a href={boardHref({})} className="text-brand-purple font-semibold">
                  להצגת כל המשרות
                </a>{" "}
                💜
              </>
            ) : (
              "אין כאן משרות כרגע — בקרוב נוסיף עוד 💜"
            )}
          </div>
        }
      />
    </div>
  );
}
