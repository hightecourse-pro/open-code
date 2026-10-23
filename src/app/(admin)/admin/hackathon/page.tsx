import { withPrevSurnames } from "@/lib/prev-surname";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { loadMaterials, registrableChallenges } from "@/lib/hackathon";
import { RegistrationsTable, type RegistrationRow } from "./registrations-table";
import { MaterialsManager } from "./materials-manager";
import { SubmissionsTable } from "./submissions-table";
import { getSubmissionsClosure, loadAdminSubmissions, teamKeyOf } from "@/lib/hackathon-submission";
import { SubmissionsClosure } from "./submissions-closure";
import { JudgesPicker, type JudgeCandidate } from "./judges-picker";
import { JudgingSummary, type SummaryRow } from "./judging-summary";
import { JudgingBoard } from "@/app/(app)/judge/judging-board";
import { judgeAccessFor, loadJudgingBoard } from "@/lib/judging";
import { ZERO_SCORES, totalOf } from "@/lib/judging-shared";
import { arenaOverview, loadArenaMentors } from "@/lib/arena";
import { ArenaOverview } from "./arena-overview";
import { DriveSync } from "./drive-sync";
import { getDriveFolder } from "@/lib/hackathon-drive";
import { driveFileId } from "@/lib/drive";
import Link from "next/link";

export const metadata: Metadata = { title: "האקתון" };
export const dynamic = "force-dynamic";

/**
 * ניהול ההאקתון (the owner, 5/10): who registered to which challenge (and
 * with whom), who submitted, the judges per challenge and - for the owner
 * only - every score side by side. A team member who was appointed a judge
 * (23/10) sees none of the scores here either.
 */
