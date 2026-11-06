import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { getFeedbackPublication, loadFeedbackTeams } from "@/lib/hackathon-feedback";
import { FeedbackPublication } from "../feedback-publication";

export const metadata: Metadata = { title: "המשוב לצוותים - האקתון" };
export const dynamic = "force-dynamic";

const DM = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });

/**
 * המשוב לצוותים (the owner, 5/11): the switch that opens the feedback to the
 * teams, and every team with a report - each a link to the preview of what
 * that team will read.
 */
export default async function FeedbackIndexPage() {
  await requireRole("admin");
  const [publication, teams] = await Promise.all([getFeedbackPublication(), loadFeedbackTeams()]);
  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <Link href="/admin/hackathon" className="text-[13px] text-ink-600 hover:text-brand-purple hover:underline">
          ← ניהול ההאקתון
        </Link>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">המשוב לצוותים</h1>
        <p className="text-[13.5px] text-ink-700 mt-1">
          מה שהבדיקה האוטומטית כתבה על כל פרויקט, לפי ששת הקריטריונים - בלי ציונים, בלי המלצה לגמר, ובלי דיבור על נקודות. כל שורה פותחת תצוגה מקדימה של מה שהצוות יראה.
        </p>
      </div>

      <FeedbackPublication publishedAt={publication.publishedAt} teams={teams.length} />

      {CHALLENGES.map((ch) => {
        const rows = teams.filter((t) => t.challengeKey === ch.key);
        if (!rows.length) return null;
        return (
          <section key={ch.key} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm" data-testid="feedback-challenge" data-ch={ch.key}>
            <h2 className="font-display text-[17px] font-black text-ink-1000">
              {ch.short} <span className="text-ink-400 font-bold text-[14px]">· {rows.length}</span>
            </h2>
            <ul className="mt-2 flex flex-col divide-y divide-ink-100">
              {rows.map((t) => (
                <li key={t.teamKey} className="py-2 flex items-center gap-3 flex-wrap" data-testid="feedback-team" data-team={t.teamKey}>
                  <Link href={`/admin/hackathon/feedback/${encodeURIComponent(t.teamKey)}`} className="font-medium text-ink-900 hover:text-brand-purple hover:underline">
                    {t.names.join(" + ")}
                  </Link>
                  {t.finalist && <Badge variant="purple">עלתה לגמר</Badge>}
                  {t.blocked && <Badge variant="pink">הבדיקה נעצרה</Badge>}
                  {!t.submitted && <Badge variant="gray">אין הגשה כאן</Badge>}
                  <span className="ms-auto text-[12.5px] text-ink-500">{t.ranAt ? `נבדק ${DM.format(new Date(t.ranAt))}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {teams.length === 0 && <p className="text-ink-500 text-sm">אין עדיין דוחות בדיקה.</p>}
    </div>
  );
}
