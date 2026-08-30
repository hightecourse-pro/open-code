"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Check, ChevronDown, Clock, Pencil, Play, Trash2, Users, Search , FolderOpen } from "lucide-react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { cn, fmtIsraelDateTime, isoToIsraelInput, israelLocalToIso } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { cancelSession, deleteSession, markSessionDone } from "../actions";
import { updateSessionDetails } from "./actions";

export interface AdminSessionRow {
  id: string;
  title: string;
  topic: string | null;
  scheduled_at: string;
  status: string;
  canceled_at: string | null;
  zoom_url: string | null;
  syllabus_url: string | null;
  materials_url: string | null;
  duration_minutes: number | null;
  /** Distinct members who opened the session's material/recording. */
  views: number;
  feedback: {
    avg: number | null;
    count: number;
    entries: {
      name: string;
      profileId: string;
      content: number | null;
      practical: number | null;
      clarity: number | null;
      speaker: number | null;
      comment: string | null;
      avg: number | null;
    }[];
  };
  recordingUrl: string | null;
}

/** Past = done, canceled, or started more than 2h ago (and not marked live). */
function isPast(s: AdminSessionRow, now: number): boolean {
  if (s.status === "done" || s.canceled_at) return true;
  if (s.status === "live") return false;
  return new Date(s.scheduled_at).getTime() < now - 2 * 3600 * 1000;
}

function StatusBadge({ s }: { s: AdminSessionRow }) {
  if (s.canceled_at) return <Badge variant="gray">בוטל</Badge>;
  if (s.status === "done") return <Badge variant="gray">הסתיים</Badge>;
  if (s.status === "live") return <Badge variant="pink">🔴 מתקיים</Badge>;
  return <Badge variant="mint">מתוכנן</Badge>;
}

