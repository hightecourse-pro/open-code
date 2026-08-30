"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { createMemberRequest } from "@/app/(app)/requests/actions";

export interface MyRequestRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  handled_at: string | null;
  /** The admin who answered — "מי מהאדמיניות ענתה". */
  handledByName: string | null;
}

const REQ_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * The floating "הודעה למערכת" button (PM ask): always in reach, opens a tiny
 * form, and the answer comes back to her in chat. The popup also lists her
 * recent requests — answered ones say WHO answered, and a fresh answer puts
 * a ✓ on the floating button so she notices.
 */
export function MemberRequestWidget({ requests = [] }: { requests?: MyRequestRow[] }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Anywhere in the app can open this widget with a ready-made subject —
  // "יש לך שאלה על המשרה?" on the apply screen dispatches it (30/8).
  const [subjectPrefill, setSubjectPrefill] = useState("");
  useEffect(() => {
    const onOpen = (e: Event) => {
      setSubjectPrefill((e as CustomEvent<{ subject?: string }>).detail?.subject ?? "");
      setSent(false);
      setOpen(true);
    };
    window.addEventListener("oc:open-request", onOpen);
    return () => window.removeEventListener("oc:open-request", onOpen);
  }, []);
  // A request answered in the last week — worth a nudge on the button.
  // (now is captured once per mount — render must stay pure.)
  const [now] = useState(() => Date.now());
  const freshAnswer = requests.some(
    (r) =>
      r.status === "handled" &&
      r.handled_at &&
      now - new Date(r.handled_at).getTime() < 7 * 24 * 3600 * 1000
  );
  // The in-site notification (the owner, 30/8): the newest answer pulses on
  // the button until she OPENS the popup once; "seen" is remembered locally
  // per answer time, so a new answer starts pulsing again.
  const latestAnswerAt = requests.reduce(
    (acc, r) => (r.status === "handled" && r.handled_at && r.handled_at > acc ? r.handled_at : acc),
    ""
  );
  const [seenAnswerAt, setSeenAnswerAt] = useState<string>(() => {
    try {
      return window.localStorage.getItem("oc:req-seen") ?? "";
    } catch {
      return "";
    }
  });
  const unseenAnswer = freshAnswer && latestAnswerAt > seenAnswerAt;
  function markSeen() {
    setSeenAnswerAt(latestAnswerAt);
    try {
      window.localStorage.setItem("oc:req-seen", latestAnswerAt);
    } catch {
      /* private mode — the pulse just stays for the visit */
    }
  }

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-2 pointer-events-none" dir="rtl">
      {open && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-ink-200 rounded-[16px] shadow-lg p-4 flex flex-col gap-3 pointer-events-auto">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-[15px] text-ink-1000">
              הודעה או בקשה לצוות 💜
            </span>
            <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-900">
              <X size={15} />
            </button>
          </div>

          {sent ? (
            <Alert variant="success">
              קיבלנו! נחזור אלייך כאן בצ&apos;אט ברגע שנטפל 💜
            </Alert>
          ) : (
            <form
              action={(fd) =>
                start(async () => {
                  const res = await createMemberRequest(fd);
                  if (res?.error) setError(res.error);
                  else {
                    setError(null);
                    setSent(true);
                  }
                })
              }
              className="flex flex-col gap-2.5"
            >
              {error && <Alert variant="danger">{error}</Alert>}
              <Field label="נושא" htmlFor="req-subject">
                <Input key={subjectPrefill} id="req-subject" name="subject" required maxLength={120} placeholder="על מה מדובר?" defaultValue={subjectPrefill} />
              </Field>
              <Field label="מה תרצי לספר לנו?" htmlFor="req-body">
                <Textarea id="req-body" name="body" required rows={3} placeholder="בקשה, שאלה, רעיון — הכול מתקבל 💜" />
              </Field>
              <Button type="submit" size="sm" disabled={pending} className="self-start">
                {pending ? "שולח…" : "שליחה לצוות"}
              </Button>
            </form>
          )}

          {/* Her recent requests — answered ones name the admin who answered. */}
          {requests.length > 0 && (
            <div className="border-t border-ink-100 pt-2.5 flex flex-col gap-1.5">
              <div className="text-[11.5px] font-bold text-ink-400 uppercase tracking-wide">
                הפניות האחרונות שלך
              </div>
              {requests.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="flex-1 min-w-0 truncate text-ink-900">{r.subject}</span>
                  {r.status === "handled" ? (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-tint-mint text-success px-2 py-px text-[11px] font-bold">
                      ✓ {r.handledByName ? `ענתה ${r.handledByName}` : "נענתה"}
                      {r.handled_at ? ` · ${REQ_DATE.format(new Date(r.handled_at))}` : ""}
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-tint-purple text-brand-purple px-2 py-px text-[11px] font-bold">
                      בטיפול
                    </span>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-ink-400">התשובה המלאה מחכה לך בצ&apos;אטים 💜</p>
            </div>
          )}
        </div>
      )}

      {/* Launch-period nudge (the owner, 30/8): a drawn arrow, big and right
          beside the widget button, pointing at it. */}
      {!open && (
        <div className="flex flex-col items-start gap-0 pointer-events-none select-none -ms-2">
          <span className="bg-white border border-[#DDC9EC] text-ink-900 text-[12px] font-semibold rounded-full px-3.5 py-1.5 shadow-md text-center max-w-[250px]">
            הקהילה בהרצה 🚀 מצאת באג? זה הזמן לדווח לנו
          </span>
          <svg
            aria-hidden
            width="46"
            height="52"
            viewBox="0 0 46 52"
            fill="none"
            className="animate-bounce ms-3 -mt-0.5"
          >
            <path
              d="M34 4 C 20 12, 12 24, 13 38"
              stroke="#E0418D"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M5 32 L13 44 L23 35"
              stroke="#E0418D"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}

      {/* An UNSEEN answer announces itself — a label + pulse, not a quiet ✓
          (the owner, 30/8: "צריך להיות נוטיפיקציה גם באתר לא רק במייל"). */}
      {unseenAnswer && !open && (
        <button
          type="button"
          onClick={() => {
            markSeen();
            setOpen(true);
          }}
          className="font-display font-semibold text-[12.5px] px-3.5 py-2 rounded-full bg-white text-brand-purple border-[1.5px] border-brand-purple shadow-md animate-bounce pointer-events-auto"
        >
          יש לך תשובה מהצוות 💜
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (unseenAnswer) markSeen();
          setOpen((v) => !v);
          if (sent) setSent(false);
        }}
        aria-expanded={open}
        className="relative inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2.5 rounded-full bg-brand-gradient text-white shadow-glow-pink hover:opacity-95 transition-opacity pointer-events-auto"
      >
        <MessageSquarePlus size={15} /> יש לך בקשה?
        {freshAnswer && !open && (
          <span
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white text-success text-[11px] font-black"
            title="ענו לך על פנייה — פתחי לפרטים"
          >
            ✓
          </span>
        )}
        {unseenAnswer && !open && (
          <span className="absolute -top-1 -end-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-pink-deep opacity-60" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-brand-pink-deep border-2 border-white" />
          </span>
        )}
      </button>
    </div>
  );
}