export default async function AdminHackathonPage() {
  const me = await requireRole("admin");
  const admin = createAdminClient();
  const access = await judgeAccessFor(me);
  const full = !access.restricted;
  const [{ data: regs }, materials, submissions, board, arenaMentors, arena, closure, { data: teamRows }] = await Promise.all([
    admin
      .from("hackathon_registrations")
      .select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000),
    loadMaterials(),
    loadAdminSubmissions(),
    full ? loadJudgingBoard(me) : Promise.resolve(null),
    loadArenaMentors(),
    arenaOverview(),
    getSubmissionsClosure(),
    admin.from("profiles").select("id, full_name, avatar_initials, role").eq("role", "admin").eq("status", "active"),
  ]);
  const challengeList = registrableChallenges().map((c) => ({ key: c.key!, short: c.short, org: c.org, emoji: c.emoji }));

  // registrants: names, emails, and whether their team submitted
  const ids = [...new Set((regs ?? []).flatMap((r) => [r.profile_id, r.partner_profile_id].filter((x): x is string => !!x)))];
  const nameOf = new Map<string, { name: string; status: string }>();
  const emailOf = new Map<string, string | null>();
  if (ids.length) {
    const { inChunks } = await import("@/lib/chunk");
    const [profs, { data: mails }] = await Promise.all([
      inChunks<{ id: string; full_name: string; status: string }>(ids, (chunk) => admin.from("profiles").select("id, full_name, status").in("id", chunk)),
      admin.rpc("member_emails", { p_ids: ids }),
    ]);
    for (const p of await withPrevSurnames(profs)) nameOf.set(p.id, { name: p.full_name, status: p.status });
    for (const m of (mails ?? []) as { id: string; email: string | null }[]) emailOf.set(m.id, m.email);
  }
  const submissionOf = new Map(submissions.map((s) => [s.teamKey, s]));
  const rows: RegistrationRow[] = (regs ?? []).map((r) => {
    const sub = submissionOf.get(teamKeyOf(r.profile_id, r.partner_profile_id, !!r.partner_confirmed_at)) ?? submissionOf.get(r.profile_id) ?? null;
    return {
      profileId: r.profile_id,
      name: nameOf.get(r.profile_id)?.name ?? r.profile_id,
      email: emailOf.get(r.profile_id) ?? null,
      status: nameOf.get(r.profile_id)?.status ?? "",
      challengeKey: r.challenge_key,
      challenge: CHALLENGES.find((c) => c.key === r.challenge_key)?.short ?? r.challenge_key,
      partnerId: r.partner_profile_id,
      partnerName: r.partner_profile_id ? (nameOf.get(r.partner_profile_id)?.name ?? null) : null,
      partnerConfirmed: !!r.partner_confirmed_at,
      submission: sub?.submittedAt ? "submitted" : sub ? "draft" : "none",
      submittedAt: sub?.submittedAt ?? null,
      productUrl: sub?.productUrl ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  // judges: mentors and team members, with their challenges (the owner's view)
  let candidates: JudgeCandidate[] = [];
  let summary: SummaryRow[] = [];
  if (board) {
    const judgeOf = new Map(board.judges.map((j) => [j.id, j]));
    candidates = [
      ...arenaMentors.map((m) => ({ id: m.id, name: m.name, initials: m.initials, role: "mentor" as const, ai: m.ai, judge: judgeOf.has(m.id), scored: judgeOf.get(m.id)?.scored ?? 0, challengeKeys: judgeOf.get(m.id)?.challengeKeys ?? [] })),
      ...(await withPrevSurnames(teamRows ?? []))
        .filter((t) => t.id !== me.id)
        .map((t) => ({ id: t.id, name: t.full_name, initials: t.avatar_initials || t.full_name.slice(0, 1), role: "admin" as const, ai: false, judge: judgeOf.has(t.id), scored: judgeOf.get(t.id)?.scored ?? 0, challengeKeys: judgeOf.get(t.id)?.challengeKeys ?? [] })),
    ];
    summary = board.entries.map((e) => ({
      teamKey: e.submission.teamKey,
      challengeKey: e.submission.challengeKey,
      team: e.submission.members.map((m) => m.name).join(" + "),
      judges: e.scores.map((s) => ({ id: s.judgeId, name: s.judgeName, total: s.total })),
      auto: e.report?.suggested ? totalOf({ ...ZERO_SCORES, ...e.report.suggested }).total : null,
      average: e.average,
      gap: e.gap,
      rank: e.rank,
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">האקתון AI 2026</h1>
        <p className="text-[13.5px] text-ink-600 mt-1">
          מי רשומה לאיזה אתגר (לבד או כזוג), מי הגישה, חומרי האתגרים להורדה למנויות, והשיפוט. ההרשמה והחומרים נמצאים בקהילה תחת ״האקתון״.
        </p>
      </div>
      <RegistrationsTable rows={rows} challenges={challengeList} />
      <SubmissionsClosure closedAt={closure.closedAt} />
      <SubmissionsTable rows={submissions} />
      <ArenaOverview data={arena} />
      {board ? (
        <>
          {/* ── judging (the owner, 16/10 + 23/10): two independent judges per challenge, the owner sees all ── */}
          <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="font-display text-base font-bold">שיפוט ({board.entries.filter((e) => e.scores.length > 0).length} מתוך {board.entries.length} הגשות עם ציון)</h3>
              <p className="text-[12.5px] text-ink-500 mt-0.5">
                לכל אתגר שתי שופטות בלתי תלויות (מנטורית או חברת צוות), שרואות רק את ההגשות של האתגר שלהן ורק את הציונים שלהן. הבדיקה האוטומטית (tools/judge-report.mjs) מוצגת רק לך.{" "}
                <Link href="/judge" className="font-bold text-brand-purple hover:underline">
                  לשולחן השיפוט ←
                </Link>
              </p>
            </div>
            <JudgesPicker candidates={candidates} challenges={challengeList} />
            <DriveSync
              folder={await getDriveFolder()}
              total={submissions.filter((s) => s.submittedAt && (s.videoDownloadUrl || (s.videoUrl && driveFileId(s.videoUrl)))).length}
              done={submissions.filter((s) => s.submittedAt && s.driveFileId).length}
            />
          </section>
          <JudgingSummary rows={summary} challenges={challengeList} />
          <details className="bg-white border border-ink-200 rounded-[18px] shadow-sm">
            <summary className="list-none cursor-pointer px-5 py-4 font-display text-base font-bold [&::-webkit-details-marker]:hidden">
              כל ההגשות בפירוט - הסרטון, מה שנכתב, הבדיקה האוטומטית, הציונים וההערות של כל שופטת <span className="text-ink-400 text-[13px] font-normal">(לחיצה לפתיחה)</span>
            </summary>
            <div className="px-5 pb-5">
              <JudgingBoard entries={board.entries} viewerId={me.id} manage />
            </div>
          </details>
        </>
      ) : (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm text-[13.5px] text-ink-700" data-testid="judging-restricted">
          <b>את שופטת בהאקתון</b> ({access.challengeKeys.length ? access.challengeKeys.map((k) => CHALLENGES.find((c) => c.key === k)?.short ?? k).join(", ") : "כל האתגרים"}). הציונים של שופטות אחרות והבדיקה האוטומטית לא מוצגים לך, גם לא כאן.{" "}
          <Link href="/judge" className="font-bold text-brand-purple hover:underline">
            לשולחן השיפוט שלך ←
          </Link>
        </section>
      )}
      <MaterialsManager challenges={challengeList} materials={materials} />
    </div>
  );
}
