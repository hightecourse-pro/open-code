import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { getFeedbackPublication, loadFeedbackTeams, loadTeamFeedback } from "@/lib/hackathon-feedback";
import { FeedbackCard } from "@/app/(app)/hackathon/submit/feedback-card";

export const metadata: Metadata = { title: "תצוגה מקדימה של המשוב - האקתון" };
export const dynamic = "force-dynamic";

/**
 * The preview (the owner, 5/11: ״אני צריכה לראות איך הפידבק יראה לבנות
 * שהגישו״): the very card the team gets on its submission page, with the
 * team's names above it and the way to the next team.
 */
export default async function FeedbackPreviewPage({ params }: { params: Promise<{ teamKey: string }> }) {
  await requireRole("admin");
  const { teamKey } = await params;
  const [feedback, teams, publication] = await Promise.all([loadTeamFeedback(teamKey), loadFeedbackTeams(), getFeedbackPublication()]);
  const i = teams.findIndex((t) => t.teamKey === teamKey);
  if (!feedback || i < 0) notFound();
  const team = teams[i];
  const prev = i > 0 ? teams[i - 1] : null;
  const next = i < teams.length - 1 ? teams[i + 1] : null;
  const nav = "text-[13px] font-semibold text-brand-purple hover:underline";
  return (
    <div className="flex flex-col gap-4 max-w-4xl" data-testid="feedback-preview" data-team={teamKey}>
      <div>
        <Link href="/admin/hackathon/feedback" className="text-[13px] text-ink-600 hover:text-brand-purple hover:underline">
          ← כל הצוותים
        </Link>
        <h1 className="font-display text-[24px] font-black text-ink-1000 mt-1 flex items-center gap-2 flex-wrap">
          {team.names.join(" + ")} <Badge variant="tech">{team.challengeShort}</Badge>
        </h1>
        <div className="mt-1 flex items-center gap-4 text-[13px]">
          {prev ? (
            <Link href={`/admin/hackathon/feedback/${prev.teamKey}`} className={nav} data-testid="feedback-prev">
              → {prev.names.join(" + ")}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/admin/hackathon/feedback/${next.teamKey}`} className={nav} data-testid="feedback-next">
              {next.names.join(" + ")} ←
            </Link>
          ) : null}
          <span className="ms-auto text-ink-500">
            {i + 1} מתוך {teams.length}
          </span>
        </div>
      </div>
      <div className="rounded-[12px] border border-brand-purple/30 bg-tint-purple/30 px-4 py-2.5 text-[13px] text-ink-800" data-testid="feedback-preview-note">
        {publication.publishedAt ? "כך הצוות רואה את המשוב עכשיו, בדף הגשת התוצרים." : "כך בדיוק יראה הצוות את המשוב בדף הגשת התוצרים, ברגע שהמשוב ייפתח לצוותים. כרגע הצוותים לא רואים כלום."}
      </div>
      <FeedbackCard feedback={feedback} isPair={team.names.length > 1} />
    </div>
  );
}
