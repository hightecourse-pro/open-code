"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Bot, CheckCircle2, Lock, Trash2 } from "lucide-react";
import { Alert, Avatar, Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ArenaQuestion } from "@/lib/arena";
import { ARENA_ANSWER_POINTS, type ArenaRole } from "@/lib/arena-shared";
import { answerArenaQuestion, closeArenaQuestion, deleteArenaQuestion, type ArenaFormState } from "./actions";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

type Filter = "open" | "mine" | "ai" | "answered" | "all";

/** The board every one in the arena sees - filters differ by side. */
export function ArenaBoard({ questions, viewerId, role, focusId }: { questions: ArenaQuestion[]; viewerId: string; role: ArenaRole; focusId: string | null }) {
  const mentorSide = role !== "participant";
  // A focused question (from an email link) must be visible whatever the default filter.
  const [filter, setFilter] = useState<Filter>(() => (focusId ? "all" : mentorSide ? "open" : "mine"));

  const counts = useMemo(
    () => ({
      open: questions.filter((q) => q.status === "open").length,
      mine: mentorSide
        ? questions.filter((q) => q.status === "open" && q.targetMentorId === viewerId).length
        : questions.filter((q) => q.authorId === viewerId).length,
      ai: questions.filter((q) => q.aiOnly && q.status === "open").length,
      answered: questions.filter((q) => q.status === "answered").length,
      all: questions.length,
    }),
    [questions, viewerId, mentorSide]
  );
  const shown = useMemo(
    () =>
      questions.filter((q) => {
        if (filter === "all") return true;
        if (filter === "open") return q.status === "open";
        if (filter === "answered") return q.status === "answered";
        if (filter === "ai") return q.aiOnly && q.status === "open";
        return mentorSide ? q.status === "open" && q.targetMentorId === viewerId : q.authorId === viewerId;
      }),
    [questions, filter, viewerId, mentorSide]
  );

  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`q-${focusId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, [focusId]);

  const chips: { key: Filter; label: string }[] = mentorSide
    ? [
        { key: "open", label: `פתוחות (${counts.open})` },
        { key: "mine", label: `ממתינות לי (${counts.mine})` },
        { key: "ai", label: `AI (${counts.ai})` },
        { key: "answered", label: `נענו (${counts.answered})` },
        { key: "all", label: `הכל (${counts.all})` },
      ]
    : [
        { key: "mine", label: `השאלות שלי (${counts.mine})` },
        { key: "open", label: `פתוחות (${counts.open})` },
        { key: "answered", label: `נענו (${counts.answered})` },
        { key: "all", label: `הכל (${counts.all})` },
      ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={cn(
              "rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors",
              filter === c.key ? "bg-brand-purple text-white border-brand-purple" : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm">
          {mentorSide ? "אין שאלות בסינון הזה. 🎉" : "עדיין אין שאלות כאן - השאלה הראשונה שלך תופיע למעלה."}
        </p>
      )}
      {shown.map((q) => (
        <QuestionCard key={q.id} q={q} viewerId={viewerId} role={role} focused={q.id === focusId} />
      ))}
    </section>
  );
}

function QuestionCard({ q, viewerId, role, focused }: { q: ArenaQuestion; viewerId: string; role: ArenaRole; focused: boolean }) {
  const mentorSide = role !== "participant";
  const mine = q.authorId === viewerId;
  const forMe = q.targetMentorId === viewerId;
  const alreadyAnswered = q.answers.some((a) => a.mentorId === viewerId);
  const [state, action, pending] = useActionState<ArenaFormState, FormData>(answerArenaQuestion.bind(null, q.id), {});
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <article
      id={`q-${q.id}`}
      className={cn(
        "bg-white border rounded-[18px] p-4 md:p-5 shadow-sm flex flex-col gap-3",
        focused ? "border-brand-purple ring-2 ring-brand-purple/20" : forMe && q.status === "open" ? "border-brand-pink-deep/40" : "border-ink-200"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar size="sm" initials={q.authorInitials} />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[16px] font-black text-ink-1000 leading-snug">{q.title}</h3>
          <div className="text-[11.5px] text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{q.authorName}</span>
            <span className="text-ink-300">·</span>
            <span dir="ltr">{WHEN.format(new Date(q.createdAt))}</span>
            {q.targetMentorName && (
              <>
                <span className="text-ink-300">·</span>
                <span>
                  נשלחה ל<b className="text-ink-700">{q.targetMentorName}</b>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {q.aiOnly && (
            <Badge variant="indigo">
              <Bot size={12} /> AI
            </Badge>
          )}
          {q.status === "open" && <Badge variant="pink">פתוחה</Badge>}
          {q.status === "answered" && (
            <Badge variant="mint">
              <CheckCircle2 size={12} /> נענתה
            </Badge>
          )}
          {q.status === "closed" && (
            <Badge variant="gray">
              <Lock size={12} /> נסגרה
            </Badge>
          )}
          {forMe && q.status === "open" && <Badge variant="grad">ממתינה לך</Badge>}
        </div>
      </div>
      <p className="text-[14px] text-ink-800 leading-relaxed whitespace-pre-wrap">{q.body}</p>

      {q.answers.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ink-100 pt-3">
          {q.answers.map((a) => (
            <div key={a.id} className="flex items-start gap-2.5">
              <Avatar size="xs" tone="gold" crown initials={a.mentorInitials} />
              <div className="flex-1 min-w-0 rounded-[12px] bg-tint-warm/50 px-3 py-2">
                <div className="text-[11.5px] text-ink-600 flex items-center gap-1.5">
                  <b className="text-ink-900">{a.mentorName}</b>
                  <span className="text-ink-300">·</span>
                  <span dir="ltr">{WHEN.format(new Date(a.createdAt))}</span>
                </div>
                <p className="text-[13.5px] text-ink-900 leading-relaxed whitespace-pre-wrap mt-0.5">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {mentorSide && q.status !== "closed" && !mine && (
        <div className="border-t border-ink-100 pt-3">
          {!open && !state.ok ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" size="sm" onClick={() => setOpen(true)}>
                {alreadyAnswered ? "תשובה נוספת" : `לענות · +${ARENA_ANSWER_POINTS} נק׳`}
              </Button>
              {alreadyAnswered && <span className="text-[12px] text-ink-500">כבר ענית כאן - הנקודות נספרו פעם אחת.</span>}
            </div>
          ) : state.ok ? (
            <Alert variant="success">{state.info}</Alert>
          ) : (
            <form action={action} className="flex flex-col gap-2">
              <textarea
                name="body"
                required
                rows={4}
                maxLength={6000}
                autoFocus
                placeholder="התשובה שלך - היא תגיע לשואלת גם למייל."
                className="w-full rounded-[10px] border border-ink-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed focus:border-brand-purple outline-none"
              />
              {state.error && <Alert variant="danger">{state.error}</Alert>}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "שולחת…" : "פרסום התשובה"}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {(mine || role === "admin") && (
        <div className="flex items-center gap-3 text-[12px]">
          {mine && q.status !== "closed" && (
            <button type="button" disabled={busy} onClick={() => start(() => closeArenaQuestion(q.id).then(() => undefined))} className="text-ink-500 hover:text-ink-800 hover:underline">
              סגירת השאלה (קיבלתי מה שצריך)
            </button>
          )}
          {role === "admin" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm("למחוק את השאלה ואת התשובות שלה?")) start(() => deleteArenaQuestion(q.id).then(() => undefined));
              }}
              className="inline-flex items-center gap-1 text-[#B42318] hover:underline"
            >
              <Trash2 size={12} /> מחיקה (צוות)
            </button>
          )}
        </div>
      )}
    </article>
  );
}
