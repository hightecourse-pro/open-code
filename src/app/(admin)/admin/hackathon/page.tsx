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
import { guarded } from "@/lib/error-log";
import { ZERO_SCORES, totalOf } from "@/lib/judging-shared";
import { arenaOverview, loadArenaMentors } from "@/lib/arena";
import { ArenaOverview } from "./arena-overview";
import { DriveSync } from "./drive-sync";
import { getDriveFolder } from "@/lib/hackathon-drive";
import { driveFileId } from "@/lib/drive";
import { loadReviewRequests } from "@/lib/hackathon-review-requests";
import { ReviewRequests, type RequestTeam, type ReviewRequestRow } from "./review-requests";
import { HackathonDashboard, type DashboardPerson } from "./dashboard";
import { Collapsible } from "./collapsible";
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
  return guarded("/admin/hackathon", adminHackathonPageBody);
}

async function adminHackathonPageBody() {
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
  // seminar + graduation year (the owner, 25/10): profile answers, the year resolved to its Hebrew label
  const seminarOf = new Map<string, string>();
  const yearOf = new Map<string, string>();
  if (ids.length) {
    const { inChunks } = await import("@/lib/chunk");
    const [profs, { data: mails }, { data: qs }] = await Promise.all([
      inChunks<{ id: string; full_name: string; status: string }>(ids, (chunk) => admin.from("profiles").select("id, full_name, status").in("id", chunk)),
      admin.rpc("member_emails", { p_ids: ids }),
      admin.from("config_questions").select("id, key, options").in("key", ["study_place", "graduation_year"]),
    ]);
    for (const p of await withPrevSurnames(profs)) nameOf.set(p.id, { name: p.full_name, status: p.status });
    for (const m of (mails ?? []) as { id: string; email: string | null }[]) emailOf.set(m.id, m.email);
    const studyQ = (qs ?? []).find((q) => q.key === "study_place");
    const yearQ = (qs ?? []).find((q) => q.key === "graduation_year");
    const qIds = [studyQ?.id, yearQ?.id].filter((x): x is string => !!x);
    if (qIds.length) {
      const yearLabel = new Map((Array.isArray(yearQ?.options) ? (yearQ!.options as { value: string; label: string }[]) : []).map((o) => [o.value, o.label]));
      const answers = await inChunks<{ profile_id: string; question_id: string; value: unknown }>(ids, (chunk) => admin.from("profile_answers").select("profile_id, question_id, value").in("profile_id", chunk).in("question_id", qIds));
      for (const a of answers) {
        const v = typeof a.value === "string" ? a.value.trim() : "";
        if (!v) continue;
        if (a.question_id === studyQ?.id) seminarOf.set(a.profile_id, v);
        else if (a.question_id === yearQ?.id) yearOf.set(a.profile_id, yearLabel.get(v) ?? v);
      }
    }
  }
  const submissionOf = new Map(submissions.map((s) => [s.teamKey, s]));

  // בקשות השלמה (24/10) - the owner's view only; the rows hold teams' demo credentials
  const requests = full ? await loadReviewRequests() : [];
  const requestRows: ReviewRequestRow[] = requests.map((r) => {
    const sub = submissionOf.get(r.teamKey);
    return {
      ...r,
      team: (sub?.members.map((m) => m.name) ?? r.teamKey.split("+").map((id) => nameOf.get(id)?.name ?? id.slice(0, 8))).join(" + "),
      challenge: sub?.challengeShort ?? "",
    };
  });
  const requestTeams: RequestTeam[] = submissions.filter((s) => s.submittedAt).map((s) => ({ teamKey: s.teamKey, team: s.members.map((m) => m.name).join(" + "), challenge: s.challengeShort }));
  const myEmail = full ? (((await admin.rpc("member_emails", { p_ids: [me.id] })).data as { email: string | null }[] | null)?.[0]?.email ?? null) : null;
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
      seminar: seminarOf.get(r.profile_id) ?? null,
      graduationYear: yearOf.get(r.profile_id) ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
  const dashboardPeople: DashboardPerson[] = rows.map((r) => ({ id: r.profileId, challengeKey: r.challengeKey, seminar: r.seminar, year: r.graduationYear, submitted: r.submission === "submitted" }));

  // judges: mentors and team members, with their challenges (the owner's view)
  let candidates: JudgeCandidate[] = [];
  let summary: SummaryRow[] = [];
  if (board) {
    const judgeOf = new Map(board.judges.map((j) => [j.id, j]));
    candidates = [
      ...arenaMentors.map((m) => ({ id: m.id, name: m.name, initials: m.initials, role: "mentor" as const, ai: m.ai, judge: judgeOf.has(m.id), scored: judgeOf.get(m.id)?.scored ?? 0, challengeKeys: judgeOf.get(m.id)?.challengeKeys ?? [], seesReport: judgeOf.get(m.id)?.seesReport ?? false })),
      ...(await withPrevSurnames(teamRows ?? []))
        .filter((t) => t.id !== me.id)
        .map((t) => ({ id: t.id, name: t.full_name, initials: t.avatar_initials || t.full_name.slice(0, 1), role: "admin" as const, ai: false, judge: judgeOf.has(t.id), scored: judgeOf.get(t.id)?.scored ?? 0, challengeKeys: judgeOf.get(t.id)?.challengeKeys ?? [], seesReport: judgeOf.get(t.id)?.seesReport ?? false })),
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
        <p className="text-[13.5px] mt-2">
          <Link href="/admin/hackathon/live" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 bg-brand-gradient text-white font-semibold">
            🎤 ערב הגמר בשידור חי - לוח הבקרה, מסך האולם והשופטות
          </Link>
        </p>
      </div>
      <HackathonDashboard people={dashboardPeople} challenges={challengeList} />
      <Collapsible id="registrations" title="רשומות" summary={`${rows.length} רשומות · ${rows.filter((r) => r.submission === "submitted").length} הגישו`}>
        <RegistrationsTable rows={rows} challenges={challengeList} />
      </Collapsible>
      <Collapsible id="submissions" title="הגשות התוצרים" summary={`${submissions.filter((s) => s.submittedAt).length} הוגשו · ${submissions.filter((s) => !s.submittedAt).length} טיוטות${closure.closedAt ? " · ההגשות סגורות" : ""}`}>
        <SubmissionsClosure closedAt={closure.closedAt} />
        <SubmissionsTable rows={submissions} challenges={challengeList} />
      </Collapsible>
      <Collapsible id="arena" title="זירת המנטוריות" summary={`${arena.open} פתוחות · ${arena.answered} נענו`} defaultOpen={false}>
        <ArenaOverview data={arena} />
      </Collapsible>
      {board ? (
        <>
          {/* ── judging (the owner, 16/10 + 23/10): two independent judges per challenge, the owner sees all ── */}
          <Collapsible id="judging" title="שיפוט - שופטות וסרטונים" summary={`${board.judges.length} שופטות · ${board.entries.filter((e) => e.scores.length > 0).length} מתוך ${board.entries.length} עם ציון`}>
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
          </Collapsible>
          <Collapsible id="summary" title="השוואת הציונים והמלצה" summary={`${summary.filter((r) => r.average !== null).length} עם ציון שופטות · ${summary.filter((r) => r.auto !== null).length} עם בדיקה אוטומטית`}>
            <JudgingSummary rows={summary} challenges={challengeList} />
          </Collapsible>
          <Collapsible id="requests" title="בקשות השלמה מצוותים" summary={`${requestRows.length} בקשות · ${requestRows.filter((r) => r.respondedAt).length} עודכנו`}>
            <ReviewRequests rows={requestRows} teams={requestTeams} myEmail={myEmail} />
          </Collapsible>
          <Collapsible id="board" title="כל ההגשות בפירוט" summary="הסרטון, מה שנכתב, הבדיקה האוטומטית, הציונים וההערות של כל שופטת" defaultOpen={false}>
            <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm px-5 py-5">
              <JudgingBoard entries={board.entries} viewerId={me.id} manage />
            </div>
          </Collapsible>
        </>
      ) : (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm text-[13.5px] text-ink-700" data-testid="judging-restricted">
          <b>את שופטת בהאקתון</b> ({access.challengeKeys.length ? access.challengeKeys.map((k) => CHALLENGES.find((c) => c.key === k)?.short ?? k).join(", ") : "כל האתגרים"}). הציונים של שופטות אחרות והבדיקה האוטומטית לא מוצגים לך, גם לא כאן.{" "}
          <Link href="/judge" className="font-bold text-brand-purple hover:underline">
            לשולחן השיפוט שלך ←
          </Link>
        </section>
      )}
      <Collapsible id="materials" title="חומרי האתגרים" summary={`${materials.length} קבצים`} defaultOpen={false}>
        <MaterialsManager challenges={challengeList} materials={materials} />
      </Collapsible>
    </div>
  );
}
