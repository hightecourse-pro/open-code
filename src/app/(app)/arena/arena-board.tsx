"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Bot, CheckCircle2, Lock, Megaphone, Pin, Star, Trash2 } from "lucide-react";
import { Alert, Avatar, Badge, Button } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import { cn } from "@/lib/utils";
import type { ArenaQuestion } from "@/lib/arena";
import { ARENA_ANSWER_POINTS, ARENA_HELPFUL_POINTS, ARENA_TOPICS, NUDGE_AFTER_HOURS, topicOf, type ArenaRole } from "@/lib/arena-shared";
import { answerArenaQuestion, closeArenaQuestion, deleteArenaQuestion, markHelpful, nudgeQuestion, replyFollowUp, togglePin, type ArenaFormState } from "./actions";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const RICH = "text-[14px] text-ink-800 leading-relaxed [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_a]:text-brand-purple [&_a]:underline [&_pre]:bg-ink-900 [&_pre]:text-white [&_pre]:rounded-[10px] [&_pre]:px-3 [&_pre]:py-2 [&_pre]:text-[12.5px] [&_pre]:leading-snug [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_code]:font-mono [&_img]:max-w-full [&_img]:rounded-[10px] [&_img]:border [&_img]:border-ink-200 [&_img]:my-1";
const EDITOR_TOOLS = ["bold", "ul", "ol", "link", "code", "image"] as const;

type Filter = "open" | "mine" | "ai" | "answered" | "all";

/** The board every one in the arena sees - filters differ by side. */
export function ArenaBoard({ questions, viewerId, role, focusId }: { questions: ArenaQuestion[]; viewerId: string; role: ArenaRole; focusId: string | null }) {
  const mentorSide = role !== "participant";
  // A focused question (from an email link) must be visible whatever the default filter.
  const [filter, setFilter] = useState<Filter>(() => (focusId ? "all" : mentorSide ? "open" : "mine"));
  const [topic, setTopic] = useState("");
  const [challenge, setChallenge] = useState("");
  // A question she just answered stays in place with its confirmation.
  const [pinned, setPinned] = useState<string[]>([]);
  const pin = (id: string) => setPinned((cur) => (cur.includes(id) ? cur : [...cur, id]));

  const counts = useMemo(
    () => ({
      open: questions.filter((q) => q.status === "open").length,
      mine: questions.filter((q) => q.authorId === viewerId).length,
      ai: questions.filter((q) => (q.aiOnly || q.topic === "ai") && q.status === "open").length,
      answered: questions.filter((q) => q.status !== "open").length,
      all: questions.length,
    }),
    [questions, viewerId]
  );
  const challengeChips = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const q of questions) {
      if (!q.challengeKey) continue;
      const cur = seen.get(q.challengeKey) ?? { label: `${q.challengeEmoji ?? ""} ${q.challengeShort ?? ""}`.trim(), n: 0 };
      cur.n++;
      seen.set(q.challengeKey, cur);
    }
    return [...seen].map(([key, v]) => ({ key, ...v }));
  }, [questions]);
  const topicChips = useMemo(() => ARENA_TOPICS.map((t) => ({ ...t, n: questions.filter((q) => q.topic === t.key).length })).filter((t) => t.n > 0), [questions]);

  const shown = useMemo(
    () =>
      questions.filter((q) => {
        if (pinned.includes(q.id)) return true;
        if (challenge && q.challengeKey !== challenge) return false;
        if (topic && q.topic !== topic) return false;
        if (filter === "all") return true;
        if (filter === "open") return q.status === "open";
        if (filter === "answered") return q.status !== "open";
        if (filter === "ai") return (q.aiOnly || q.topic === "ai") && q.status === "open";
        return q.authorId === viewerId;
      }),
    [questions, filter, viewerId, pinned, challenge, topic]
  );
  const worthReading = useMemo(() => questions.filter((q) => q.pinnedAt && (!challenge || q.challengeKey === challenge)).slice(0, 6), [questions, challenge]);

  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => document.getElementById(`q-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    return () => clearTimeout(t);
  }, [focusId]);

  const chips: { key: Filter; label: string }[] = mentorSide
    ? [
        { key: "open", label: `פתוחות (${counts.open})` },
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
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors", on ? "bg-brand-purple text-white border-brand-purple" : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple");
  const smallChip = (on: boolean) => cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", on ? "bg-ink-900 text-white border-ink-900" : "bg-white border-ink-300 text-ink-700 hover:border-ink-900");

  return (
    <section className="flex flex-col gap-3">
      {worthReading.length > 0 && (
        <div className="rounded-[16px] border border-[#F0B429]/50 bg-tint-warm/40 px-4 py-3">
          <div className="text-[12.5px] font-bold text-[#8C5E0E] flex items-center gap-1.5">
            <Star size={13} /> שווה לקרוא - תשובות שהמנטוריות הצמידו
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {worthReading.map((q) => (
              <li key={q.id} className="text-[13px]">
                <a href={`#q-${q.id}`} className="text-ink-900 hover:text-brand-purple hover:underline" onClick={() => setPinned((cur) => (cur.includes(q.id) ? cur : [...cur, q.id]))}>
                  {q.challengeEmoji} {q.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => setFilter(c.key)} aria-pressed={filter === c.key} className={chip(filter === c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      {(challengeChips.length > 1 || topicChips.length > 0) && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
          {challengeChips.length > 1 && (
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-ink-600">לפי אתגר:</span>
              <button type="button" onClick={() => setChallenge("")} aria-pressed={challenge === ""} className={smallChip(challenge === "")}>
                כל האתגרים
              </button>
              {challengeChips.map((c) => (
                <button key={c.key} type="button" onClick={() => setChallenge(challenge === c.key ? "" : c.key)} aria-pressed={challenge === c.key} className={smallChip(challenge === c.key)}>
                  {c.label} ({c.n})
                </button>
              ))}
            </span>
          )}
          {topicChips.length > 0 && (
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-ink-600">לפי נושא:</span>
              {topicChips.map((t) => (
                <button key={t.key} type="button" onClick={() => setTopic(topic === t.key ? "" : t.key)} aria-pressed={topic === t.key} className={smallChip(topic === t.key)}>
                  {t.emoji} {t.label} ({t.n})
                </button>
              ))}
            </span>
          )}
        </div>
      )}
      {shown.length === 0 && (
        <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm">
          {mentorSide ? "אין שאלות בסינון הזה. 🎉" : "עדיין אין שאלות כאן - השאלה הראשונה שלך תופיע למעלה."}
        </p>
      )}
      {shown.map((q) => (
        <QuestionCard key={q.id} q={q} viewerId={viewerId} role={role} focused={q.id === focusId} onAnswered={pin} />
      ))}
    </section>
  );
}

