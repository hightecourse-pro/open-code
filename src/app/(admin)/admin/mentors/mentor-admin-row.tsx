"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Gift } from "lucide-react";
import { Avatar, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setMemberRoleAction } from "@/app/(admin)/admin/actions";
import { addMentorBonus } from "./actions";

export interface MentorHistoryRow {
  id: string;
  memberName: string;
  purpose: string;
  assignedAt: string;
  acceptedAt: string | null;
}

export interface MentorBonusRow {
  points: number;
  reason: string | null;
  at: string;
}

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/**
 * One active mentor in the admin list: the score breakdown (incl. bonus),
 * an expandable accompaniment history (who + when + accepted?), and a small
 * bonus-points form.
 */
export function MentorAdminRow({
  mentor,
  score,
  history,
  bonuses,
}: {
  mentor: { id: string; full_name: string; avatar_initials: string | null; specialization: string | null };
  score: { score: number; answers: number; assignments: number; bonus: number };
  history: MentorHistoryRow[];
  bonuses: MentorBonusRow[];
}) {
  const [open, setOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="py-2.5 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Avatar size="sm" tone="gold" crown initials={mentor.avatar_initials || mentor.full_name.slice(0, 1)} />
        <div className="flex-1 min-w-0">
          <Link
            href={`/admin/members/${mentor.id}`}
            className="font-medium text-ink-900 truncate hover:text-brand-purple hover:underline"
          >
            {mentor.full_name}
          </Link>
          <div className="text-[11.5px] text-ink-500">
            ⭐ {score.score} נק&#39; — {score.answers} תשובות בפורום · {score.assignments} ליוויים
            {score.bonus !== 0 && <> · {score.bonus} בונוס</>}
          </div>
        </div>
        {mentor.specialization && <Badge variant="purple">{mentor.specialization}</Badge>}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer"
        >
          <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
          היסטוריית ליוויים ({history.length})
        </button>
        <button
          type="button"
          onClick={() => setBonusOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8C5E0E] hover:underline cursor-pointer"
          title="הוספת נקודות בונוס"
        >
          <Gift size={13} /> בונוס
        </button>
        <form action={setMemberRoleAction.bind(null, mentor.id, "junior")}>
          <Button type="submit" variant="ghost" size="sm">ביטול המינוי</Button>
        </form>
      </div>

      {open && (
        <div className="bg-ink-50 border border-ink-200 rounded-md p-3 mt-2 flex flex-col gap-1.5">
          {history.length > 0 ? (
            history.map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 text-[12.5px] flex-wrap">
                <span className="font-medium text-ink-900">{h.memberName}</span>
                <Badge variant="purple">{h.purpose}</Badge>
                <span className="text-ink-500 tabular-nums">שובץ {DATE_HE.format(new Date(h.assignedAt))}</span>
                {h.acceptedAt ? (
                  <span className="text-success font-semibold tabular-nums">
                    ✓ אישרה {DATE_HE.format(new Date(h.acceptedAt))}
                  </span>
                ) : (
                  <span className="text-[#8C5E0E] font-semibold">ממתין לאישור שלה</span>
                )}
              </div>
            ))
          ) : (
            <p className="text-[12.5px] text-ink-500">עוד לא שובצו אליה ליוויים.</p>
          )}
          {bonuses.length > 0 && (
            <div className="border-t border-ink-200 pt-1.5 mt-1 flex flex-col gap-1">
              {bonuses.map((b, i) => (
                <div key={i} className="text-[12px] text-ink-500 tabular-nums">
                  🎁 {b.points > 0 ? `+${b.points}` : b.points} נק&#39; · {b.reason ?? "בונוס"} ·{" "}
                  {DATE_HE.format(new Date(b.at))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bonusOpen && (
        <form
          action={(fd) =>
            start(async () => {
              await addMentorBonus(mentor.id, fd);
              setBonusOpen(false);
            })
          }
          className="bg-tint-warm/50 border border-[#F0DCA8] rounded-md p-3 mt-2 flex items-end gap-2 flex-wrap"
        >
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700">
            נקודות (אפשר גם מינוס לתיקון)
            <Input name="points" type="number" required dir="ltr" className="w-28" placeholder="50" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-700 flex-1 min-w-[180px]">
            על מה?
            <Input name="reason" placeholder="למשל: הרצתה סשן לקהילה" maxLength={200} />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "מוסיפה…" : "הוספת בונוס 🎁"}
          </Button>
        </form>
      )}
    </div>
  );
}