function EditForm({ s, onClose }: { s: AdminSessionRow; onClose: () => void }) {
  const [when, setWhen] = useState(isoToIsraelInput(s.scheduled_at));
  const [pending, start] = useTransition();
  const iso = israelLocalToIso(when);
  return (
    <form
      action={(fd) => {
        fd.set("scheduled_at", iso);
        start(async () => {
          await updateSessionDetails(s.id, fd);
          onClose();
        });
      }}
      className="bg-ink-50 border border-ink-200 rounded-md p-3 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <Field label="כותרת" htmlFor={`t-${s.id}`}>
        <Input id={`t-${s.id}`} name="title" defaultValue={s.title} required />
      </Field>
      <Field label="נושא (כולל שם המרצה)" htmlFor={`tp-${s.id}`}>
        <Input id={`tp-${s.id}`} name="topic" defaultValue={s.topic ?? ""} />
      </Field>
      <Field label="מועד (שעון ישראל)" htmlFor={`d-${s.id}`}>
        <Input
          id={`d-${s.id}`}
          type="datetime-local"
          dir="ltr"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <p className="text-xs text-ink-500">{iso ? fmtIsraelDateTime(iso) : ""}</p>
      </Field>
      <Field label="משך (דקות)" htmlFor={`du-${s.id}`}>
        <Input
          id={`du-${s.id}`}
          name="duration_minutes"
          type="number"
          min={15}
          step={15}
          dir="ltr"
          defaultValue={s.duration_minutes ?? ""}
          placeholder="90"
        />
      </Field>
      <Field label="קישור Zoom" htmlFor={`z-${s.id}`}>
        <Input id={`z-${s.id}`} name="zoom_url" dir="ltr" defaultValue={s.zoom_url ?? ""} />
      </Field>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "שומרת…" : "שמירה"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function Row({ s, past, panel }: { s: AdminSessionRow; past: boolean; panel?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  return (
    <div className="py-2.5 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <span className="font-medium text-ink-900">{s.title}</span>
          {s.topic && (
            <span className="ms-2 inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-tint-purple text-brand-purple align-middle">
              {s.topic}
            </span>
          )}
          <div className="text-[12px] text-ink-500 mt-0.5 flex items-center gap-3 flex-wrap">
            <span dir="ltr">{fmtIsraelDateTime(s.scheduled_at)}</span>
            {s.duration_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> {s.duration_minutes} דק&#39;
              </span>
            ) : null}
            {past && !s.canceled_at && (
              <span className="inline-flex items-center gap-1" title="חברות שנכנסו לתוכן הסשן">
                <Users size={11} /> {s.views === 1 ? "משתתפת אחת" : `${s.views} משתתפות`}
              </span>
            )}
            {past && !s.canceled_at && s.feedback.count > 0 && (
              <button
                type="button"
                onClick={() => setFbOpen((v) => !v)}
                className="inline-flex items-center gap-1 font-semibold text-[#8C5E0E] hover:underline cursor-pointer"
                title="משובי החברות על הסשן"
              >
                ⭐ {s.feedback.avg?.toFixed(1)} · {s.feedback.count === 1 ? "משוב אחד" : `${s.feedback.count} משובים`}
              </button>
            )}
            {past && s.recordingUrl && (
              <a
                href={s.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline"
              >
                <Play size={11} /> להקלטה
              </a>
            )}
          </div>
        </div>
        <StatusBadge s={s} />
        <button
          type="button"
          onClick={() => setContentOpen((v) => !v)}
          className={
            "p-1.5 " + (contentOpen ? "text-brand-purple" : "text-ink-400 hover:text-brand-purple")
          }
          title="תוכן הסשן: הקלטה, סילבוס, חומרים ונושאים"
        >
          <FolderOpen size={15} />
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-ink-400 hover:text-brand-purple p-1.5"
          title="עריכת הסשן"
        >
          <Pencil size={15} />
        </button>
        {!s.canceled_at && s.status !== "done" && (
          <>
            <form action={markSessionDone.bind(null, s.id)}>
              <button type="submit" className="text-ink-400 hover:text-[#1B7A4B] p-1.5" title="סימון כ'הסתיים'">
                <Check size={15} />
              </button>
            </form>
            <ConfirmActionButton
              action={cancelSession.bind(null, s.id)}
              message="לבטל את הסשן? הוא יסומן כ'בוטל' ויוסתר מהחברות אחרי 24 שעות."
              title="ביטול סשן"
              className="text-ink-400 hover:text-brand-pink-deep p-1.5"
            >
              <Ban size={15} />
            </ConfirmActionButton>
          </>
        )}
        <ConfirmActionButton
          action={deleteSession.bind(null, s.id)}
          message="למחוק את הסשן לצמיתות? הפעולה אינה ניתנת לביטול."
          title="מחיקת סשן"
          className="text-ink-400 hover:text-danger p-1.5"
        >
          <Trash2 size={15} />
        </ConfirmActionButton>
      </div>
      {editing && <EditForm s={s} onClose={() => setEditing(false)} />}
      {contentOpen && panel}
      {fbOpen && s.feedback.count > 0 && (
        <div className="mt-2 rounded-[12px] border border-[#F0DCA8] bg-tint-warm/40 p-3 flex flex-col gap-2">
          <div className="text-[12px] font-bold text-[#8C5E0E]">
            ממוצע כללי ⭐ {s.feedback.avg?.toFixed(1)} · תוכן / מעשיות / בהירות / מרצה
          </div>
          {s.feedback.entries.map((e, i) => (
            <div key={i} className="bg-white border border-ink-100 rounded-md px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/admin/members/${e.profileId}`} className="font-semibold text-ink-900 hover:text-brand-purple hover:underline">
                  {e.name}
                </a>
                <span className="text-ink-500" dir="ltr">
                  {[e.content, e.practical, e.clarity, e.speaker].map((n) => n ?? "—").join(" / ")}
                </span>
                {e.avg != null && <span className="text-[#8C5E0E] font-bold">⭐ {e.avg.toFixed(1)}</span>}
              </div>
              {e.comment && <p className="text-ink-700 mt-1">{e.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The sessions list, the way the PM asked for it: planned and past are
 * separate groups, searchable, each session editable in place; past sessions
 * carry their participant count and a recording link.
 */
export function AdminSessionsList({ sessions, panels = {} }: { sessions: AdminSessionRow[]; panels?: Record<string, React.ReactNode> }) {
  const [q, setQ] = useState("");
  const [pastOpen, setPastOpen] = useState(true);
  // Captured once per mount — render must stay pure (react-hooks/purity).
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const needle = q.trim();
    if (!needle) return sessions;
    return sessions.filter((s) => `${s.title} ${s.topic ?? ""}`.includes(needle));
  }, [sessions, q]);

  const upcoming = filtered
    .filter((s) => !isPast(s, now))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = filtered
    .filter((s) => isPast(s, now))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם או נושא…"
          className="ps-9"
        />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-2">מתוכננים ({upcoming.length})</h3>
        <div className="flex flex-col">
          {upcoming.map((s) => (
            <Row key={s.id} s={s} past={false} panel={panels[s.id]} />
          ))}
          {upcoming.length === 0 && (
            <p className="text-ink-500 text-sm py-3">אין סשנים מתוכננים{q ? " שתואמים לחיפוש" : ""}.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setPastOpen((v) => !v)}
          className="w-full flex items-center gap-2 font-display text-base font-bold text-ink-1000"
        >
          <ChevronDown size={16} className={cn("transition-transform", !pastOpen && "-rotate-90")} />
          התקיימו ({past.length})
        </button>
        {pastOpen && (
          <div className="flex flex-col mt-2">
            {past.map((s) => (
              <Row key={s.id} s={s} past panel={panels[s.id]} />
            ))}
            {past.length === 0 && (
              <p className="text-ink-500 text-sm py-3">עוד לא התקיימו סשנים{q ? " שתואמים לחיפוש" : ""}.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
