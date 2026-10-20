"use client";

import { useState, useTransition } from "react";
import { finishQuiz, markSyllabusDownload, saveAnswer, setPlacement, startQuiz, type SignupStatus } from "./actions";
import { QUESTIONS, TRACKS, type Recommendation } from "./questions";
import { H, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, contactMailto } from "./theme";

type Step = "intro" | "details" | "questions" | "result" | "done";

const inputCls =
  "w-full rounded-[14px] border-2 bg-white px-4 py-3 text-[16px] outline-none transition-colors";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-xl rounded-[22px] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,72,120,0.10)]"
      style={{ border: `1px solid ${H.line}` }}
    >
      {children}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[14px] px-6 py-3.5 text-[17px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: H.navy }}
    >
      {children}
    </button>
  );
}

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

  const errorBox = error && (
    <p role="alert" className="rounded-[14px] px-4 py-3 text-[15px] font-medium" style={{ background: "#FBEAE8", color: H.red }}>
      {error}
    </p>
  );

  /* ── intro ─────────────────────────────────────────── */
  if (step === "intro") {
    return (
      <Card>
        <div className="space-y-5 text-center">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-[14px] font-bold"
            style={{ background: H.yellowSoft, color: H.navyDeep }}
          >
            Advanced GenAI & Agentic AI for Developers
          </span>
          <h1 className="text-[28px] sm:text-[32px] font-black leading-tight" style={{ color: H.navy }}>
            איזה מסלול AI מתאים לך?
          </h1>
          <p className="text-[17px] leading-relaxed" style={{ color: H.ink }}>
            לקורס פיתוח ה-AI שלנו יש שני מסלולים עם אותם נושאים בדיוק —
            <br className="hidden sm:block" />
            <b> המסלול המתקדם מאוד</b>, בקצב מהיר ובלי לעצור לתרגול,
            <br className="hidden sm:block" />
            ו<b>המסלול מהבסיס</b>, שבונה הכל צעד-צעד עם תרגול.
          </p>
          <p className="text-[16px]" style={{ color: H.muted }}>
            כמה שאלות קצרות — ונדע יחד איזה מסלול ירגיש לך בדיוק במידה. 💛
          </p>
          <PrimaryBtn onClick={() => setStep("details")}>מתחילות ←</PrimaryBtn>
          <p className="text-[13px]" style={{ color: H.muted }}>
            לוקח פחות מדקה · בלי שום התחייבות
          </p>
        </div>
      </Card>
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
        const r = await startQuiz({ email, firstName, lastName, signupStatus, website });
        if (!r.ok) return setError(r.error);
        setSubId(r.id);
        setStep("questions");
      });
    };
    return (
      <Card>
        <div className="space-y-4">
          <h2 className="text-[22px] font-black" style={{ color: H.navy }}>
            נעים להכיר 👋
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={inputCls}
              style={{ borderColor: H.line }}
              placeholder="שם פרטי"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <input
              className={inputCls}
              style={{ borderColor: H.line }}
              placeholder="שם משפחה"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <input
            className={inputCls}
            style={{ borderColor: H.line }}
            placeholder="מייל"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {/* Honeypot - hidden from real people */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <p className="text-[15px] font-semibold" style={{ color: H.ink }}>
              איפה את עומדת עם הקורס?
            </p>
            {(
              [
                { v: "registered", label: "אני כבר רשומה לקורס 🎉" },
                { v: "planning", label: "מתכוונת להירשם בהקדם" },
              ] as { v: SignupStatus; label: string }[]
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setSignupStatus(o.v)}
                className="w-full rounded-[14px] border-2 px-4 py-3 text-start text-[16px] font-medium transition-colors"
                style={{
                  borderColor: signupStatus === o.v ? H.navy : H.line,
                  background: signupStatus === o.v ? H.yellowSoft : H.white,
                  color: H.ink,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {errorBox}
          <PrimaryBtn onClick={submit} disabled={pending}>
            {pending ? "רגע..." : "לשאלות ←"}
          </PrimaryBtn>
        </div>
      </Card>
    );
  }

  /* ── questions ─────────────────────────────────────── */
  if (step === "questions") {
    const q = QUESTIONS[qIndex];
    const pick = (optIdx: number) => {
      const score = q.options[optIdx].score;
      setAnswers((a) => ({ ...a, [qIndex]: optIdx }));
      if (subId) void saveAnswer(subId, qIndex, score);
      if (qIndex < QUESTIONS.length - 1) {
        setTimeout(() => setQIndex((i) => i + 1), 180);
      } else {
        setError(null);
        start(async () => {
          if (!subId) return setError("משהו השתבש - נסי להתחיל מחדש.");
          const r = await finishQuiz(subId);
          if (!r.ok) return setError(r.error);
          setRec(r.recommendation);
          setStep("result");
        });
      }
    };
    return (
      <Card>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold" style={{ color: H.muted }}>
              שאלה {qIndex + 1} מתוך {QUESTIONS.length}
            </span>
            {qIndex > 0 && (
              <button className="text-[14px] font-medium underline" style={{ color: H.muted }} onClick={() => setQIndex((i) => i - 1)}>
                → חזרה
              </button>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: H.line }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%`, background: H.yellow }}
            />
          </div>
          <h2 className="text-[21px] font-black leading-snug" style={{ color: H.navy }}>
            {q.title}
          </h2>
          {q.hint && (
            <p className="text-[14px]" style={{ color: H.muted }}>
              {q.hint}
            </p>
          )}
          <div className="space-y-2.5">
            {q.options.map((o, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={pending}
                className="w-full rounded-[14px] border-2 px-4 py-3.5 text-start text-[16px] font-medium transition-colors disabled:opacity-60"
                style={{
                  borderColor: answers[qIndex] === i ? H.navy : H.line,
                  background: answers[qIndex] === i ? H.yellowSoft : H.white,
                  color: H.ink,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {errorBox}
          {pending && (
            <p className="text-center text-[15px] font-medium" style={{ color: H.muted }}>
              מחשבות רגע... 🤔
            </p>
          )}
        </div>
      </Card>
    );
  }

  /* ── result ────────────────────────────────────────── */
  if (step === "result" && rec) {
    const track = TRACKS[rec];
    const choose = (wants: boolean) => {
      setPlacementState(wants);
      if (subId) void setPlacement(subId, wants);
      setStep("done");
    };
    return (
      <Card>
        <div className="space-y-5">
          <div className="text-center space-y-3">
            <span
              className="inline-block rounded-full px-4 py-1.5 text-[15px] font-black"
              style={{ background: H.yellow, color: H.navyDeep }}
            >
              {track.badge}
            </span>
            <h2 className="text-[24px] font-black leading-snug" style={{ color: H.navy }}>
              המסלול שמתאים לך 💛
            </h2>
            <p className="text-[17px] font-bold" style={{ color: H.ink }}>
              {track.name}
            </p>
          </div>
          <p className="text-[16px] leading-relaxed" style={{ color: H.ink }}>
            {track.blurb}
          </p>
          <a
            href={track.syllabus}
            download={track.file}
            onClick={() => subId && void markSyllabusDownload(subId)}
            className="block w-full rounded-[14px] px-6 py-3.5 text-center text-[17px] font-bold transition-opacity hover:opacity-90"
            style={{ background: H.yellow, color: H.navyDeep }}
          >
            ⬇ להורדת הסילבוס המלא
          </a>
          <div className="rounded-[16px] p-4 space-y-3" style={{ background: H.bg }}>
            <p className="text-[16px] font-bold text-center" style={{ color: H.navy }}>
              רוצה שנשבץ אותך למסלול הזה?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => choose(true)}
                className="rounded-[14px] px-4 py-3 text-[16px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: H.navy }}
              >
                כן, שבצו אותי! ✓
              </button>
              <button
                onClick={() => choose(false)}
                className="rounded-[14px] border-2 px-4 py-3 text-[16px] font-bold transition-colors"
                style={{ borderColor: H.navy, color: H.navy, background: H.white }}
              >
                עוד מתלבטת
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  /* ── done ──────────────────────────────────────────── */
  const track = rec ? TRACKS[rec] : null;
  return (
    <Card>
      <div className="space-y-5 text-center">
        <div className="text-[44px]">{placement ? "🎉" : "💛"}</div>
        <h2 className="text-[24px] font-black" style={{ color: H.navy }}>
          {placement ? "מעולה! את משובצת אצלנו" : "תודה! הפרטים אצלנו"}
        </h2>
        <p className="text-[16px] leading-relaxed" style={{ color: H.ink }}>
          {placement
            ? "נחזור אלייך עם כל פרטי המסלול וההרשמה. מחכות לראות אותך בקורס!"
            : "קחי את הזמן עם הסילבוס — ואם יש שאלה, אנחנו כאן לכל התלבטות."}
        </p>
        {track && (
          <a
            href={track.syllabus}
            download={track.file}
            onClick={() => subId && void markSyllabusDownload(subId)}
            className="inline-block text-[15px] font-bold underline"
            style={{ color: H.navy }}
          >
            להורדת הסילבוס שוב
          </a>
        )}
        <div className="rounded-[16px] p-4 text-[15px] space-y-1" style={{ background: H.bg, color: H.ink }}>
          <p className="font-bold" style={{ color: H.navy }}>
            מדברות איתנו בכיף:
          </p>
          <p>
            <a href={CONTACT_PHONE_HREF} className="font-medium underline" dir="ltr">
              {CONTACT_PHONE}
            </a>
            {" · "}
            <a href={contactMailto} className="font-medium underline" dir="ltr">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
}
