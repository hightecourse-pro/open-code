"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { finishQuiz, markSyllabusDownload, saveAnswer, setPlacement, startQuiz, type SignupStatus } from "./actions";
import { QUESTIONS, TRACKS, type Recommendation } from "./questions";
import { H, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, contactMailto } from "./theme";

/*
  The quiz itself, styled after the Hightecourse syllabus print language:
  navy headlines, yellow accents, light-gray option rows like the catalog's
  course list, the rotated yellow circle badge on the result - and no emojis.
*/
type Step = "intro" | "details" | "questions" | "result" | "done";

/*
  Progress survives a page reload (a redeploy mid-session, a phone that
  evicted the tab, an accidental refresh): every step is mirrored into
  sessionStorage and restored on mount, so she lands back on the same
  question instead of the intro.
*/
const STORAGE_KEY = "hightecourse-ai-quiz-v1";

interface Saved {
  step: Step;
  firstName: string;
  lastName: string;
  email: string;
  signupStatus: SignupStatus | null;
  subId: string | null;
  qIndex: number;
  answers: Record<number, number>;
  rec: Recommendation | null;
}

/*
  A failed action call must never escape a transition: React 19 hands such an
  error to the nearest error boundary, which replaces the whole page with
  "This page couldn't load" (what the owner hit at the end of the quiz, 20/10).
  A call that fails because the site was redeployed under her ("Server Action
  not found") gets ONE automatic reload - progress is in sessionStorage, so she
  lands back on the same step with fresh code. Anything else becomes an inline
  "try again".
*/
const RELOADED_FLAG = `${STORAGE_KEY}:reloaded`;

function isStaleDeploymentError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /UnrecognizedActionError|was not found on the server|Failed to find Server Action/i.test(text);
}

function messageForActionError(err: unknown): string {
  if (isStaleDeploymentError(err)) {
    try {
      if (!sessionStorage.getItem(RELOADED_FLAG)) {
        sessionStorage.setItem(RELOADED_FLAG, "1");
        window.location.reload();
        return "העמוד התעדכן - טוענות אותו מחדש...";
      }
    } catch {
      /* no storage - fall through to the plain message */
    }
  }
  return "החיבור נקטע לרגע - נסי שוב.";
}

function clearReloadedFlag() {
  try {
    sessionStorage.removeItem(RELOADED_FLAG);
  } catch {
    /* ignore */
  }
}

function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (!s || typeof s !== "object") return null;
    if (!["details", "questions", "result"].includes(s.step)) return null;
    if ((s.step === "questions" || s.step === "result") && !s.subId) return null;
    if (s.step === "result" && s.rec !== "advanced" && s.rec !== "foundations") return null;
    if (typeof s.qIndex !== "number" || s.qIndex < 0 || s.qIndex >= QUESTIONS.length) s.qIndex = 0;
    if (!s.answers || typeof s.answers !== "object") s.answers = {};
    return s;
  } catch {
    return null;
  }
}

/** The syllabus' rotated yellow circle badge ("מתקדם מאוד" / "מהבסיס - כולל תרגול"). */
function CircleBadge({ text }: { text: string }) {
  return (
    <div
      className="mx-auto flex items-center justify-center text-center font-black leading-tight"
      style={{
        width: 118,
        height: 118,
        borderRadius: "50%",
        border: `3px solid ${H.yellow}`,
        color: H.navy,
        transform: "rotate(-8deg)",
        fontSize: 17,
        padding: 12,
        background: H.white,
      }}
    >
      {text}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-xl bg-white p-6 sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
      {children}
    </div>
  );
}

function NavyButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: H.navy, borderRadius: 10 }}
    >
      {children}
    </button>
  );
}

