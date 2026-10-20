"use client";

import { useEffect, useRef, useState } from "react";
import { COURSE_TITLE, QUESTIONS, TRACKS, reasonFor, scoresOf, type Recommendation } from "./questions";
import { H, CONTACT_EMAIL, contactMailto } from "./theme";

/*
  The quiz itself, in the Hightecourse syllabus' print language: navy
  headlines, a yellow underline, light-gray option rows, the rotated yellow
  circle badge on the result - and no emojis.

  Robustness rules (the owner hit "משהו השתבש" after the second question on
  her own browser while the automated run passed, 20/10):
  - Every server call is a plain fetch to /api/ai-course/* inside try/catch.
    No server actions: those run through the app router and a filtered or
    stale response can take the whole page down.
  - Each step is its own keyed panel, so moving on unmounts the previous one
    whole; React never edits a text node that a browser extension or an
    auto-translate may have rewrapped (the classic "removeChild" crash).
  - The whole state is mirrored into sessionStorage and restored on mount, so
    a reload (a redeploy, a phone that evicted the tab) lands her back on the
    same question. The page is marked notranslate as well.
  - Window errors and unhandled rejections are reported to the admin screen.
*/
type Step = "intro" | "details" | "questions" | "result" | "done";
type SignupStatus = "registered" | "planning";

interface QuizState {
  step: Step;
  firstName: string;
  lastName: string;
  email: string;
  signupStatus: SignupStatus | null;
  subId: string | null;
  qIndex: number;
  /** question index -> picked option index */
  answers: Record<number, number>;
  rec: Recommendation | null;
  placement: boolean | null;
}

const INITIAL: QuizState = {
  step: "intro",
  firstName: "",
  lastName: "",
  email: "",
  signupStatus: null,
  subId: null,
  qIndex: 0,
  answers: {},
  rec: null,
  placement: null,
};

const STORAGE_KEY = "hightecourse-ai-quiz-v2";
const RETRY = "החיבור נקטע לרגע - נסי שוב.";

/** A JSON call to the quiz API. Anything that is not a JSON answer (a filter
 *  page, a 404 from an old deployment, a dropped connection) throws - into
 *  the caller's try/catch, never further. */
