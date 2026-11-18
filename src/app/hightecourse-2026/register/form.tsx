"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Landmark, Plus, Trash2, User, Users } from "lucide-react";
import { H } from "@/app/ai-course/theme";
import {
  PATHS,
  PRICE,
  emptyContact,
  emptyParticipant,
  nis,
  orderTotal,
  unitPrice,
  validateContact,
  validateParticipant,
  type ContactInput,
  type FieldErrors,
  type OrderKind,
  type ParticipantInput,
  type PaymentMethod,
} from "@/lib/conference-shared";
import { submitConferenceOrder } from "../actions";

/*
  The owner's form (17/11): a single participant (650 ₪) or a group - the
  contact's details once, then "+ משתתפת נוספת" for each woman, 500 ₪ each
  from the fourth (the 650 crossed out). Credit card goes on to the secure
  payment page; a bank transfer is complete here, with the clear line that
  the invoice is sent by mail.
*/
const inputCls = "w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-[16px] outline-none transition-colors placeholder:text-[#9AAAB9] focus:border-[#004878]";
const PARTICIPANT_FIELDS: { key: keyof ParticipantInput; label: string; type?: string; optional?: boolean; dir?: "ltr"; mode?: "numeric" | "tel" | "email"; placeholder?: string; single?: boolean }[] = [
  { key: "firstName", label: "שם פרטי" },
  { key: "lastName", label: "שם משפחה" },
  { key: "nationalId", label: "ת.ז.", dir: "ltr", mode: "numeric", placeholder: "9 ספרות" },
  { key: "phone", label: "נייד", type: "tel", dir: "ltr", mode: "tel", placeholder: "052-1234567" },
  { key: "personalEmail", label: "מייל פרטי", type: "email", dir: "ltr", mode: "email" },
  { key: "workEmail", label: "מייל עבודה", type: "email", dir: "ltr", mode: "email", optional: true },
  { key: "roleTitle", label: "תפקיד" },
  { key: "department", label: "משרד" },
  { key: "company", label: "חברה", single: true },
];
const CONTACT_FIELDS: { key: keyof ContactInput; label: string; type?: string; dir?: "ltr"; mode?: "numeric" | "email"; placeholder?: string }[] = [
  { key: "company", label: "חברה" },
  { key: "contactName", label: "איש קשר" },
  { key: "contactEmail", label: "מייל איש קשר", type: "email", dir: "ltr", mode: "email" },
  { key: "invoiceName", label: "חשבונית על שם" },
  { key: "companyId", label: "ח.פ.", dir: "ltr", mode: "numeric" },
];

function Label({ text, optional, htmlFor }: { text: string; optional?: boolean; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[13.5px] font-bold" style={{ color: H.navy }}>
      {text}
      {optional && (
        <span className="font-medium" style={{ color: H.muted }}>
          {" "}
          (אופציונלי)
        </span>
      )}
    </label>
  );
}

