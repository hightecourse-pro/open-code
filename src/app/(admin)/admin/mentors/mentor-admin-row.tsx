"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Gift, Mail, PauseCircle, PlayCircle, Search } from "lucide-react";
import { Avatar, Badge, Button, Input } from "@/components/ui";
import { PresenceAvatar } from "@/components/patterns/presence-dot";
import { cn } from "@/lib/utils";
import { cancelMentorRole, sendPersonalEmail, setMentorAvailability } from "@/app/(admin)/admin/actions";
import { addMentorBonus } from "./actions";
import { HACKATHON_POINTS } from "@/lib/mentor-score";
import { CvPreviewButton } from "@/components/patterns/cv-preview";
import { MentorsMail } from "./mentors-mail";

export interface MentorHistoryRow {
  id: string;
  profileId: string;
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
  last_seen_at?: string | null;
  specialization: string | null;
  city: string | null;
  created_at: string;
  mentor_available: boolean;
  activeLoad: number;
  cvUrl: string | null;
  /** "במה תרצי לתרום לקהילה?" - what she can help with (questionnaire, label-resolved). */
  help: { value: string; label: string }[];
  techs: { value: string; label: string }[];
  aiExperience: { value: string; label: string } | null;
  years: number | null;
  region: { value: string; label: string } | null;
  languages: string[];
  score: { score: number; answers: number; assignments: number; bonus: number; arena: number; helpful: number };
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
  const [mailOpen, setMailOpen] = useState(false);
  const [mailText, setMailText] = useState("");
  const [mailSent, setMailSent] = useState(false);
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
        <PresenceAvatar lastSeen={m.last_seen_at}>
          <Avatar size="sm" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
        </PresenceAvatar>
        <div className="flex-1 min-w-0">
          <Link
            href={`/admin/members/${m.id}`} target="_blank" rel="noopener"
            className="font-medium text-ink-900 truncate hover:text-brand-purple hover:underline"
          >
            {m.full_name}
          </Link>
          <div className="text-[11.5px] text-ink-500">
            ⭐ {m.score.score} נק&#39; - {m.score.answers} תשובות בפורום · {m.score.arena} בזירה · {m.score.assignments} ליוויים
            {m.score.bonus !== 0 && <> · {m.score.bonus} בונוס</>}
            <span className="text-ink-300"> · </span>
            הצטרפה <span dir="ltr">{FULL_DATE.format(new Date(m.created_at))}</span>
            {m.city && (
              <>
                <span className="text-ink-300"> · </span>
                📍 {m.city}
              </>
            )}
          </div>
          {m.help.length > 0 && (
            <div className="text-[11.5px] text-ink-600 mt-0.5">🤝 {m.help.map((h) => h.label).join(" · ")}</div>
          )}
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
          <>
            <CvPreviewButton url={m.cvUrl} title={m.full_name} label="קו״ח" />
            <a
              href={m.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline"
              title="בכרטיסייה חדשה"
            >
              <FileText size={13} />
            </a>
          </>
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
          onClick={() => setMailOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer"
          title="מייל אישי - מופיע גם בצ'אט שלה עם הצוות"
        >
          <Mail size={13} /> מייל
        </button>
        {mailSent && !mailOpen && <span className="text-[11.5px] font-semibold text-success">נשלח ✓</span>}
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

      {mailOpen && (
        <div className="bg-ink-50 border border-ink-200 rounded-md p-3 mt-2 flex flex-col gap-2">
          <p className="text-[12px] text-ink-500">
            ההודעה נשלחת אליה במייל ממותג ומופיעה גם בצ&apos;אט שלה עם הצוות - התשובה שלה תגיע אלייך לצ&apos;אט.
          </p>
          <textarea
            value={mailText}
            onChange={(e) => setMailText(e.target.value)}
            rows={3}
            maxLength={4000}
            className="w-full rounded-md border border-ink-200 bg-white p-2 text-[13px] focus:outline-none focus:border-brand-purple"
            placeholder={`מה תרצי לכתוב ל${m.full_name.split(" ")[0]}?`}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !mailText.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set("note", mailText);
                start(() =>
                  sendPersonalEmail(m.id, fd).then(() => {
                    setMailText("");
                    setMailOpen(false);
                    setMailSent(true);
                  })
                );
              }}
            >
              {pending ? "שולח…" : "שליחה"}
            </Button>
            <button
              type="button"
              onClick={() => setMailOpen(false)}
              className="text-[12px] text-ink-500 hover:text-ink-900 cursor-pointer"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="bg-danger-bg/60 border border-[#F2BBC8] rounded-md p-3 mt-2 flex flex-col gap-2">
          <p className="text-[12.5px] text-[#A8254B] font-semibold">
            ביטול המינוי יחזיר אותה לחברה רגילה. כל מי שהיא מלווה כרגע תקבל מייל עדכון,
            והבקשה שלה תיפתח מחדש לשיבוץ. חובה לציין סיבה - היא נשמרת בהיסטוריה.
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
                <Link href={`/admin/members/${h.profileId}`} target="_blank" rel="noopener" title="לתיק החברה (טאב חדש)" className="font-medium text-ink-900 hover:text-brand-purple hover:underline">
                  {h.memberName}
                </Link>
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
                  {l.reason ? ` - ${l.reason}` : ""} · {DATE_HE.format(new Date(l.at))}
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
          {/* One click per accompanied hackathon project (the owner, 10/9). */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("points", String(HACKATHON_POINTS));
                fd.set("reason", "ליווי פרויקט בהאקתון");
                await addMentorBonus(m.id, fd);
                setBonusOpen(false);
              })
            }
          >
            🏆 ליווי בהאקתון +{HACKATHON_POINTS}
          </Button>
        </form>
      )}
    </div>
  );
}

