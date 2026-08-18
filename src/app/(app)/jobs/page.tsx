import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Crown, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { techKey } from "@/lib/tech-match";
import { Alert, Input } from "@/components/ui";
import { JobCard } from "@/components/patterns/job-card";
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
  const needle = (q ?? "").trim().slice(0, 60);
  // PostgREST reads or() as a comma/paren-separated list of filters, ilike
  // treats % and _ as wildcards, and cs.{…} is an array literal — neutralize
  // all of it before her text goes in, so a stray comma or brace can't turn
  // into extra filter syntax.
  const safeNeedle = needle.replace(/[,()%_\\*{}"]/g, " ").trim();
  const fitOnly = fit === "1";
  /** Keeps the tab (and her search) on every link that leaves this screen. */
  const boardHref = (params: { type?: JobSource; q?: string; fit?: boolean }) => {
    const sp = new URLSearchParams({ type: params.type ?? activeTab });
    if (params.q) sp.set("q", params.q);
    if (params.fit) sp.set("fit", "1");
    return `/jobs?${sp.toString()}`;
  };

  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  // Free-text search (?q=): title, technologies and the description — plus the
  // company, but ONLY on the market tab. Matching an internal job by its
  // client's name would let a member infer the confidential company by typing
  // names and watching which jobs come back (the card hides it for a reason).
  let jobsQuery = supabase.from("jobs").select("*").eq("source", activeTab).eq("status", "open");
  if (safeNeedle) {
    // description_html is searched as stored markup — almost every description
    // lives there rather than in the plain column, so leaving it out would make
    // the search miss the text she can see. (A latin tag name like "span" can
    // therefore match; a Hebrew or technology needle can't.)
    const clauses = [
      `title.ilike.%${safeNeedle}%`,
      `description.ilike.%${safeNeedle}%`,
      `description_html.ilike.%${safeNeedle}%`,
      // cs.{…} matches a whole array element: "reac" will not find the "react"
      // tag, but the title/description clauses still can.
      `tech_tags.cs.{${safeNeedle}}`,
    ];
    if (activeTab === "open") clauses.push(`company.ilike.%${safeNeedle}%`);
    jobsQuery = jobsQuery.or(clauses.join(","));
  }

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
              {(needle || fitOnly) && " הן תמיד כאן, גם כשמסננים למטה."}
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

      {/* A plain GET form — the search works without JS and keeps her tab. */}
      <form method="get" action="/jobs" className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="type" value={activeTab} />
        {fitOnly && <input type="hidden" name="fit" value="1" />}
        <div className="relative flex-1 min-w-48">
          <Search
            size={14}
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400 pointer-events-none"
          />
          <Input
            name="q"
            type="search"
            defaultValue={needle}
            placeholder="חיפוש לפי תפקיד, טכנולוגיה או מילה מהתיאור…"
            className="ps-9"
            aria-label="חיפוש משרות"
          />
        </div>
        <button
          type="submit"
          className="font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white cursor-pointer"
        >
          חיפוש
        </button>
        {needle && (
          <a href={boardHref({ fit: fitOnly })} className="text-[13px] font-semibold text-brand-purple">
            ניקוי
          </a>
        )}
      </form>

      {/* Opt-in only: the board never hides a job from her on its own. */}
      <a
        href={boardHref({ q: needle, fit: !fitOnly })}
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
              href={boardHref({ type: tab.id, q: needle, fit: fitOnly })}
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

      {(needle || fitOnly) && sortedJobs.length > 0 && (
        <p className="text-[13px] text-ink-700">
          {sortedJobs.length === 1 ? "תוצאה אחת" : `${sortedJobs.length} תוצאות`}
          {needle ? ` עבור “${needle}”` : ""}
          {fitOnly ? " — רק משרות עם הטכנולוגיות שלך" : ""}.
        </p>
      )}

      {sortedJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedJobs.map((job) => (
            <JobCard key={job.id} {...cardProps(job)} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          {needle ? (
            <>
              לא מצאנו משרות שמתאימות ל“{needle}” — אפשר לנסות מילה אחרת או{" "}
              <a href={boardHref({ fit: fitOnly })} className="text-brand-purple font-semibold">
                לנקות את החיפוש
              </a>{" "}
              💜
            </>
          ) : fitOnly ? (
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
      )}
    </div>
  );
}