/** A light-gray selectable row, like the course rows on the catalog cover. */
function OptionRow({ selected, onClick, children, disabled, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="relative w-full px-5 py-3.5 text-start text-[15.5px] font-medium transition-colors disabled:opacity-60"
      style={{
        background: selected ? H.white : "#EEF2F6",
        border: selected ? `2px solid ${H.navy}` : "2px solid transparent",
        borderRadius: 10,
        color: H.navy,
      }}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2"
          style={{ insetInlineStart: 0, width: 5, height: "60%", background: H.yellow, borderRadius: 3 }}
        />
      )}
      {children}
    </button>
  );
}

const fieldCls = "w-full bg-white px-4 py-3 text-[16px] outline-none transition-colors";
const fieldStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink } as const;

export function Quiz() {
  const [step, setStep] = useState<Step>("intro");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [signupStatus, setSignupStatus] = useState<SignupStatus | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [subId, setSubId] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [placement, setPlacementState] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Restore once on mount (effect, not initializer - the server render must
  // match the first client render), then mirror every change back.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const s = readSaved();
    if (!s) return;
    setFirstName(s.firstName ?? "");
    setLastName(s.lastName ?? "");
    setEmail(s.email ?? "");
    setSignupStatus(s.signupStatus ?? null);
    setSubId(s.subId ?? null);
    setQIndex(s.qIndex);
    setAnswers(s.answers);
    setRec(s.rec ?? null);
    setStep(s.step);
  }, []);

  useEffect(() => {
    if (!restored.current || step === "intro") return;
    try {
      if (step === "done") {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      const s: Saved = { step, firstName, lastName, email, signupStatus, subId, qIndex, answers, rec };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage blocked - the quiz still works, just without resume */
    }
  }, [step, firstName, lastName, email, signupStatus, subId, qIndex, answers, rec]);

  const errorBox = error && (
    <p role="alert" className="px-4 py-3 text-[14.5px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }}>
      {error}
    </p>
  );

  /* ── intro ─────────────────────────────────────────── */
  if (step === "intro") {
    return (
      <Panel>
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-[24px] sm:text-[26px] font-black leading-tight" style={{ color: H.navy }}>
              שני מסלולים. אותם נושאים. קצב אחר לגמרי.
            </h2>
            <span className="block h-[4px] w-24" style={{ background: H.yellow, borderRadius: 2 }} />
          </div>
          <div className="space-y-3">
            <div className="px-5 py-4" style={{ background: "#EEF2F6", borderRadius: 10 }}>
              <p className="text-[16px] font-bold" style={{ color: H.navy }}>
                המסלול המתקדם מאוד
              </p>
              <p className="mt-1 text-[14.5px] leading-relaxed" style={{ color: H.muted }}>
                למי שכבר עובדת עם AI בפיתוח ומעדיפה להספיק הרבה — בקצב מהיר, בלי לעצור לתרגול.
              </p>
            </div>
            <div className="px-5 py-4" style={{ background: "#EEF2F6", borderRadius: 10 }}>
              <p className="text-[16px] font-bold" style={{ color: H.navy }}>
                המסלול מהבסיס — כולל תרגול
              </p>
              <p className="mt-1 text-[14.5px] leading-relaxed" style={{ color: H.muted }}>
                למי שרוצה ללמוד פיתוח AI מהתחלה ולבנות בסיס חזק — צעד אחר צעד, עם תרגול מעשי.
              </p>
            </div>
          </div>
          <p className="text-[15px]" style={{ color: H.ink }}>
            חמש שאלות קצרות יעזרו לך לדעת איזה מסלול ירגיש לך בדיוק במידה.
          </p>
          <NavyButton onClick={() => setStep("details")}>בואי נתחיל</NavyButton>
          <p className="text-center text-[13px]" style={{ color: H.muted }}>
            פחות מדקה, בלי שום התחייבות
          </p>
        </div>
      </Panel>
    );
  }

  /* ── details ───────────────────────────────────────── */
  if (step === "details") {
    const submit = () => {
      setError(null);
      if (firstName.trim().length < 2) return setError("איך קוראים לך? שם פרטי בבקשה.");
      if (lastName.trim().length < 2) return setError("ושם המשפחה?");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError("הכתובת לא נראית תקינה - בדקי אותה שוב.");
      if (!signupStatus) return setError("ספרי לנו - כבר נרשמת לקורס, או מתכננת להירשם?");
      start(async () => {
        try {
          const r = await startQuiz({ email, firstName, lastName, signupStatus, website });
          if (!r.ok) return setError(r.error);
          clearReloadedFlag();
          setSubId(r.id);
          setStep("questions");
        } catch (err) {
          setError(messageForActionError(err));
        }
      });
    };
    return (
      <Panel>
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-[22px] font-black" style={{ color: H.navy }}>
              נעים להכיר
            </h2>
            <span className="block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
                שם פרטי
              </label>
              <input className={fieldCls} style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
                שם משפחה
              </label>
              <input className={fieldCls} style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
              מייל
            </label>
            <input className={fieldCls} style={fieldStyle} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {/* Honeypot - hidden from real people */}
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-[13.5px] font-bold" style={{ color: H.navy }}>
              איפה את עומדת עם הקורס?
            </p>
            {(
              [
                { v: "registered", label: "אני כבר רשומה לקורס" },
                { v: "planning", label: "מתכוונת להירשם בהקדם" },
              ] as { v: SignupStatus; label: string }[]
            ).map((o) => (
              <OptionRow key={o.v} selected={signupStatus === o.v} onClick={() => setSignupStatus(o.v)} testId={`status-${o.v}`}>
                {o.label}
              </OptionRow>
            ))}
          </div>
          {errorBox}
          <NavyButton onClick={submit} disabled={pending}>
            {pending ? "שולחות..." : "לשאלות"}
          </NavyButton>
        </div>
      </Panel>
    );
  }

  /* ── questions ─────────────────────────────────────── */
  if (step === "questions") {
    const q = QUESTIONS[qIndex];
    const pick = (optIdx: number) => {
      const score = q.options[optIdx].score;
      setAnswers((a) => ({ ...a, [qIndex]: optIdx }));
      // Fire-and-forget save; a rejection must never bubble out of the page.
      if (subId) saveAnswer(subId, qIndex, score).catch(() => {});
      if (qIndex < QUESTIONS.length - 1) {
        const next = qIndex + 1; // fixed target: a double-tap can't skip ahead
        setTimeout(() => setQIndex(next), 180);
      } else {
        setError(null);
        start(async () => {
          if (!subId) return setError("משהו השתבש - נסי להתחיל מחדש.");
          try {
            const r = await finishQuiz(subId);
            if (!r.ok) return setError(r.error);
            clearReloadedFlag();
            setRec(r.recommendation);
            setStep("result");
          } catch (err) {
            // She stays on the last question with her answer marked; one more
            // tap on it retries.
            setError(messageForActionError(err));
          }
        });
      }
    };
    return (
      <Panel>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-black" style={{ color: H.navy }}>
              שאלה {qIndex + 1} מתוך {QUESTIONS.length}
            </span>
            {qIndex > 0 && (
              <button type="button" className="text-[13.5px] font-medium underline" style={{ color: H.muted }} onClick={() => setQIndex((i) => i - 1)}>
                לשאלה הקודמת
              </button>
            )}
          </div>
          <div className="h-[5px] w-full overflow-hidden" style={{ background: "#E3E9EF", borderRadius: 3 }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%`, background: H.yellow, borderRadius: 3 }}
            />
          </div>
          <h2 className="text-[20px] font-black leading-snug" style={{ color: H.navy }}>
            {q.title}
          </h2>
          {q.hint && (
            <p className="text-[13.5px]" style={{ color: H.muted }}>
              {q.hint}
            </p>
          )}
          <div className="space-y-2.5">
            {q.options.map((o, i) => (
              <OptionRow key={i} selected={answers[qIndex] === i} onClick={() => pick(i)} disabled={pending} testId={`opt-${i}`}>
                {o.label}
              </OptionRow>
            ))}
          </div>
          {errorBox}
          {pending && (
            <p className="text-center text-[14.5px] font-medium" style={{ color: H.muted }}>
              מכינות את ההמלצה שלך...
            </p>
          )}
        </div>
      </Panel>
    );
  }

  /* ── result ────────────────────────────────────────── */
  if (step === "result" && rec) {
    const track = TRACKS[rec];
    const choose = (wants: boolean) => {
      setPlacementState(wants);
      if (subId) setPlacement(subId, wants).catch(() => {});
      setStep("done");
    };
    return (
      <Panel>
        <div className="space-y-6">
          <CircleBadge text={track.badge} />
          <div className="space-y-2 text-center">
            <h2 className="text-[23px] font-black leading-snug" style={{ color: H.navy }}>
              המסלול שמתאים לך
            </h2>
            <span className="mx-auto block h-[4px] w-20" style={{ background: H.yellow, borderRadius: 2 }} />
            <p className="pt-1 text-[16px] font-bold" style={{ color: H.ink }}>
              {track.name}
            </p>
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: H.ink }}>
            {track.blurb}
          </p>
          <a
            href={track.syllabus}
            download={track.file}
            onClick={() => subId && markSyllabusDownload(subId).catch(() => {})}
            className="block w-full px-6 py-3.5 text-center text-[16px] font-black transition-opacity hover:opacity-90"
            style={{ background: H.yellow, color: H.navyDeep, borderRadius: 10 }}
          >
            להורדת הסילבוס המלא
          </a>
          <div className="space-y-3 pt-5" style={{ borderTop: `1.5px solid ${H.line}` }}>
            <p className="text-center text-[15.5px] font-black" style={{ color: H.navy }}>
              רוצה שנשבץ אותך למסלול הזה?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => choose(true)}
                className="px-4 py-3 text-[15.5px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: H.navy, borderRadius: 10 }}
              >
                כן, שבצו אותי
              </button>
              <button
                type="button"
                onClick={() => choose(false)}
                className="px-4 py-3 text-[15.5px] font-bold transition-colors"
                style={{ border: `2px solid ${H.navy}`, color: H.navy, background: H.white, borderRadius: 10 }}
              >
                עוד מתלבטת
              </button>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  /* ── done ──────────────────────────────────────────── */
  const track = rec ? TRACKS[rec] : null;
  return (
    <Panel>
      <div className="space-y-5 text-center">
        <h2 className="text-[23px] font-black" style={{ color: H.navy }}>
          {placement ? "קיבלנו. שומרות לך מקום" : "תודה, הפרטים אצלנו"}
        </h2>
        <span className="mx-auto block h-[4px] w-20" style={{ background: H.yellow, borderRadius: 2 }} />
        <p className="text-[15px] leading-relaxed" style={{ color: H.ink }}>
          {placement
            ? "נחזור אלייך בהקדם עם כל פרטי המסלול וההרשמה. מחכות לראות אותך בקורס."
            : "קחי את הזמן עם הסילבוס, ואם עולה שאלה - אנחנו כאן לכל התלבטות."}
        </p>
        {track && (
          <a
            href={track.syllabus}
            download={track.file}
            onClick={() => subId && markSyllabusDownload(subId).catch(() => {})}
            className="inline-block text-[14.5px] font-bold underline"
            style={{ color: H.navy }}
          >
            להורדת הסילבוס שוב
          </a>
        )}
        <div className="px-4 py-4 text-[14.5px]" style={{ background: "#EEF2F6", borderRadius: 10, color: H.ink }}>
          <p className="font-black" style={{ color: H.navy }}>
            מדברות איתנו
          </p>
          <p className="mt-1">
            <a href={CONTACT_PHONE_HREF} className="font-medium underline" dir="ltr">
              {CONTACT_PHONE}
            </a>
            {"  ·  "}
            <a href={contactMailto} className="font-medium underline" dir="ltr">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </Panel>
  );
}
