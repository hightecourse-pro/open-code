"use client";

import { useState, useTransition } from "react";
import { checkCourseEmail, registerForCourse } from "../actions";
import { C } from "../theme";

type Step = "details" | "subscriber" | "not_subscriber" | "redirecting";

const inputCls =
  "w-full rounded-[14px] border-2 bg-white px-4 py-3 text-[16px] outline-none transition-colors focus:border-[#23405F]";

const BENEFITS = [
  "כניסה לסשנים החיים וצפייה בהקלטות",
  "ספריית הקורסים של הייטקורס",
  "עדיפות בהגשה למשרות דרך קוד פתוח",
  "מנטוריות, צ׳אט וכלי AI לחיפוש עבודה",
  "השתתפות בהאקתונים",
];

export function RegisterForm() {
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [firstName, setFirstName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function check() {
    setError(null);
    if (fullName.trim().length < 2) return setError("איך קוראים לך? שם מלא בבקשה.");
    if (!/^0\d{8,9}$/.test(phone.replace(/\D/g, ""))) return setError("מספר טלפון לא תקין (למשל 052-1234567).");
    start(async () => {
      const r = await checkCourseEmail(email);
      if (!r.ok) return setError(r.error);
      setFirstName(r.firstName);
      setStep(r.subscriber ? "subscriber" : "not_subscriber");
    });
  }

  function go(intent: "pay" | "join") {
    setError(null);
    start(async () => {
      const r = await registerForCourse({ email, fullName, phone, intent, website });
      if (!r.ok) return setError(r.error);
      setStep("redirecting");
      window.location.href = intent === "join" ? r.joinUrl : r.paymentUrl;
    });
  }

  const errorBox = error && (
    <p role="alert" className="rounded-[14px] px-4 py-3 text-[15px] font-medium" style={{ background: "#FDE7EE", color: C.pink }}>
      {error}
    </p>
  );

  if (step === "redirecting") {
    return (
      <div className="rounded-[22px] px-5 py-6 text-center" style={{ background: C.bg }}>
        <p className="font-black text-[22px]" style={{ color: C.navy }}>
          נרשמת! 💜
        </p>
        <p className="text-[16px] mt-2 leading-relaxed">מעבירות אותך עכשיו לדף התשלום המאובטח… אם הדף לא נפתח, לחצי על הכפתור.</p>
        <button
          type="button"
          onClick={() => go("pay")}
          className="mt-4 rounded-full px-8 py-3 font-black text-[17px] text-white"
          style={{ background: C.pink }}
        >
          לדף התשלום
        </button>
      </div>
    );
  }

  if (step === "details") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-[15px]" style={{ color: C.navy }}>
            המייל שלך
          </span>
          <input
            type="email"
            name="email"
            dir="ltr"
            autoComplete="email"
            required
            className={inputCls}
            style={{ borderColor: C.teal }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <span className="text-[13px]" style={{ color: C.muted }}>
            אם את מנויה בקוד פתוח - הכניסי את המייל שאיתו נרשמת לקהילה.
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-[15px]" style={{ color: C.navy }}>
            שם מלא
          </span>
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            required
            className={inputCls}
            style={{ borderColor: C.teal }}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-[15px]" style={{ color: C.navy }}>
            טלפון נייד
          </span>
          <input
            type="tel"
            name="phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            required
            className={inputCls}
            style={{ borderColor: C.teal }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05X-XXXXXXX"
          />
        </label>
        {/* Honeypot: bots fill it, people never see it. */}
        <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
          <label>
            אתר
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        {errorBox}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full px-8 py-4 font-black text-[19px] text-white shadow-md disabled:opacity-60"
          style={{ background: C.pink }}
        >
          {pending ? "בודקות…" : "בדיקת מנוי והמשך ←"}
        </button>
        <p className="text-[13px] leading-relaxed" style={{ color: C.muted }}>
          הפרטים משמשים להרשמה לקורס בלבד ומגיעים לצוות שופרא וקוד פתוח.
        </p>
      </form>
    );
  }

  if (step === "subscriber") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] px-5 py-5" style={{ background: "#E4F3F1", borderRight: `6px solid ${C.tealDeep}` }}>
          <p className="font-black text-[22px]" style={{ color: C.navy }}>
            {firstName ? `${firstName}, ` : ""}יש לך מנוי בקוד פתוח 💜
          </p>
          <p className="text-[16px] leading-relaxed mt-2">
            המלגה למנויות - <b>4,500 ₪</b> - שלך. חשוב שיהיה ברור: המלגה מותנית בכך שהמנוי שלך בקוד פתוח נשאר פעיל{" "}
            <b>לאורך כל שנת הקורס</b>. מנוי שמסתיים באמצע השנה - המלגה מסתיימת איתו.
          </p>
        </div>
        <PriceCard subscriber />
        {errorBox}
        <button
          type="button"
          disabled={pending}
          onClick={() => go("pay")}
          className="rounded-full px-8 py-4 font-black text-[19px] text-white shadow-md disabled:opacity-60"
          style={{ background: C.pink }}
        >
          {pending ? "רושמות אותך…" : "ממשיכה לתשלום המאובטח ←"}
        </button>
        <BackLink onClick={() => setStep("details")} />
      </div>
    );
  }

  // not_subscriber
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[22px] px-5 py-5" style={{ background: "#FFF6DB", borderRight: `6px solid ${C.yellow}` }}>
        <p className="font-black text-[22px]" style={{ color: C.navy }}>
          לא מצאנו מנוי פעיל בכתובת הזו
        </p>
        <p className="text-[16px] leading-relaxed mt-2">
          המלגה למנויות (4,500 ₪) ניתנת רק למי שיש לה מנוי פעיל בקוד פתוח לאורך שנת הקורס. יש לך מנוי במייל אחר?{" "}
          <button type="button" className="font-bold underline" style={{ color: C.navy }} onClick={() => setStep("details")}>
            נסי אותו
          </button>
          .
        </p>
      </div>

      <div className="rounded-[22px] px-5 py-5 bg-white" style={{ border: `2px solid ${C.teal}` }}>
        <p className="font-black text-[21px]" style={{ color: C.navy }}>
          מנוי מלא לקוד פתוח - 39 ₪ לחודש
        </p>
        <p className="text-[15.5px] leading-relaxed mt-1">
          המנוי פותח לך את המלגה (חיסכון של 4,500 ₪ בקורס), וגם את כל מה שהקהילה נותנת:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-[15.5px]">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.tealDeep }} aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={pending}
          onClick={() => go("join")}
          className="mt-4 w-full rounded-full px-8 py-4 font-black text-[18px] text-white shadow-md disabled:opacity-60"
          style={{ background: C.tealDeep }}
        >
          {pending ? "רושמות אותך…" : "פותחת מנוי בקוד פתוח ואז ממשיכה לקורס"}
        </button>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: C.muted }}>
          נרשום אותך לקורס כבר עכשיו ונעביר אותך להצטרפות לקהילה. אחרי שהמנוי פעיל, חזרי לדף הזה עם אותו מייל - והמלגה תופיע.
        </p>
      </div>

      <PriceCard subscriber={false} />
      {errorBox}
      <button
        type="button"
        disabled={pending}
        onClick={() => go("pay")}
        className="rounded-full px-8 py-3.5 font-black text-[17px] shadow-sm disabled:opacity-60"
        style={{ background: "white", color: C.navy, border: `2px solid ${C.navy}` }}
      >
        {pending ? "רושמות אותך…" : "ממשיכה לתשלום בלי מלגת המנויות"}
      </button>
      <BackLink onClick={() => setStep("details")} />
    </div>
  );
}

function PriceCard({ subscriber }: { subscriber: boolean }) {
  return (
    <div className="rounded-[22px] px-5 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ background: C.bg }}>
      <div>
        <div className="font-bold text-[15px]" style={{ color: C.navy }}>
          {subscriber ? "המחיר שלך לשנה שלמה" : "המחיר ללא מלגת המנויות"}
        </div>
        <div className="text-[13px]" style={{ color: C.muted }}>
          {subscriber ? "אחרי מימון שופרא ומלגת המנויות · 12 תשלומים של 125 ₪" : "אחרי מימון שופרא (6,000 ₪) בלבד"}
        </div>
      </div>
      <div className="rounded-[16px] px-5 py-1.5" style={{ background: C.yellow }}>
        <span className="font-black text-[30px] leading-none" style={{ color: C.navy }}>
          {subscriber ? "1,500 ₪" : "6,000 ₪"}
        </span>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start text-[14px] underline" style={{ color: C.muted }}>
      ← לתיקון הפרטים
    </button>
  );
}
