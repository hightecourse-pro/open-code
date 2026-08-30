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

/** The PM's four clear views. `fit=1` from old links maps to "fit". */
type BoardView = "all" | "fit" | "saved" | "mine";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; applied?: string; q?: string; fit?: string; view?: string }>;
}) {
  const { type, applied, q, fit, view: viewRaw } = await searchParams;
  const activeTab: JobSource = type === "open" ? "open" : "ours";
  // The search is instant and client-side now (JobsInstantList) — nothing is
  // written back to the URL. An incoming ?q= from an old link still lands in
  // the box as its initial value, and the client filter takes it from there.
  const initialQuery = (q ?? "").trim().slice(0, 60);
  const view: BoardView =
    viewRaw === "fit" || viewRaw === "saved" || viewRaw === "mine"
      ? viewRaw
      : fit === "1"
        ? "fit"
        : "all";
  const fitOnly = view === "fit";
  /** Keeps the view+tab on every link that leaves this screen. */
  const boardHref = (params: { type?: JobSource; view?: BoardView }) => {
    const sp = new URLSearchParams({ type: params.type ?? activeTab });
    const v = params.view ?? view;
    if (v !== "all") sp.set("view", v);
    return `/jobs?${sp.toString()}`;
  };

  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  // Mentors see the board too (2026-08-26): senior roles get published to
  // them per-job from the admin's publish panel, and they may apply like
  // anyone. (They used to be turned away here.)
  const subscriber = isSubscriber(profile);

  // The whole open board of this tab loads here; searching filters it on the
  // client as she types — no query round-trip, no URL writes.
  // Explicit columns and a hard cap — select("*") dragged every full job text
  // (twice, with the haystack) into a page that refreshes on a timer.
  const JOB_CARD_COLUMNS =
    "id, company, title, source, location, region, employment_type, description, description_html, tech_tags, external_url, logo_variant, status, created_at, job_kind, practicum_percent, pipeline_status, published_at";
  const jobsQuery = supabase
    .from("jobs")
    .select(JOB_CARD_COLUMNS)
    .eq("source", activeTab)
    .eq("status", "open")
    .limit(150);

  const [
    { data: jobs },
    { data: saved },
    { data: myApplications },
    { data: myAnswers },
    { data: techTax },
    { data: questions },
    { data: myTargets },
  ] = await Promise.all([
    // Cast: the card renders only these columns; the omitted admin-side fields
    // (target_criteria, posted_by, is_visible…) never reach the member UI.
    jobsQuery.order("created_at", { ascending: false }) as unknown as Promise<{ data: Job[] | null }>,
    user ? supabase.from("saved_jobs").select("job_id").eq("profile_id", user.id) : Promise.resolve({ data: [] }),
    user
      ? supabase.from("applications").select("job_id, status, created_at").eq("applicant_id", user.id)
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
  const appliedAtByJob = new Map((myApplications ?? []).map((a) => [a.job_id, a.created_at]));

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
  // An applied targeted job moves wholly into "ההגשות שלי".
  targetedJobs = targetedJobs.filter((j) => !appStatusByJob.has(j.id));
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
    const candSet = new Set((candRows ?? []).map((c) => c.job_id));
    const appRows = (myApplications ?? []).filter((a) => a.status !== "draft");
    const appliedJobIds = new Set((myApplications ?? []).map((a) => a.job_id));
    const candJobIds = [...candSet].filter((id) => !appliedJobIds.has(id));
    const lookupIds = [...new Set([...appRows.map((a) => a.job_id), ...candJobIds])];
    if (lookupIds.length > 0) {
      // status too: a job that closed since she applied is reflected, not
      // silently frozen — the PM's "האם משוקף כשהמשרה אוישה".
      const { data: jobRows } = await adminClient
        .from("jobs")
        .select("id, title, company, status, pipeline_status")
        .in("id", lookupIds);
      const jobOf = new Map((jobRows ?? []).map((j) => [j.id, j]));
      // Honest closure wording: filled and closed-without-hire are different
      // endings, and "אוישה" on a job nobody got would be a small lie.
      const closedLabelOf = (j: { status: string; pipeline_status: string }) =>
        j.status === "open"
          ? // Still open but past submissions (sent to client / interviews) —
            // she should see her application moved along with the job.
            j.pipeline_status === "candidates_sent" || j.pipeline_status === "interviews"
            ? "המשרה בשלב הבא — המועמדויות אצל המעסיק"
            : null
          : j.pipeline_status === "hired"
            ? "המשרה אוישה"
            : "המשרה נסגרה";
      // "הוגשה ללקוח" is a FACT, not a status guess: a job_candidates row means
      // her CV physically went out; the pipeline statuses that imply it count
      // too, so an admin skipping a step never hides the handoff from her.
      const FORWARDED: string[] = ["sent", "interview", "exam", "hired"];
      myAppItems = appRows.flatMap((a) => {
        const j = jobOf.get(a.job_id);
        if (!j) return [];
        return [{
          jobId: a.job_id,
          title: j.title,
          company: j.company,
          status: a.status,
          appliedAt: a.created_at ?? null,
          forwarded: candSet.has(a.job_id) || FORWARDED.includes(a.status),
          closedLabel: closedLabelOf(j),
        }];
      });
      submittedForHer = candJobIds.flatMap((id) => {
        const j = jobOf.get(id);
        return j ? [{ jobId: id, title: j.title, company: j.company, closedLabel: closedLabelOf(j) }] : [];
      });
    }
  }
  const mineCount =
    myAppItems.filter((a) => a.status !== "draft").length + submittedForHer.length;

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

  // Profile-based ordering: best-matching jobs first, then newest. A job she
  // applied to LEAVES the board (tester round 2026-08-26 — it lives in
  // "ההגשות שלי" with its status; on the board it was duplication). The
  // targeted section drops it for the same reason.
  const boardJobs = (jobs ?? []).filter(
    (j) => !targetedSet.has(j.id) && !appStatusByJob.has(j.id)
  );
  // "מתאימות לי" no longer hides the rest of the board — the PM's point was
  // that the two views looked identical. The non-matching jobs stay, dimmed
  // and un-appliable, so the difference between the views is visible.
  const viewJobs =
    view === "saved" ? boardJobs.filter((j) => savedIds.has(j.id)) : boardJobs;
  const sortedJobs = viewJobs
    .slice()
    .sort((a, b) => {
      const diff = matchedTags(b).length - matchedTags(a).length;
      if (diff !== 0) return diff;
      return a.created_at < b.created_at ? 1 : -1;
    });
  const fitCount = boardJobs.filter((j) => matchedTags(j).length > 0).length;
  const savedCount = boardJobs.filter((j) => savedIds.has(j.id)).length;

  // The filter selects' values, straight from what is actually on this tab.
  const facetCount = new Map<string, number>();
  for (const j of boardJobs) for (const t of j.tech_tags) facetCount.set(t, (facetCount.get(t) ?? 0) + 1);
  const facets = {
    tech: [...facetCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t),
    locations: [...new Set(boardJobs.map((j) => j.location).filter((l): l is string => !!l))].sort((a, b) =>
      a.localeCompare(b, "he")
    ),
    employments: (
      [
        ["full", "משרה מלאה"],
        ["part", "חלקית"],
        ["student", "סטודנטית"],
        ["freelance", "פרילנס"],
      ] as const
    )
      .filter(([v]) => boardJobs.some((j) => j.employment_type === v))
      .map(([value, label]) => ({ value, label })),
  };

  const cardProps = (job: Job) => ({
    job,
    saved: savedIds.has(job.id),
    applied: appStatusByJob.has(job.id),
    applicationStatus: appStatusByJob.get(job.id) ?? null,
    appliedAt: appliedAtByJob.get(job.id) ?? null,
    myTech: [...myTech],
    matchedTags: matchedTags(job),
    subscriber,
    // Only the fit view closes the apply door on non-matching jobs; the full
    // board keeps every job open. A job she already applied to is never
    // dimmed — she's in its process, disabled styling would read as a rejection.
    ineligible: view === "fit" && matchedTags(job).length === 0 && !appStatusByJob.has(job.id),
  });

  const VIEWS: { id: BoardView; label: string }[] = [
    { id: "all", label: "כל המשרות" },
    { id: "fit", label: `מתאימות לי (${fitCount})` },
    { id: "saved", label: `נשמרו (${savedCount})` },
    { id: "mine", label: `ההגשות שלי (${mineCount})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh />
      {/* Compact top (the PM's ask): one row of identity, one quiet info line. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="font-display text-[24px] font-black text-ink-1000">משרות</h1>
        <span className="text-[13px] text-ink-500">מסודרות לפי ההתאמה שלך — הכי מתאימות למעלה</span>
      </div>

      {applied === "1" && (
        <Alert variant="success" title="המועמדות שלך נשלחה 🎉">
          קיבלנו את ההגשה שלך — נעדכן אותך בכל התקדמות 💜
        </Alert>
      )}

      {/* One merged note instead of two banner boxes. */}
      <p className="text-[12.5px] text-ink-500 flex items-center gap-1.5 flex-wrap -mt-1">
        <Sparkles size={13} className="text-brand-indigo shrink-0" />
        ההתאמה מחושבת מהטכנולוגיות וההתמחות שבפרופיל שלך —{" "}
        <a href="/profile" target="_blank" rel="noopener" className="text-brand-purple font-semibold">
          עדכון הפרופיל
        </a>
        <span className="text-ink-300">·</span>
        <Crown size={12} className="text-[#B8860B] shrink-0" />
        עדיפות למנויות הקהילה
        {!subscriber && profile.role !== "mentor" && (
          <Link href="/join" className="text-brand-purple font-semibold hover:underline">
            — לשדרוג ←
          </Link>
        )}
      </p>

      {/* The PM's four clear views — always visible, one row. */}
      <div className="flex gap-1.5 flex-wrap">
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <a
              key={v.id}
              href={boardHref({ view: v.id })}
              className={
                "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
                (active
                  ? "bg-brand-gradient border-transparent text-white shadow-glow-pink"
                  : "bg-white border-ink-200 text-ink-700 hover:border-brand-purple")
              }
            >
              {v.label}
            </a>
          );
        })}
      </div>

      {view === "fit" && (
        <p className="text-[12.5px] text-ink-500 -mt-1.5">
          המשרות שמתאימות לפרופיל שלך מודגשות למעלה; השאר מוצגות מעומעמות — בלי אפשרות הגשה, כי הן
          מבקשות קריטריונים אחרים.
        </p>
      )}

      {view === "mine" ? (
        <MyApplications applications={myAppItems} submitted={submittedForHer} />
      ) : (
        <>
          {/* Instant search + the PM's structured filters over the loaded
              board — rendered at the top and applied to the targeted section
              too (the owner). The haystack includes the company ONLY on the
              market tab: matching an internal job by its client's name would
              let a member infer the confidential company. */}
          <JobsInstantList
            initialQuery={initialQuery}
            fitOnly={fitOnly}
            facets={facets}
            targeted={targetedJobs.map((job) => ({
              id: job.id,
              haystack: [job.title, job.description.slice(0, 300), job.tech_tags.join(" ")].join(" "),
              tech: job.tech_tags,
              location: job.location,
              employment: job.employment_type,
              node: <JobCard {...cardProps(job)} />,
            }))}
            targetedHeader={
              <h2 className="font-display text-[16px] font-black text-ink-1000">
                משרות בשבילך מקוד פתוח 💜
                <span className="text-[12px] font-normal text-ink-500 ms-2">
                  פורסמו לקבוצה מצומצמת שמתאימה — ואת בפנים
                </span>
              </h2>
            }
            items={sortedJobs.map((job) => ({
              id: job.id,
              haystack: [
                job.title,
                // The opening covers real searches; full text doubled the page.
                job.description.slice(0, 300),
                job.tech_tags.join(" "),
                activeTab === "open" ? job.company : "",
              ].join(" "),
              tech: job.tech_tags,
              location: job.location,
              employment: job.employment_type,
              node: <JobCard {...cardProps(job)} />,
            }))}
            controls={
              <div className="flex gap-1.5">
                {TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <a
                      key={tab.id}
                      href={boardHref({ type: tab.id })}
                      title={tab.desc}
                      className={
                        "rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold border-[1.5px] transition-all " +
                        (active
                          ? "border-transparent bg-ink-1000 text-white"
                          : "border-ink-200 bg-white text-ink-700 hover:border-brand-purple")
                      }
                    >
                      {tab.label}
                    </a>
                  );
                })}
              </div>
            }
            emptyFallback={
              <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700 text-sm">
                {view === "fit" ? (
                  <>
                    אין כרגע משרות פתוחות עם הטכנולוגיות שסימנת בפרופיל.{" "}
                    <a href={boardHref({ view: "all" })} className="text-brand-purple font-semibold">
                      לכל המשרות
                    </a>{" "}
                    💜
                  </>
                ) : view === "saved" ? (
                  <>
                    עוד לא שמרת משרות — סימנייה 🔖 על כרטיס שומרת אותו כאן.
                  </>
                ) : (
                  "אין כאן משרות כרגע — בקרוב נוסיף עוד 💜"
                )}
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