export function RegisterForm({ initialKind }: { initialKind: OrderKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<OrderKind>(initialKind);
  const [participants, setParticipants] = useState<ParticipantInput[]>([emptyParticipant()]);
  const [contact, setContact] = useState<ContactInput>(emptyContact());
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [pErrors, setPErrors] = useState<FieldErrors<ParticipantInput>[]>([]);
  const [cErrors, setCErrors] = useState<FieldErrors<ContactInput>>({});
  const [methodError, setMethodError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const count = kind === "group" ? participants.length : 1;
  const unit = unitPrice(kind, count);
  const total = orderTotal(kind, count);
  const discounted = kind === "group" && unit < PRICE.single;
  const shownParticipants = useMemo(() => (kind === "group" ? participants : participants.slice(0, 1)), [kind, participants]);

  function setParticipant(i: number, key: keyof ParticipantInput, value: string) {
    setParticipants((prev) => prev.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
    setPErrors((prev) => prev.map((e, j) => (j === i ? { ...e, [key]: undefined } : e)));
  }
  function addParticipant() {
    setParticipants((prev) => [...prev, emptyParticipant()]);
  }
  function removeParticipant(i: number) {
    setParticipants((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));
    setPErrors((prev) => prev.filter((_, j) => j !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const list = shownParticipants;
    const pe = list.map((p) => validateParticipant(p, { needsCompany: kind === "single" }));
    const ce = kind === "group" ? validateContact(contact) : {};
    const me = method ? null : "בחרי איך לשלם";
    setPErrors(pe);
    setCErrors(ce);
    setMethodError(me);
    const bad = pe.some((x) => Object.keys(x).length) || Object.keys(ce).length || me;
    if (bad) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-invalid='1']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setBusy(true);
    try {
      const r = await submitConferenceOrder({ kind, paymentMethod: method as PaymentMethod, note, participants: list, contact: kind === "group" ? contact : undefined, website });
      if (!r.ok) {
        setServerError(r.error);
        setBusy(false);
        return;
      }
      router.push(r.paymentMethod === "credit" ? `${PATHS.pay}?o=${r.token}` : `${PATHS.done}?o=${r.token}`);
    } catch {
      setServerError("משהו השתבש בשמירה. נסי שוב בעוד רגע.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" data-testid="hc-form">
      {/* 1. who */}
      <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-[20px] font-black" style={{ color: H.navy }}>
          מי נרשמת?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["single", "משתתפת יחידה", `${nis(PRICE.single)} ₪`, <User key="u" size={22} strokeWidth={2.4} />, null],
              ["group", "קבוצה", `${nis(PRICE.group)} ₪ למשתתפת`, <Users key="g" size={22} strokeWidth={2.4} />, `מעל ${PRICE.groupMin - 1} משתתפות, במקום ${nis(PRICE.single)} ₪`],
            ] as const
          ).map(([k, title, price, icon, sub]) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                data-testid={`hc-kind-${k}`}
                aria-pressed={on}
                className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-start transition-colors"
                style={{ borderColor: on ? H.navy : H.line, background: on ? H.yellowSoft : H.white }}
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: on ? H.navy : H.row, color: on ? H.yellow : H.navy }}>
                  {icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-[17px] font-black" style={{ color: H.navy }}>
                    {title}
                  </span>
                  <span className="text-[14px] font-bold" style={{ color: H.ink }}>
                    {price}
                    {sub && (
                      <span className="font-medium" style={{ color: H.muted }}>
                        {" "}
                        · {sub}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {kind === "group" && (
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: H.muted }}>
            פרטי איש הקשר והחשבונית ממלאים פעם אחת; אחר כך מוסיפים משתתפת אחרי משתתפת. מהמשתתפת ה-{PRICE.groupMin} המחיר יורד ל-{nis(PRICE.group)} ₪ לכל אחת.
          </p>
        )}
      </section>

      {/* 2. the group's contact */}
      {kind === "group" && (
        <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-7" data-testid="hc-contact">
          <h2 className="text-[20px] font-black" style={{ color: H.navy }}>
            פרטי הקבוצה ואיש הקשר
          </h2>
          <p className="mt-1 text-[14px]" style={{ color: H.muted }}>
            החברה מופיעה פעם אחת כאן, ולא בפרטי כל משתתפת.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {CONTACT_FIELDS.map((f) => {
              const id = `hc-c-${f.key}`;
              const err = cErrors[f.key];
              return (
                <div key={f.key} className="flex flex-col gap-1.5" data-invalid={err ? "1" : undefined}>
                  <Label text={f.label} htmlFor={id} />
                  <input
                    id={id}
                    data-testid={id}
                    type={f.type ?? "text"}
                    dir={f.dir}
                    inputMode={f.mode}
                    placeholder={f.placeholder}
                    value={contact[f.key]}
                    onChange={(e) => {
                      setContact((c) => ({ ...c, [f.key]: e.target.value }));
                      setCErrors((c) => ({ ...c, [f.key]: undefined }));
                    }}
                    className={inputCls}
                    style={{ borderColor: err ? H.red : H.line }}
                    autoComplete="off"
                  />
                  {err && (
                    <span className="text-[13px] font-semibold" style={{ color: H.red }}>
                      {err}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. participants */}
      {shownParticipants.map((p, i) => (
        <section key={i} className="rounded-[26px] bg-white p-5 shadow-sm sm:p-7" data-testid={`hc-participant-${i}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-black" style={{ color: H.navy }}>
              {kind === "group" ? `משתתפת ${i + 1}` : "הפרטים שלך"}
            </h2>
            {kind === "group" && participants.length > 1 && (
              <button type="button" onClick={() => removeParticipant(i)} className="inline-flex items-center gap-1 text-[13.5px] font-bold hover:underline" style={{ color: H.muted }} data-testid={`hc-remove-${i}`}>
                <Trash2 size={15} />
                הסרה
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {PARTICIPANT_FIELDS.filter((f) => !f.single || kind === "single").map((f) => {
              const id = `hc-p${i}-${f.key}`;
              const err = pErrors[i]?.[f.key];
              return (
                <div key={f.key} className="flex flex-col gap-1.5" data-invalid={err ? "1" : undefined}>
                  <Label text={f.label} optional={f.optional} htmlFor={id} />
                  <input
                    id={id}
                    data-testid={id}
                    type={f.type ?? "text"}
                    dir={f.dir}
                    inputMode={f.mode}
                    placeholder={f.placeholder}
                    value={p[f.key]}
                    onChange={(e) => setParticipant(i, f.key, e.target.value)}
                    className={inputCls}
                    style={{ borderColor: err ? H.red : H.line }}
                    autoComplete="off"
                  />
                  {err && (
                    <span className="text-[13px] font-semibold" style={{ color: H.red }}>
                      {err}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {kind === "group" && (
        <button
          type="button"
          onClick={addParticipant}
          data-testid="hc-add-participant"
          className="inline-flex items-center justify-center gap-2 self-start rounded-full border-2 border-dashed px-5 py-3 text-[16px] font-black transition-colors hover:bg-white"
          style={{ borderColor: H.navy, color: H.navy }}
        >
          <Plus size={18} strokeWidth={2.8} />
          משתתפת נוספת
        </button>
      )}

      {/* 4. payment */}
      <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-7" data-invalid={methodError ? "1" : undefined}>
        <h2 className="text-[20px] font-black" style={{ color: H.navy }}>
          אופן התשלום
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["credit", "כרטיס אשראי", "ממשיכות לדף סליקה מאובטח (נדרים פלוס). התשלום נעשה עכשיו.", <CreditCard key="c" size={22} strokeWidth={2.4} />],
              ["transfer", "העברה בנקאית מול חשבונית", "ההרשמה נקלטת עכשיו. החשבונית לתשלום תישלח אלייך במייל.", <Landmark key="t" size={22} strokeWidth={2.4} />],
            ] as const
          ).map(([m, title, sub, icon]) => {
            const on = method === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  setMethodError(null);
                }}
                data-testid={`hc-method-${m}`}
                aria-pressed={on}
                className="flex items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-start transition-colors"
                style={{ borderColor: on ? H.navy : methodError ? H.red : H.line, background: on ? H.yellowSoft : H.white }}
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: on ? H.navy : H.row, color: on ? H.yellow : H.navy }}>
                  {icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-[16.5px] font-black" style={{ color: H.navy }}>
                    {title}
                  </span>
                  <span className="text-[13.5px] leading-snug" style={{ color: H.muted }}>
                    {sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {methodError && (
          <p className="mt-2 text-[13.5px] font-semibold" style={{ color: H.red }}>
            {methodError}
          </p>
        )}
        {method === "transfer" && (
          <p className="mt-3 rounded-xl px-4 py-3 text-[14.5px] font-bold leading-relaxed" style={{ background: H.yellowSoft, color: H.navy }} data-testid="hc-transfer-note">
            שימי לב: החשבונית תישלח אלייך במייל{kind === "group" ? ` (${contact.contactEmail.trim() || "למייל איש הקשר"})` : ""}, והתשלום מתבצע מולה. המקום שמור מרגע ההרשמה.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-1.5">
          <Label text="הערה" optional htmlFor="hc-note" />
          <textarea id="hc-note" data-testid="hc-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} className={`${inputCls} resize-y`} style={{ borderColor: H.line }} placeholder="משהו שכדאי שנדע?" />
        </div>
        {/* honeypot */}
        <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden>
          <label>
            website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </section>

      {/* 5. total + submit */}
      <section className="rounded-[26px] p-5 sm:p-7" style={{ background: H.navy, color: H.white }} data-testid="hc-summary">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#C9D9E6" }}>
              {count === 1 ? "משתתפת אחת" : `${count} משתתפות`} × {nis(unit)} ₪
              {discounted && (
                <>
                  {" "}
                  <span className="line-through opacity-70" data-testid="hc-total-strike">
                    {nis(PRICE.single)} ₪
                  </span>{" "}
                  <span className="rounded-full px-2 py-0.5 text-[12px] font-black" style={{ background: H.yellow, color: H.navy }}>
                    מחיר קבוצה
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-[40px] font-black leading-none" style={{ color: H.yellow }} data-testid="hc-total">
              {nis(total)} ₪
            </p>
            {kind === "group" && !discounted && (
              <p className="mt-2 text-[13.5px]" style={{ color: "#C9D9E6" }}>
                עוד {PRICE.groupMin - count} {PRICE.groupMin - count === 1 ? "משתתפת" : "משתתפות"} והמחיר יורד ל-{nis(PRICE.group)} ₪ לכל אחת.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            data-testid="hc-submit"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[18px] font-black shadow-[0_12px_26px_rgba(248,200,0,.35)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: H.yellow, color: H.navy }}
          >
            {busy ? "שומרות…" : method === "credit" ? "להרשמה ולתשלום מאובטח" : "הרשמי עכשיו"}
          </button>
        </div>
        {serverError && (
          <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-[14.5px] font-bold" style={{ color: H.yellow }} data-testid="hc-server-error">
            {serverError}
          </p>
        )}
      </section>
    </form>
  );
}
