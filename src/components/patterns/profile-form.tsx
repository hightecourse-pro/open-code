"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Rocket } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveProfile, type ProfileState } from "@/app/(app)/profile/actions";
import type { ConfigQuestion, TaxonomyKind } from "@/types/database";

type Option = { value: string; label: string };

export interface ProfileFormProps {
  firstName: string;
  lastName: string;
  questions: ConfigQuestion[];
  answers: Record<string, unknown>; // question_id -> value
  taxonomyOptions?: Partial<Record<TaxonomyKind, Option[]>>;
}

const LONG_TEXT = new Set(["bio", "ai_project_links", "notes_for_us", "work_description"]);
const isOtherVal = (v: string) => v === "other";

// Ordered wizard sections. Questions are matched by key; anything unmatched
// lands in a final "פרטים נוספים" step so admin-added questions still appear.
const SECTIONS: { title: string; hint: string; keys: string[] }[] = [
  {
    title: "קצת עלייך",
    hint: "פרטי קשר בסיסיים — כדי שנכיר ונדע איך לחזור אלייך.",
    keys: ["id_number", "phone", "region", "city", "marital_status", "prev_surname"],
  },
  {
    title: "הרקע הלימודי",
    hint: "איפה למדת ומה התמחית — זה עוזר לנו להתאים קורסים ומשרות.",
    keys: ["study_place", "coordinator_name", "certificate", "track_specialization", "unique_courses", "graduation_year"],
  },
  {
    title: "הניסיון המקצועי שלך",
    hint: "ספרי לנו על הניסיון — ככה נדע לאיזה משרות לכוון בשבילך.",
    keys: ["years_experience", "exp_role", "exp_tech", "exp_languages", "currently_working", "current_workplace", "work_description", "specific_job"],
  },
  {
    title: "כישורים וכלים",
    hint: "מה את יודעת לעשות בפועל — רק מה שבאמת התנסית בו, בלי לחץ 💜",
    keys: ["dev_tech", "genai_known", "genai_practiced", "ai_tools_used", "ai_project_links", "ai_gaps"],
  },
  {
    title: "פרקטיקום והשמה",
    hint: "כמה העדפות שיעזרו לנו להציע לך בדיוק את ההזדמנויות הנכונות.",
    keys: ["practicum_done", "practicum_employer", "practicum_tech", "practicum_placement", "remote_commute", "paid_placement"],
  },
  {
    title: "עוד משהו?",
    hint: "משהו שתרצי שנדע עלייך? כאן המקום 🙂",
    keys: ["notes_for_us"],
  },
];