function QuestionCard({ q, viewerId, role, focused, onAnswered }: { q: ArenaQuestion; viewerId: string; role: ArenaRole; focused: boolean; onAnswered: (id: string) => void }) {
  const mentorSide = role !== "participant";
  const mine = q.authorId === viewerId;
  const alreadyAnswered = q.answers.some((a) => a.authorId === viewerId && a.authorRole === "mentor");
  const helped = q.answers.some((a) => a.helpfulAt);
  const [state, action, pending] = useActionState<ArenaFormState, FormData>(async (prev, fd) => {
    const r = await answerArenaQuestion(q.id, prev, fd);
    if (r.ok) onAnswered(q.id);
    return r;
  }, {});
  const [fuState, fuAction, fuPending] = useActionState<ArenaFormState, FormData>(async (prev, fd) => {
    const r = await replyFollowUp(q.id, prev, fd);
    if (r.ok) onAnswered(q.id);
    return r;
  }, {});
  const [busy, start] = useTransition();
  const [note, setNote] = useState<ArenaFormState | null>(null);
  const [open, setOpen] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const topic = topicOf(q.topic);
  const run = (fn: () => Promise<ArenaFormState>) => {
    setNote(null);
    start(async () => {
      const r = await fn();
      if (r.error || r.info) setNote(r);
      if (r.ok) onAnswered(q.id);
    });
  };
  return (
    <article
      id={`q-${q.id}`}
      className={cn(
        "bg-white border rounded-[18px] p-4 md:p-5 shadow-sm flex flex-col gap-3",
        focused ? "border-brand-purple ring-2 ring-brand-purple/20" : q.pinnedAt ? "border-[#F0B429]/60" : "border-ink-200"
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
            {q.challengeShort && (
              <>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-tint-pink text-brand-pink-deep px-2 py-px font-bold">
                  {q.challengeEmoji} אתגר {q.challengeShort}
                </span>
              </>
            )}
            {topic && (
              <>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 text-ink-700 px-2 py-px font-semibold">
                  {topic.emoji} {topic.label}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {q.pinnedAt && (
            <Badge variant="warm">
              <Star size={12} /> שווה לקרוא
            </Badge>
          )}
          {q.isPrivate && (
            <Badge variant="gray">
              <Lock size={12} /> פרטית
            </Badge>
          )}
          {q.aiOnly && (
            <Badge variant="indigo">
              <Bot size={12} /> AI
            </Badge>
          )}
          {q.status === "open" && (q.stale && mentorSide ? <Badge variant="pink">פתוחה מעל {NUDGE_AFTER_HOURS} שעות</Badge> : <Badge variant="pink">פתוחה</Badge>)}
          {q.status === "answered" && (
            <Badge variant="mint">
              <CheckCircle2 size={12} /> נענתה
            </Badge>
          )}
          {q.status === "closed" && <Badge variant="gray">{helped ? "עזר לה ✓" : "נסגרה"}</Badge>}
        </div>
      </div>
      <div className={RICH} dangerouslySetInnerHTML={{ __html: q.body }} />

      {q.answers.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ink-100 pt-3">
          {q.answers.map((a) =>
            a.authorRole === "asker" ? (
              <div key={a.id} className="flex items-start gap-2.5">
                <Avatar size="xs" initials={a.authorInitials} />
                <div className="flex-1 min-w-0 rounded-[12px] bg-tint-purple/30 px-3 py-2">
                  <div className="text-[11.5px] text-ink-600 flex items-center gap-1.5">
                    <b className="text-ink-900">{a.authorName}</b>
                    <span className="text-ink-300">·</span>
                    <span>שאלת המשך</span>
                    <span className="text-ink-300">·</span>
                    <span dir="ltr">{WHEN.format(new Date(a.createdAt))}</span>
                  </div>
                  <div className={cn(RICH, "mt-0.5")} dangerouslySetInnerHTML={{ __html: a.body }} />
                </div>
              </div>
            ) : (
              <div key={a.id} className="flex items-start gap-2.5">
                <Avatar size="xs" tone="gold" crown initials={a.authorInitials} />
                <div className={cn("flex-1 min-w-0 rounded-[12px] px-3 py-2", a.helpfulAt ? "bg-tint-mint/60 border border-success/30" : "bg-tint-warm/50")}>
                  <div className="text-[11.5px] text-ink-600 flex items-center gap-1.5 flex-wrap">
                    <b className="text-ink-900">{a.authorName}</b>
                    <span className="text-ink-300">·</span>
                    <span dir="ltr">{WHEN.format(new Date(a.createdAt))}</span>
                    {a.helpfulAt && <span className="ms-auto text-success font-bold">עזר לי ✓ (+{ARENA_HELPFUL_POINTS})</span>}
                    {mine && !a.helpfulAt && !helped && (
                      <button type="button" disabled={busy} onClick={() => run(() => markHelpful(a.id))} className="ms-auto rounded-full bg-white border border-success/50 text-success text-[11.5px] font-bold px-2.5 py-0.5 hover:bg-tint-mint">
                        עזר לי ✓
                      </button>
                    )}
                  </div>
                  <div className={cn(RICH, "mt-0.5")} dangerouslySetInnerHTML={{ __html: a.body }} />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* the mentor's answer */}
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
              <RichTextEditor id={`answer-${q.id}`} name="body" tools={[...EDITOR_TOOLS]} compact placeholder="התשובה שלך - היא תגיע לשואלת גם למייל. אפשר קוד וצילום מסך." />
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

      {/* the asker's follow-up */}
      {mine && q.status !== "closed" && q.answers.some((a) => a.authorRole === "mentor") && (
        <div className="border-t border-ink-100 pt-3">
          {!fuOpen && !fuState.ok ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setFuOpen(true)}>
              שאלת המשך באותו שרשור
            </Button>
          ) : fuState.ok ? (
            <Alert variant="success">{fuState.info}</Alert>
          ) : (
            <form action={fuAction} className="flex flex-col gap-2">
              <RichTextEditor id={`followup-${q.id}`} name="body" tools={[...EDITOR_TOOLS]} compact placeholder="מה עדיין לא ברור, או מה קרה כשניסית." />
              {fuState.error && <Alert variant="danger">{fuState.error}</Alert>}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={fuPending}>
                  {fuPending ? "שולחת…" : "פרסום שאלת ההמשך"}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setFuOpen(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {note?.error && <Alert variant="danger">{note.error}</Alert>}
      {note?.ok && note.info && <Alert variant="success">{note.info}</Alert>}

      <div className="flex items-center gap-3 text-[12px] flex-wrap">
        {mine && q.status === "open" && q.stale && (
          <button type="button" disabled={busy} onClick={() => run(() => nudgeQuestion(q.id))} className="inline-flex items-center gap-1 font-bold text-brand-pink-deep hover:underline">
            <Megaphone size={12} /> לדחוף לכל המנטוריות
          </button>
        )}
        {mine && q.status !== "closed" && (
          <button type="button" disabled={busy} onClick={() => run(() => closeArenaQuestion(q.id))} className="text-ink-500 hover:text-ink-800 hover:underline">
            סגירת השאלה (קיבלתי מה שצריך)
          </button>
        )}
        {mentorSide && q.answers.some((a) => a.authorRole === "mentor") && (
          <button type="button" disabled={busy} onClick={() => run(() => togglePin(q.id))} className="inline-flex items-center gap-1 text-[#8C5E0E] hover:underline">
            <Pin size={12} /> {q.pinnedAt ? "להסיר מ״שווה לקרוא״" : "להצמיד כ״שווה לקרוא״"}
          </button>
        )}
        {role === "admin" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("למחוק את השאלה ואת התשובות שלה?")) run(() => deleteArenaQuestion(q.id));
            }}
            className="inline-flex items-center gap-1 text-[#B42318] hover:underline"
          >
            <Trash2 size={12} /> מחיקה (צוות)
          </button>
        )}
      </div>
    </article>
  );
}
