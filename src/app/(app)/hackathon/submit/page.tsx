import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui";
import { requireCommunityAccess } from "@/lib/auth";
import { checklistOf, getSubmissionsClosure, loadReflections, loadSubmission, loadTeam } from "@/lib/hackathon-submission";
import { CAPPED_TOTAL, CORRECTNESS_FLOOR, CRITERIA, RUBRIC_NOTE } from "@/lib/judging-shared";
import { H26Style, HackathonLogo, Squiggle } from "@/app/hackathon-2026/shared";
import { SubmissionForm } from "./submission-form";
import { VideoUploader } from "./video-uploader";
import { ReflectionForm } from "./reflection-form";
import { FinalSubmit } from "./final-submit";
import { LockedBanner, LockedView } from "./locked-view";
import { loadReviewRequest } from "@/lib/hackathon-review-requests";
import { ReviewRequestCard } from "./review-request-card";

export const metadata: Metadata = { title: "הגשת התוצרים - האקתון" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * הגשת התוצרים (the owner, 16/10): one shared submission per team - product
 * link, public repo, architecture, a one-minute video, the AI tools and
 * models - and three personal questions each woman answers for herself.
 * Dressed as the hackathon: the squiggle heading, the logo, the challenge.
 */
export default async function HackathonSubmitPage() {
  const profile = await requireCommunityAccess();
  const team = await loadTeam(profile.id);

  if (!team) {
    return (
      <div className="flex flex-col gap-5 max-w-4xl">
        <H26Style />
        <Header />
        <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14px] text-ink-800 leading-relaxed">
          <p>
            <b>ההגשה פתוחה לרשומות להאקתון.</b> ברגע שנרשמת לאתגר (לבד או כזוג מאושר), הדף הזה נפתח לך.
          </p>
          <Link href="/hackathon" className="inline-flex mt-3 font-display font-bold text-brand-purple hover:underline">
            להרשמה להאקתון ←
          </Link>
        </section>
      </div>
    );
  }

  const [submission, reflections, closure, request] = await Promise.all([loadSubmission(team.teamKey), loadReflections(team.members.map((m) => m.id)), getSubmissionsClosure(), loadReviewRequest(team.teamKey)]);
  const locked = closure.closedAt;
  const mine = reflections.get(profile.id) ?? null;
  const partner = team.members.find((m) => m.id !== profile.id) ?? null;
  const partnerReflected = partner ? !!reflections.get(partner.id)?.contributed : false;
  const checklist = checklistOf(submission, mine);
  const pct = Math.round((checklist.done / checklist.total) * 100);

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <H26Style />
      <Header />

      {/* ── the team card: who, which challenge, how far along ── */}
      <section className="relative overflow-hidden rounded-[22px] bg-brand-gradient text-white px-6 py-5 shadow-glow-pink">
        <span className="absolute -top-6 -start-4 text-[120px] opacity-10 select-none" aria-hidden>
          {team.challenge?.emoji ?? "🏆"}
        </span>
        <div className="relative flex items-center gap-5 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="font-mono text-[11.5px] text-white/80">&lt;הצוות/&gt;</div>
            <div className="font-display font-black text-[20px] leading-snug mt-1 flex items-center gap-2 flex-wrap">
              {team.members.map((m, i) => (
                <span key={m.id} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-white/70">+</span>}
                  <Avatar size="xs" initials={m.initials} />
                  {m.name}
                </span>
              ))}
            </div>
            <div className="text-[13.5px] text-white/90 mt-1.5">
              אתגר <b>{team.challenge?.short ?? team.challengeKey}</b> {team.challenge?.emoji}
              {team.isPair && <> · הגשה אחת לזוג, השאלות האישיות - כל אחת בעצמה</>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing pct={pct} />
            <div className="text-[13px]">
              <div className="font-display font-black text-[18px] leading-tight">
                {checklist.done} מתוך {checklist.total}
              </div>
              <div className="text-white/85">חלקים מוכנים</div>
              {submission?.submittedAt ? (
                <div className="mt-1 inline-flex rounded-full bg-white text-brand-purple px-2.5 py-0.5 text-[12px] font-bold">
                  הוגש ✓ {WHEN.format(new Date(submission.submittedAt))}
                </div>
              ) : (
                <div className="mt-1 inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold">טיוטה</div>
              )}
            </div>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-2 flex-wrap text-[12.5px]">
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 px-3 py-1 rounded-full font-bold">
            <CalendarDays size={13} /> ערב הגמר · יום רביעי 28/10 · י״ז חשוון · היכל התרבות רמות, ירושלים
          </span>
          <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full font-semibold">
            {locked ? "ההגשות נסגרו - לקריאה בלבד" : "אפשר לשמור ולחזור, ולעדכן גם אחרי ההגשה - עד שהצוות סוגר את ההגשות."}
          </span>
        </div>
      </section>

      {/* בקשת השלמה מצוות ההאקתון (24/10) - above everything, open even after the lock */}
      {request && <ReviewRequestCard request={request} />}

      {locked && <LockedBanner closedAt={locked} />}

      {/* how the finalists are picked - the same rubric the judges see (the owner, 20/10) */}
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm" data-testid="rubric">
        <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// השיפוט"}</div>
        <h2 className="font-display text-[18px] font-black text-ink-1000">מה הקריטריונים לעלייה לגמר - 100 נקודות</h2>
        <p className="text-[12.5px] text-ink-500 mt-0.5">{RUBRIC_NOTE}</p>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13.5px]">
          {CRITERIA.map((c) => (
            <li key={c.key} className={`flex items-baseline gap-2 ${c.key === "original" ? "text-brand-pink-deep font-bold" : "text-ink-900"}`}>
              <span className="font-display font-black text-[15px] w-7 text-end shrink-0">{c.max}</span>
              <span>
                {c.label} <span className="text-ink-500 font-normal">- {c.hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-600">
          נכונות מתחת ל-{CORRECTNESS_FLOOR} מגבילה את הציון ל-{CAPPED_TOTAL} - מערכת שממציאה לא עולה לגמר. כל הגשה נבדקת על ידי שתי שופטות לפחות; פער גדול ביניהן - שופטת שלישית.
        </p>
      </section>

      {locked ? (
        <LockedView team={team} submission={submission} reflections={reflections} viewerId={profile.id} />
      ) : (
        <>
          <SubmissionForm submission={submission} />

          <VideoUploader videoPath={submission?.videoPath ?? null} videoSize={submission?.videoSize ?? null} videoUrl={submission?.videoUrl ?? null} />

          <ReflectionForm mine={mine} isPair={team.isPair} partnerName={partner?.name ?? null} partnerReflected={partnerReflected} />

          <FinalSubmit checklist={checklist} submittedAt={submission?.submittedAt ?? null} />
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הגשת התוצרים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">
          הגשת התוצרים 🚀{" "}
          <span className="text-ink-400 font-bold text-[20px]">·</span>{" "}
          <span className="text-[20px]">
            האקתון{" "}
            <span className="relative inline-block">
              <span className="t-gradient">AI</span>
              <Squiggle className="absolute -bottom-0.5 right-0 w-full" />
            </span>{" "}
            2026
          </span>
        </h1>
        <p className="t-body-sm text-ink-700 mt-1">מה שבניתן, איך בניתן, ומה זה עשה לך. זה מה שעולה לבמה.</p>
      </div>
      <HackathonLogo animate={false} className="block w-[170px] shrink-0" />
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-label={`${pct}% מוכן`} className="shrink-0 -rotate-90">
      <circle cx="34" cy="34" r={r} stroke="rgba(255,255,255,.3)" strokeWidth="7" fill="none" />
      <circle cx="34" cy="34" r={r} stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="34" y="38" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" className="rotate-90" style={{ transformOrigin: "34px 34px" }}>
        {pct}%
      </text>
    </svg>
  );
}