async function api<T extends { ok: boolean }>(action: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`/api/ai-course/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const type = r.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error(`api ${action}: ${r.status} ${type.slice(0, 40) || "no content-type"}`);
  return (await r.json()) as T;
}

/** Fire-and-forget report of a client-side failure; must never throw. */
function report(kind: "client_error" | "api_error", fields: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ kind, href: location.href, ...fields });
    fetch("/api/ai-course/report", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function readSaved(): Partial<QuizState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<QuizState>;
    if (!s || typeof s !== "object") return null;
    if (!s.step || !["details", "questions", "result"].includes(s.step)) return null;
    if ((s.step === "questions" || s.step === "result") && !s.subId) return null;
    if (s.step === "result" && s.rec !== "advanced" && s.rec !== "foundations") return null;
    if (typeof s.qIndex !== "number" || s.qIndex < 0 || s.qIndex >= QUESTIONS.length) s.qIndex = 0;
    if (!s.answers || typeof s.answers !== "object") s.answers = {};
    return s;
  } catch {
    return null;
  }
}

/** The syllabus' rotated yellow circle ("מתקדם מאוד" / "מהבסיס - כולל תרגול"). */
function CircleBadge({ lines }: { lines: string[] }) {
  return (
    <div
      data-testid="track-badge"
      className="mx-auto flex flex-col items-center justify-center text-center font-black leading-tight"
      style={{ width: 124, height: 124, borderRadius: "50%", background: H.yellow, color: H.navy, transform: "rotate(-10deg)", fontSize: 17, padding: 12, boxShadow: "0 6px 18px rgba(0,72,120,0.12)" }}
    >
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
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

function Heading({ children, size = 22, center }: { children: React.ReactNode; size?: number; center?: boolean }) {
  return (
    <div className={`space-y-2${center ? " text-center" : ""}`}>
      <h2 className="font-black leading-tight" style={{ color: H.navy, fontSize: size }}>
        {children}
      </h2>
      <span className={`block h-[4px] w-16${center ? " mx-auto" : ""}`} style={{ background: H.yellow, borderRadius: 2 }} />
    </div>
  );
}

function NavyButton({ children, onClick, disabled, type = "button", testId }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; testId?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
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
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="relative w-full px-5 py-3.5 text-start text-[15.5px] font-medium transition-colors disabled:opacity-60"
      style={{ background: selected ? H.white : H.row, border: selected ? `2px solid ${H.navy}` : "2px solid transparent", borderRadius: 10, color: H.navy }}
    >
      {selected && <span aria-hidden className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineStart: 0, width: 5, height: "60%", background: H.yellow, borderRadius: 3 }} />}
      <span>{children}</span>
    </button>
  );
}

function ErrorBox({ text, onRetry, retryLabel }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="space-y-2 px-4 py-3 text-[14.5px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }} data-testid="inline-error">
      <p>{text}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="px-4 py-2 text-[14px] font-bold text-white" style={{ background: H.navy, borderRadius: 8 }} data-testid="retry">
          {retryLabel ?? "לנסות שוב"}
        </button>
      )}
    </div>
  );
}

const fieldCls = "w-full bg-white px-4 py-3 text-[16px] outline-none transition-colors";
const fieldStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink } as const;
const labelCls = "block text-[13.5px] font-bold";

/** The syllabus download, used on the result and the thank-you screens. */
function SyllabusLink({ rec, subId, big }: { rec: Recommendation; subId: string | null; big?: boolean }) {
  const track = TRACKS[rec];
  const onClick = () => {
    if (subId) api("download", { id: subId }).catch(() => {});
  };
  if (big) {
    return (
      <a
        href={track.syllabus}
        download={track.file}
        onClick={onClick}
        data-testid="syllabus-link"
        className="block w-full px-6 py-3.5 text-center text-[16px] font-black transition-opacity hover:opacity-90"
        style={{ background: H.yellow, color: H.navyDeep, borderRadius: 10, textDecoration: "none" }}
      >
        להורדת הסילבוס המלא
      </a>
    );
  }
  return (
    <a href={track.syllabus} download={track.file} onClick={onClick} data-testid="syllabus-link" className="inline-block text-[14.5px] font-bold underline" style={{ color: H.navy }}>
      להורדת הסילבוס שוב
    </a>
  );
}

export function Quiz() {
  const [st, setSt] = useState<QuizState>(INITIAL);
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useRef(false);
  const stRef = useRef(st);
  useEffect(() => {
    stRef.current = st;
  }, [st]);
  const patch = (p: Partial<QuizState>) => setSt((s) => ({ ...s, ...p }));

  // Restore once on mount (deferred a tick: the server render must match the
  // first client render), then mirror every change back.
  useEffect(() => {
    const saved = readSaved();
    const t = setTimeout(() => {
      if (saved) setSt((s) => ({ ...s, ...saved }));
      hydrated.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated.current || st.step === "intro") return;
    try {
      if (st.step === "done") sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch {
      /* storage blocked - the quiz still works, just without resume */
    }
  }, [st]);

  // Whatever breaks in the browser is reported with the step she was on.
  useEffect(() => {
    const where = () => `${stRef.current.step}#${stRef.current.qIndex + 1}`;
    const onError = (e: ErrorEvent) => report("client_error", { step: where(), subId: stRef.current.subId, message: `${e.message ?? "error"} @ ${e.filename ?? "?"}:${e.lineno ?? 0}`, stack: e.error?.stack ?? null });
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report("client_error", { step: where(), subId: stRef.current.subId, message: `unhandledrejection: ${r instanceof Error ? `${r.name}: ${r.message}` : String(r).slice(0, 200)}`, stack: r instanceof Error ? r.stack ?? null : null });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  /* ── intro ─────────────────────────────────────────── */
  if (st.step === "intro") {
    return (
      <Panel key="intro">
        <div className="space-y-6">
          <Heading size={25}>אותו קורס, שני מסלולים - וקצב אחר לגמרי.</Heading>
          <div className="space-y-3">
            <div className="px-5 py-4" style={{ background: H.row, borderRadius: 10 }}>
              <p className="text-[16px] font-bold" style={{ color: H.navy }}>
                המסלול המתקדם מאוד
              </p>
              <p className="mt-1 text-[14.5px] leading-relaxed" style={{ color: H.muted }}>
                למי שכבר עובדת עם AI בפיתוח ומעדיפה להספיק הרבה - בקצב מהיר, בלי לעצור לתרגול.
              </p>
            </div>
            <div className="px-5 py-4" style={{ background: H.row, borderRadius: 10 }}>
              <p className="text-[16px] font-bold" style={{ color: H.navy }}>
                המסלול מהבסיס - כולל תרגול
              </p>
              <p className="mt-1 text-[14.5px] leading-relaxed" style={{ color: H.muted }}>
                מתקדם גם הוא, אבל מתחיל מהיסודות ובונה בסיס חזק - צעד אחר צעד, עם תרגול מעשי.
              </p>
            </div>
          </div>
          <p className="text-[15px]" style={{ color: H.ink }}>
            חמש שאלות קצרות יעזרו לך לדעת איזה מסלול ירגיש לך בדיוק במידה.
          </p>
          <NavyButton onClick={() => patch({ step: "details" })} testId="start">
            בואי נתחיל
          </NavyButton>
          <p className="text-center text-[13px]" style={{ color: H.muted }}>
            פחות מדקה, בלי שום התחייבות
          </p>
        </div>
      </Panel>
    );
  }

  /* ── details ───────────────────────────────────────── */
  if (st.step === "details") {
    const submit = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (pending) return;
      setError(null);
      if (st.firstName.trim().length < 2) return setError("איך קוראים לך? שם פרטי בבקשה.");
      if (st.lastName.trim().length < 2) return setError("ושם המשפחה?");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(st.email.trim())) return setError("הכתובת לא נראית תקינה - בדקי אותה שוב.");
      if (!st.signupStatus) return setError("ספרי לנו - כבר נרשמת לקורס, או מתכננת להירשם?");
      setPending(true);
      try {
        const r = await api<{ ok: true; id: string } | { ok: false; error: string }>("start", { email: st.email, firstName: st.firstName, lastName: st.lastName, signupStatus: st.signupStatus, website });
        if (!r.ok) return setError(r.error);
        patch({ subId: r.id, step: "questions", qIndex: 0, answers: {}, rec: null, placement: null });
      } catch (err) {
        report("api_error", { step: "details", message: err instanceof Error ? err.message : String(err) });
        setError(RETRY);
      } finally {
        setPending(false);
      }
    };
    return (
      <Panel key="details">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Heading>נעים להכיר</Heading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="aiq-first" className={labelCls} style={{ color: H.navy }}>
                שם פרטי
              </label>
              <input id="aiq-first" name="firstName" className={fieldCls} style={fieldStyle} value={st.firstName} onChange={(e) => patch({ firstName: e.target.value })} autoComplete="given-name" required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="aiq-last" className={labelCls} style={{ color: H.navy }}>
                שם משפחה
              </label>
              <input id="aiq-last" name="lastName" className={fieldCls} style={fieldStyle} value={st.lastName} onChange={(e) => patch({ lastName: e.target.value })} autoComplete="family-name" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="aiq-email" className={labelCls} style={{ color: H.navy }}>
              מייל
            </label>
            <input id="aiq-email" name="email" className={fieldCls} style={fieldStyle} type="email" inputMode="email" dir="ltr" value={st.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" required />
          </div>
          {/* Honeypot - hidden from real people */}
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="space-y-2" role="radiogroup" aria-label="איפה את עומדת עם הקורס?">
            <p className={labelCls} style={{ color: H.navy }}>
              איפה את עומדת עם הקורס?
            </p>
            {(
              [
                { v: "registered", label: "אני כבר רשומה לקורס" },
                { v: "planning", label: "מתכוונת להירשם בהקדם" },
              ] as { v: SignupStatus; label: string }[]
            ).map((o) => (
              <OptionRow key={o.v} selected={st.signupStatus === o.v} onClick={() => patch({ signupStatus: o.v })} testId={`status-${o.v}`}>
                {o.label}
              </OptionRow>
            ))}
          </div>
          {error && <ErrorBox key={error} text={error} />}
          <NavyButton type="submit" disabled={pending} testId="to-questions">
            {pending ? "רגע..." : "לשאלות"}
          </NavyButton>
        </form>
      </Panel>
    );
  }

  /* ── questions ─────────────────────────────────────── */
  if (st.step === "questions") {
    const qIndex = st.qIndex;
    const q = QUESTIONS[qIndex];
    const subId = st.subId;
    const finish = async (answers: Record<number, number>) => {
      if (!subId) return setError("משהו השתבש - נסי להתחיל מחדש.");
      setError(null);
      setPending(true);
      try {
        const r = await api<{ ok: true; recommendation: Recommendation } | { ok: false; error: string }>("finish", { id: subId, scores: scoresOf(answers) });
        if (!r.ok) return setError(r.error);
        patch({ rec: r.recommendation, step: "result", placement: null });
      } catch (err) {
        report("api_error", { step: `questions#${qIndex + 1}`, subId, message: err instanceof Error ? err.message : String(err) });
        setError(RETRY);
      } finally {
        setPending(false);
      }
    };
    const pick = (optIdx: number) => {
      if (pending) return;
      const score = q.options[optIdx].score;
      const answers = { ...st.answers, [qIndex]: optIdx };
      patch({ answers });
      // Best effort: the finish call carries every score again.
      if (subId) api("answer", { id: subId, questionIndex: qIndex, score }).catch(() => {});
      if (qIndex < QUESTIONS.length - 1) {
        const next = qIndex + 1; // fixed target: a double-tap can't skip ahead
        setTimeout(() => patch({ qIndex: next }), 180);
        return;
      }
      void finish(answers);
    };
    return (
      <Panel key={`q-${qIndex}`}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-black" style={{ color: H.navy }} data-testid="question-counter">
              {`שאלה ${qIndex + 1} מתוך ${QUESTIONS.length}`}
            </span>
            {qIndex > 0 && (
              <button type="button" className="text-[13.5px] font-medium underline" style={{ color: H.muted }} onClick={() => patch({ qIndex: qIndex - 1 })} disabled={pending} data-testid="prev-question">
                לשאלה הקודמת
              </button>
            )}
          </div>
          <div className="h-[5px] w-full overflow-hidden" style={{ background: "#E3E9EF", borderRadius: 3 }}>
            <div className="h-full" style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%`, background: H.yellow, borderRadius: 3 }} />
          </div>
          <h2 className="text-[20px] font-black leading-snug" style={{ color: H.navy }}>
            {q.title}
          </h2>
          {q.hint && (
            <p className="text-[13.5px]" style={{ color: H.muted }}>
              {q.hint}
            </p>
          )}
          <div className="space-y-2.5" role="radiogroup" aria-label={q.title}>
            {q.options.map((o, i) => (
              <OptionRow key={i} selected={st.answers[qIndex] === i} onClick={() => pick(i)} disabled={pending} testId={`opt-${i}`}>
                {o.label}
              </OptionRow>
            ))}
          </div>
          {error && <ErrorBox key={error} text={error} onRetry={qIndex === QUESTIONS.length - 1 && typeof st.answers[qIndex] === "number" ? () => void finish(st.answers) : undefined} retryLabel="לחשב את ההמלצה שוב" />}
          {pending && (
            <p key="pending" className="text-center text-[14.5px] font-medium" style={{ color: H.muted }}>
              מכינות את ההמלצה שלך...
            </p>
          )}
        </div>
      </Panel>
    );
  }

  /* ── result ────────────────────────────────────────── */
  if (st.step === "result" && st.rec) {
    const rec = st.rec;
    const track = TRACKS[rec];
    const subId = st.subId;
    const reason = reasonFor(rec, scoresOf(st.answers));
    const choose = (wants: boolean) => {
      patch({ placement: wants, step: "done" });
      if (subId) api("placement", { id: subId, wants }).catch(() => {});
    };
    return (
      <Panel key="result">
        <div className="space-y-6">
          <CircleBadge lines={track.badgeLines} />
          <div className="space-y-2 text-center">
            <h2 className="text-[23px] font-black leading-snug" style={{ color: H.navy }}>
              המסלול שמתאים לך
            </h2>
            <span className="mx-auto block h-[4px] w-20" style={{ background: H.yellow, borderRadius: 2 }} />
            <p className="pt-1 text-[16px] font-black" style={{ color: H.navy }} dir="ltr">
              {COURSE_TITLE}
            </p>
            <p className="text-[15.5px] font-bold" style={{ color: H.ink }} data-testid="track-subtitle">
              {track.subtitle}
            </p>
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: H.ink }}>
            {track.summary}
          </p>
          <div className="px-4 py-3.5 text-[14.5px] leading-relaxed" style={{ background: H.yellowSoft, borderInlineStart: `4px solid ${H.yellow}`, borderRadius: 8, color: H.ink }} data-testid="reason">
            <span className="font-black" style={{ color: H.navy }}>
              למה דווקא המסלול הזה?{" "}
            </span>
            <span>{reason}</span>
          </div>
          <div className="space-y-2.5">
            <p className="text-[13.5px] font-black" style={{ color: H.navy }}>
              מה לומדים במסלול
            </p>
            <ul className="flex flex-wrap gap-2" data-testid="topics">
              {track.topics.map((t) => (
                <li key={t} dir="ltr" className="px-3 py-1.5 text-[13px] font-semibold" style={{ background: H.row, color: H.navy, borderRadius: 999 }}>
                  {t}
                </li>
              ))}
            </ul>
            {track.prerequisites && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]" style={{ color: H.muted }} data-testid="prerequisites">
                <span className="font-bold">דרישות קדם:</span>
                {track.prerequisites.map((x) => (
                  <span key={x} dir="ltr" className="whitespace-nowrap px-2 py-0.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${H.line}`, borderRadius: 999, color: H.navy }}>
                    {x}
                  </span>
                ))}
              </p>
            )}
          </div>
          <SyllabusLink rec={rec} subId={subId} big />
          <div className="space-y-3 pt-5" style={{ borderTop: `1.5px solid ${H.line}` }}>
            <p className="text-center text-[15.5px] font-black" style={{ color: H.navy }}>
              רוצה שנשבץ אותך למסלול הזה?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" onClick={() => choose(true)} className="px-4 py-3 text-[15.5px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: H.navy, borderRadius: 10 }}>
                כן, שבצו אותי
              </button>
              <button type="button" onClick={() => choose(false)} className="px-4 py-3 text-[15.5px] font-bold transition-colors" style={{ border: `2px solid ${H.navy}`, color: H.navy, background: H.white, borderRadius: 10 }}>
                עוד מתלבטת
              </button>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  /* ── done ──────────────────────────────────────────── */
  const rec = st.rec;
  return (
    <Panel key="done">
      <div className="space-y-5 text-center">
        <Heading size={23} center>
          {st.placement ? "קיבלנו. שומרות לך מקום" : "תודה, הפרטים אצלנו"}
        </Heading>
        <p className="text-[15px] leading-relaxed" style={{ color: H.ink }}>
          {st.placement
            ? "נחזור אלייך בהקדם עם כל פרטי המסלול וההרשמה. מחכות לראות אותך בקורס."
            : "קחי את הזמן עם הסילבוס, ואם עולה שאלה - אנחנו כאן לכל התלבטות."}
        </p>
        {rec && <SyllabusLink rec={rec} subId={st.subId} />}
        <div className="px-4 py-4 text-[14.5px]" style={{ background: H.row, borderRadius: 10, color: H.ink }}>
          <p className="font-black" style={{ color: H.navy }}>
            כותבות לנו
          </p>
          <p className="mt-1">
            <a href={contactMailto} className="font-bold underline" dir="ltr" style={{ color: H.navy }}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </Panel>
  );
}