export function ProfileForm({ firstName, lastName, questions, answers, taxonomyOptions = {} }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const formRef = useRef<HTMLFormElement>(null);

  const gate = questions.find((q) => q.key === "has_experience");
  const rest = questions.filter((q) => q.key !== "has_experience");

  function opts(q: ConfigQuestion): Option[] {
    if (q.taxonomy_kind) return taxonomyOptions[q.taxonomy_kind] ?? [];
    return Array.isArray(q.options) ? (q.options as unknown as Option[]) : [];
  }
  function customText(q: ConfigQuestion): string {
    const vals = opts(q).map((o) => o.value);
    const cur = answers[q.id];
    if (q.field_type === "select" && typeof cur === "string" && cur && !vals.includes(cur)) return cur;
    if ((q.field_type === "multiselect" || q.field_type === "tags") && Array.isArray(cur)) {
      return (cur as string[]).filter((v) => !vals.includes(v) && !isOtherVal(v)).join(", ");
    }
    return "";
  }

  // --- state ---
  const initBools: Record<string, boolean> = {};
  const initSelOther: Record<string, boolean> = {};
  const initMultiOther: Record<string, boolean> = {};
  for (const q of rest) {
    if (q.field_type === "bool") initBools[q.key] = answers[q.id] === true;
    const vals = opts(q).map((o) => o.value);
    if (q.field_type === "select") {
      const cur = answers[q.id];
      if (typeof cur === "string" && cur && !vals.includes(cur)) initSelOther[q.id] = true;
    } else if (q.field_type === "multiselect" || q.field_type === "tags") {
      const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      if (arr.some((v) => !vals.includes(v))) initMultiOther[q.id] = true;
    }
  }
  const [bools, setBools] = useState(initBools);
  const [selOther, setSelOther] = useState(initSelOther);
  const [multiOther, setMultiOther] = useState(initMultiOther);
  const [expChoice, setExpChoice] = useState<boolean | null>(
    gate ? (answers[gate.id] === true ? true : answers[gate.id] === false ? false : null) : false
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState(false);
  const [nameError, setNameError] = useState(false);

  const hasExperience = expChoice === true;
  function visible(q: ConfigQuestion): boolean {
    if (expChoice === null) return false;
    if (q.intake_track === "junior" && hasExperience) return false;
    if (q.intake_track === "experienced" && !hasExperience) return false;
    if (q.depends_on && !bools[q.depends_on]) return false;
    return true;
  }

  const sectionSteps = useMemo(() => {
    if (expChoice === null) return [];
    const used = new Set<string>();
    const steps = SECTIONS.map((s) => {
      const qs = rest.filter((q) => s.keys.includes(q.key) && visible(q));
      qs.forEach((q) => used.add(q.id));
      return { title: s.title, hint: s.hint, questions: qs };
    }).filter((s) => s.questions.length > 0);
    const extra = rest.filter((q) => visible(q) && !used.has(q.id));
    if (extra.length) steps.push({ title: "פרטים נוספים", hint: "עוד כמה פרטים קטנים.", questions: extra });
    return steps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expChoice, bools]);

  const totalSteps = 1 + sectionSteps.length;
  const cur = Math.min(step, totalSteps - 1);

  // --- validation ---
  function missing(q: ConfigQuestion, fd: FormData): boolean {
    const key = `q_${q.id}`;
    if (q.field_type === "multiselect" || q.field_type === "tags") {
      const vals = fd.getAll(key).map(String);
      const other = String(fd.get(`${key}__other`) ?? "").trim();
      const count = vals.filter((v) => v !== "other").length + (vals.includes("other") && other ? 1 : 0);
      return count === 0;
    }
    if (q.field_type === "select") {
      let v = String(fd.get(key) ?? "");
      if (v === "other") v = String(fd.get(`${key}__other`) ?? "").trim();
      return !v;
    }
    if (q.field_type === "bool") return false;
    return !String(fd.get(key) ?? "").trim();
  }
  function validateStep(qs: ConfigQuestion[]): boolean {
    const fd = new FormData(formRef.current!);
    const errs: Record<string, string> = {};
    for (const q of qs) if (q.required && missing(q, fd)) errs[q.id] = "שדה חובה";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (cur === 0) {
      const fd = new FormData(formRef.current!);
      const first = String(fd.get("first_name") ?? "").trim();
      const last = String(fd.get("last_name") ?? "").trim();
      if (first.length < 1 || last.length < 1) {
        setNameError(true);
        return;
      }
      if (expChoice === null) {
        setGateError(true);
        return;
      }
    } else if (!validateStep(sectionSteps[cur - 1].questions)) {
      return;
    }
    setErrors({});
    setStep(Math.min(cur + 1, totalSteps - 1));
  }
  function back() {
    setErrors({});
    setStep(Math.max(0, cur - 1));
  }

  const stepTitle = cur === 0 ? "כמה פרטים ונצא לדרך 💜" : sectionSteps[cur - 1].title;
  const stepHint =
    cur === 0
      ? "נתחיל בלספר לנו מאיפה את מגיעה — ונתאים לך את השאלות."
      : sectionSteps[cur - 1].hint;

  // ---- a single question field ----
  function renderField(q: ConfigQuestion) {
    const key = `q_${q.id}`;
    const current = answers[q.id];
    const list = opts(q);
    const err = errors[q.id];

    if (q.field_type === "select") {
      const isOther = selOther[q.id];
      return (
        <Field key={q.id} label={q.label_he} htmlFor={key} error={err}>
          <Select
            id={key}
            name={key}
            defaultValue={isOther ? "other" : typeof current === "string" ? current : ""}
            onChange={(e) => setSelOther((s) => ({ ...s, [q.id]: e.target.value === "other" }))}
          >
            <option value="">בחרי…</option>
            {list.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {isOther && (
            <Input name={`${key}__other`} placeholder="פירוט…" defaultValue={customText(q)} className="mt-2" />
          )}
        </Field>
      );
    }

    if (q.field_type === "multiselect" || q.field_type === "tags") {
      const arr = Array.isArray(current) ? (current as string[]) : [];
      const isOther = multiOther[q.id];
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          <div className="flex flex-wrap gap-x-4 gap-y-2.5 pt-1">
            {list.map((o) => (
              <Checkbox
                key={o.value}
                name={key}
                value={o.value}
                defaultChecked={isOtherVal(o.value) ? isOther : arr.includes(o.value)}
                label={o.label}
                onChange={
                  isOtherVal(o.value)
                    ? (e) => setMultiOther((s) => ({ ...s, [q.id]: e.target.checked }))
                    : undefined
                }
              />
            ))}
          </div>
          {isOther && (
            <Input name={`${key}__other`} placeholder="פירוט…" defaultValue={customText(q)} className="mt-2" />
          )}
        </Field>
      );
    }

    if (q.field_type === "bool") {
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          <Checkbox
            name={key}
            defaultChecked={bools[q.key]}
            label="כן"
            onChange={(e) => setBools((b) => ({ ...b, [q.key]: e.target.checked }))}
          />
        </Field>
      );
    }

    if (q.field_type === "number") {
      return (
        <Field key={q.id} label={q.label_he} htmlFor={key} error={err}>
          <Input id={key} name={key} type="number" dir="ltr" defaultValue={typeof current === "number" ? current : ""} />
        </Field>
      );
    }

    const isLong = LONG_TEXT.has(q.key);
    return (
      <Field key={q.id} label={q.label_he} htmlFor={key} error={err}>
        {isLong ? (
          <Textarea id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
        ) : (
          <Input id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
        )}
      </Field>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הפרופיל נשמר ✓</Alert>}

      {/* progress */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === cur ? "w-7 bg-brand-pink-deep" : i < cur ? "w-4 bg-brand-pink" : "w-4 bg-ink-200"
            )}
          />
        ))}
        <span className="text-[11px] text-ink-400 ms-2">
          שלב {cur + 1} מתוך {totalSteps}
        </span>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-ink-1000">{stepTitle}</h3>
        <p className="t-body-sm text-ink-500 mt-0.5">{stepHint}</p>
      </div>

      {/* Step 0: name + experience gate */}
      <div className={cn("flex flex-col gap-4", cur === 0 ? "" : "hidden")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="שם פרטי" htmlFor="first_name" error={nameError ? "נשמח לדעת איך קוראים לך 🙂" : undefined}>
            <Input
              id="first_name"
              name="first_name"
              defaultValue={firstName}
              onChange={() => nameError && setNameError(false)}
            />
          </Field>
          <Field label="שם משפחה" htmlFor="last_name">
            <Input
              id="last_name"
              name="last_name"
              defaultValue={lastName}
              onChange={() => nameError && setNameError(false)}
            />
          </Field>
        </div>

        {gate && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-700">{gate.label_he}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setExpChoice(false);
                  setGateError(false);
                }}
                className={cn(
                  "text-start rounded-[14px] border p-4 transition-all",
                  expChoice === false
                    ? "border-brand-pink-deep bg-tint-pink shadow-sm"
                    : "border-ink-200 hover:border-brand-pink"
                )}
              >
                <Rocket size={18} className="text-brand-pink-deep mb-1.5" />
                <div className="font-display font-bold text-ink-1000">אני בתחילת הדרך</div>
                <div className="text-[12.5px] text-ink-500 mt-0.5">בוגרת לימודים/בוטקאמפ, עדיין בלי ניסיון תעשייתי מעל שנה</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpChoice(true);
                  setGateError(false);
                }}
                className={cn(
                  "text-start rounded-[14px] border p-4 transition-all",
                  expChoice === true
                    ? "border-brand-purple bg-tint-purple shadow-sm"
                    : "border-ink-200 hover:border-brand-purple"
                )}
              >
                <Sparkles size={18} className="text-brand-purple mb-1.5" />
                <div className="font-display font-bold text-ink-1000">יש לי ניסיון</div>
                <div className="text-[12.5px] text-ink-500 mt-0.5">ניסיון אמיתי בתעשייה מעל שנה (גם אם כרגע בין עבודות)</div>
              </button>
            </div>
            {/* submit the gate answer with the rest of the form */}
            {expChoice === true && <input type="hidden" name={`q_${gate.id}`} value="on" />}
            {gateError && <span className="text-danger text-xs">בחרי אחת מהאפשרויות כדי להמשיך 🙂</span>}
          </div>
        )}
      </div>

      {/* section steps (all mounted so values submit; only current is shown) */}
      {sectionSteps.map((s, i) => (
        <div key={i} className={cn("flex flex-col gap-4", cur === i + 1 ? "" : "hidden")}>
          {s.questions.map(renderField)}
        </div>
      ))}

      {/* navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-ink-100">
        {cur > 0 ? (
          <Button type="button" variant="ghost" onClick={back}>
            <ChevronRight size={16} /> הקודם
          </Button>
        ) : (
          <span />
        )}

        {cur < totalSteps - 1 || expChoice === null ? (
          <Button type="button" onClick={next}>
            הבא <ChevronLeft size={16} />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={pending}
            onClick={(e) => {
              if (!validateStep(sectionSteps[cur - 1]?.questions ?? [])) e.preventDefault();
            }}
          >
            {pending ? "שומר…" : "סיום ושמירה ✓"}
          </Button>
        )}
      </div>
    </form>
  );
}