export interface MentorsCatalogue {
  help: { value: string; label: string }[];
  techs: { value: string; label: string }[];
  ai: { value: string; label: string }[];
  regions: { value: string; label: string }[];
  languages: string[];
}

const YEARS_OPTIONS = [
  { value: "", label: "כל ותק" },
  { value: "1", label: "שנה ומעלה" },
  { value: "3", label: "3 שנים ומעלה" },
  { value: "5", label: "5 שנים ומעלה" },
  { value: "10", label: "10 שנים ומעלה" },
];

const SELECT = "text-[12.5px] border border-ink-300 rounded-md px-2.5 py-1.5 bg-white text-ink-700";

/**
 * The active-mentors list: search plus criteria that each narrow the list
 * (the owner, 14/10): what she can help with, techs, AI experience, years,
 * region, language, availability and load - and one email, in the admin's
 * words, to everyone still shown.
 */
export function MentorsList({ mentors, catalogue }: { mentors: MentorRowData[]; catalogue: MentorsCatalogue }) {
  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [help, setHelp] = useState<string[]>([]);
  const [techs, setTechs] = useState<string[]>([]);
  const [ai, setAi] = useState("");
  const [minYears, setMinYears] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);

  const fields = useMemo(
    () => [...new Set(mentors.map((m) => m.specialization).filter((s): s is string => !!s))].sort(),
    [mentors]
  );
  const techLabelOf = useMemo(() => new Map(catalogue.techs.map((t) => [t.value, t.label])), [catalogue.techs]);
  const shown = useMemo(() => {
    const needle = q.trim();
    const min = minYears ? Number(minYears) : 0;
    return mentors.filter((m) => {
      if (field && m.specialization !== field) return false;
      if (needle && !`${m.full_name} ${m.specialization ?? ""} ${m.techs.map((t) => t.label).join(" ")}`.includes(needle)) return false;
      if (help.length && !help.every((h) => m.help.some((x) => x.value === h))) return false;
      if (techs.length && !techs.every((t) => m.techs.some((x) => x.value === t))) return false;
      if (ai && m.aiExperience?.value !== ai) return false;
      if (min && (m.years === null || m.years < min)) return false;
      if (region && m.region?.value !== region) return false;
      if (language && !m.languages.includes(language)) return false;
      if (onlyAvailable && !m.mentor_available) return false;
      if (onlyFree && m.activeLoad > 0) return false;
      return true;
    });
  }, [mentors, q, field, help, techs, ai, minYears, region, language, onlyAvailable, onlyFree]);
  const activeCount =
    help.length + techs.length + (field ? 1 : 0) + (ai ? 1 : 0) + (minYears ? 1 : 0) + (region ? 1 : 0) + (language ? 1 : 0) + (onlyAvailable ? 1 : 0) + (onlyFree ? 1 : 0);
  const reset = () => {
    setField(""); setHelp([]); setTechs([]); setAi(""); setMinYears(""); setRegion(""); setLanguage(""); setOnlyAvailable(false); setOnlyFree(false);
  };
  const toggleHelp = (v: string) => setHelp((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

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
        <select value={field} onChange={(e) => setField(e.target.value)} className={SELECT} aria-label="תחום">
          <option value="">כל תחום</option>
          {fields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-700">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> רק זמינות
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-700">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> רק בלי ליווי פעיל
        </label>
        <span className="text-[12px] text-ink-500 ms-auto">
          {shown.length} מתוך {mentors.length}
          {activeCount > 0 && (
            <button type="button" onClick={reset} className="ms-2 text-brand-purple font-semibold hover:underline">
              ניקוי הסינון
            </button>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
        <span className="font-semibold text-ink-700">יכולה לעזור ב:</span>
        {catalogue.help.map((h) => {
          const on = help.includes(h.value);
          return (
            <button
              key={h.value}
              type="button"
              onClick={() => toggleHelp(h.value)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-2.5 py-1 transition-colors",
                on ? "bg-brand-purple text-white border-brand-purple" : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple"
              )}
            >
              {h.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v && !techs.includes(v)) setTechs([...techs, v]);
          }}
          className={SELECT}
          aria-label="הוספת טכנולוגיה לסינון"
        >
          <option value="">+ טכנולוגיה</option>
          {catalogue.techs
            .filter((t) => !techs.includes(t.value))
            .map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
        </select>
        {techs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTechs(techs.filter((x) => x !== t))}
            className="rounded-full bg-tint-purple text-brand-purple px-2.5 py-1 text-[12px] font-semibold"
            aria-label={`הסרת ${techLabelOf.get(t) ?? t} מהסינון`}
          >
            {techLabelOf.get(t) ?? t} ✕
          </button>
        ))}
        <select value={ai} onChange={(e) => setAi(e.target.value)} className={SELECT} aria-label="ניסיון AI">
          <option value="">כל ניסיון AI</option>
          {catalogue.ai.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={minYears} onChange={(e) => setMinYears(e.target.value)} className={SELECT} aria-label="ותק">
          {YEARS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={SELECT} aria-label="אזור">
          <option value="">כל אזור</option>
          {catalogue.regions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={SELECT} aria-label="שפה">
          <option value="">כל שפה</option>
          {catalogue.languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11.5px] text-ink-500">כל קריטריון מצמצם את הרשימה. המייל נשלח למי שנשארה אחרי הסינון.</p>
      <MentorsMail recipients={shown.map((m) => ({ id: m.id, name: m.full_name }))} />
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
