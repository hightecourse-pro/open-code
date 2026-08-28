"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Gift, PauseCircle, PlayCircle, Search } from "lucide-react";
import { Avatar, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { cancelMentorRole, setMentorAvailability } from "@/app/(admin)/admin/actions";
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

export interface MentorLogRow {
  action: string;
  reason: string | null;
  at: string;
}

export interface MentorRowData {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  specialization: string | null;
  created_at: string;
  mentor_available: boolean;
  activeLoad: number;
  cvUrl: string | null;
  score: { score: number; answers: number; assignments: number; bonus: number };
  history: MentorHistoryRow[];
  bonuses: MentorBonusRow[];
  log: MentorLogRow[];
}

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

const FULL_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

const LOG_LABEL: Record<string, string> = {
  unavailable: "סומנה כלא זמינה",
  available: "חזרה להיות זמינה",
  role_cancelled: "המינוי בוטל",
};

/**
 * One active mentor in the admin list: availability at a glance, the score
 * breakdown (incl. bonus), an expandable accompaniment history (who + when +
 * accepted?), a bonus form, availability toggle and a reason-required cancel.
 */
export function MentorAdminRow({ m }: { m: MentorRowData }) {
  const [open, setOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [pending, start] = useTransition();

  const toggleAvailability = () => {
    if (m.mentor_available) {
      const reason = prompt("לסמן שהיא לא זמינה כרגע לשיבוצים חדשים? אפשר לציין סיבה (לא חובה):");
      if (reason === null) return; // cancelled the prompt
      start(() => setMentorAvailability(m.id, false, reason || undefined));
    } else {
      start(() => setMentorAvailability(m.id, true));
    }
  };

  return (
    <div className="py-2.5 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Avatar size="sm" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
        <div className="flex-1 min-w-0">
          <Link
            href={`/admin/members/${m.id}`}
            className="font-medium text-ink-900 truncate hover:text-brand-purple hover:underline"
          >
            {m.full_name}
          </Link>
          <div className="text-[11.5px] text-ink-500">
            ⭐ {m.score.score} נק&#39; — {m.score.answers} תשובות בפורום · {m.score.assignments} ליוויים
            {m.score.bonus !== 0 && <> · {m.score.bonus} בונוס</>}
            <span className="text-ink-300"> · </span>
            הצטרפה <span dir="ltr">{FULL_DATE.format(new Date(m.created_at))}</span>
          </div>
        </div>
        {m.specialization && <Badge variant="tech">{m.specialization}</Badge>}
        {!m.mentor_available ? (
          <Badge variant="gray">לא זמינה כרגע</Badge>
        ) : m.activeLoad === 0 ? (
          <Badge variant="mint">פנויה לשיבוץ</Badge>
        ) : (
          <Badge variant="purple">
            {m.activeLoad === 1 ? "ליווי פעיל אחד" : `${m.activeLoad} ליוויים פעילים`}
          </Badge>
        )}
        {m.cvUrl && (
          <a
            href={m.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline"
          >
            <FileText size={13} /> קו&quot;ח
          </a>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer"
        >
          <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
          היסטוריית ליוויים ({m.history.length})
        </button>
        <button
          type="button"
          onClick={() => setBonusOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8C5E0E] hover:underline cursor-pointer"
          title="הוספת נקודות בונוס"
        >
          <Gift size={13} /> בונוס
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={toggleAvailability}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer"
          title={m.mentor_available ? "סימון כלא זמינה זמנית (בלי לבטל מינוי)" : "החזרה לזמינות"}
        >
          {m.mentor_available ? (
            <>
              <PauseCircle size={13} /> לא זמינה
            </>
          ) : (
            <>
              <PlayCircle size={13} /> החזרה לזמינות
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCancelOpen((v) => !v)}
          className="text-[12.5px] font-semibold text-ink-400 hover:text-danger cursor-pointer"
        >
          ביטול המינוי
        </button>
      </div>

      {cancelOpen && (
        <div className="bg-danger-bg/60 border border-[#F2BBC8] rounded-md p-3 mt-2 flex flex-col gap-2">
          <p className="text-[12.5px] text-[#A8254B] font-semibold">
            ביטול המינוי יחזיר אותה לחברה רגילה. כל מי שהיא מלווה כרגע תקבל מייל עדכון,
            והבקשה שלה תיפתח מחדש לשיבוץ. חובה לציין סיבה — היא נשמרת בהיסטוריה.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="סיבת הביטול (חובה)"
              className="flex-1 min-w-[220px] text-[13px] border border-ink-300 rounded-md px-3 py-1.5 outline-none focus:border-brand-purple bg-white"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !cancelReason.trim()}
              onClick={() => {
                if (!confirm(`לבטל את המינוי של ${m.full_name}?`)) return;
                const fd = new FormData();
                fd.set("reason", cancelReason);
                start(() => cancelMentorRole(m.id, fd));
              }}
            >
              {pending ? "מבטלת…" : "אישור הביטול"}
            </Button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="text-[12px] text-ink-500 hover:text-ink-900 cursor-pointer"
            >
              התחרטתי
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="bg-ink-50 border border-ink-200 rounded-md p-3 mt-2 flex flex-col gap-1.5">
          <p className="text-[11px] text-ink-400">
            &quot;שובץ&quot; = הצענו לה את הליווי · &quot;אישרה&quot; = היא קיבלה אותו והחברה רואה אותה
          </p>
          {m.history.length > 0 ? (
            m.history.map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 text-[12.5px] flex-wrap">
                <span className="font-medium text-ink-900">{h.memberName}</span>
                <Badge variant="purple">{h.purpose}</Badge>
                <span className="text-ink-500 tabular-nums">
                  שובץ {DATE_HE.format(new Date(h.assignedAt))}
                </span>
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
          {m.bonuses.length > 0 && (
            <div className="border-t border-ink-200 pt-1.5 mt-1 flex flex-col gap-1">
              {m.bonuses.map((b, i) => (
                <div key={i} className="text-[12px] text-ink-500 tabular-nums">
                  🎁 {b.points > 0 ? `+${b.points}` : b.points} נק&#39; · {b.reason ?? "בונוס"} ·{" "}
                  {DATE_HE.format(new Date(b.at))}
                </div>
              ))}
            </div>
          )}
          {m.log.length > 0 && (
            <div className="border-t border-ink-200 pt-1.5 mt-1 flex flex-col gap-1">
              {m.log.map((l, i) => (
                <div key={i} className="text-[12px] text-ink-500 tabular-nums">
                  🗂 {LOG_LABEL[l.action] ?? l.action}
                  {l.reason ? ` — ${l.reason}` : ""} · {DATE_HE.format(new Date(l.at))}
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
              await addMentorBonus(m.id, fd);
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

/** The active-mentors list with search + field filter (the list will grow). */
export function MentorsList({ mentors }: { mentors: MentorRowData[] }) {
  const [q, setQ] = useState("");
  const [field, setField] = useState("");

  const fields = useMemo(
    () => [...new Set(mentors.map((m) => m.specialization).filter((s): s is string => !!s))].sort(),
    [mentors]
  );
  const shown = useMemo(() => {
    const needle = q.trim();
    return mentors.filter((m) => {
      if (field && m.specialization !== field) return false;
      if (needle && !`${m.full_name} ${m.specialization ?? ""}`.includes(needle)) return false;
      return true;
    });
  }, [mentors, q, field]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="relative">
          <Search size={13} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש מנטורית…"
            className="w-48 text-[12.5px] border border-ink-300 rounded-md ps-3 pe-8 py-1.5 outline-none focus:border-brand-purple"
          />
        </label>
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 bg-white text-ink-700"
        >
          <option value="">כל תחום</option>
          {fields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-ink-500 ms-auto">
          {shown.length} מתוך {mentors.length}
        </span>
      </div>
      <div className="flex flex-col">
        {shown.map((m) => (
          <MentorAdminRow key={m.id} m={m} />
        ))}
        {shown.length === 0 && (
          <p className="text-ink-500 text-sm py-2">לא נמצאו מנטוריות בסינון הזה.</p>
        )}
      </div>
    </div>
  );
}
