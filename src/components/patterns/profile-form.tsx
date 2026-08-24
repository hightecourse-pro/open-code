"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Rocket, Plus, X } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveProfile, type ProfileState } from "@/app/(app)/profile/actions";
import { applyAsMentor } from "@/app/join/actions";
import { FIELD_VALIDATORS } from "@/lib/validators";
import { groupBySection } from "@/lib/profile-sections";
import { CITIES } from "@/data/cities";
import {
  DEFAULT_LANGUAGES,
  LANGUAGE_SKILLS_KEY,
  LANG_LEVELS,
  parseLangSkills,
  type LangSkill,
} from "@/lib/language-skills";
import {
  EXPERIENCE_KEYS,
  PRACTICAL_EXPERIENCE_KEY,
  PRACTICUM_PERIOD_KEY,
  isCompleteExperienceEntry,
  isValidYm,
  parseExperienceEntries,
  parsePracticumPeriod,
  type ExperienceEntry,
} from "@/lib/experience-entries";
import { ExperienceListEditor } from "@/components/patterns/experience-list-editor";
import { PeriodPicker } from "@/components/patterns/period-picker";
import type { ConfigQuestion, TaxonomyKind } from "@/types/database";

type Option = { value: string; label: string };

export interface ProfileFormProps {
  firstName: string;
  lastName: string;
  questions: ConfigQuestion[];
  answers: Record<string, unknown>; // question_id -> value
  taxonomyOptions?: Partial<Record<TaxonomyKind, Option[]>>;
  /** She has no CV yet — the final step collects one, required (PM rule). */
  requireCv?: boolean;
  /** First-time signup may switch to the mentor track from the gate step. */
  allowMentorTrack?: boolean;
}

const LONG_TEXT = new Set([
  "bio",
  "ai_project_links",
  "github",
  "live_links",
  "notes_for_us",
  "work_description",
  "practicum_description",
]);
const isOtherVal = (v: string) => v === "other";

// Short related fields share a row instead of each taking a full one — the
// tester's "אפשר לחבר לשורה אחת (רחוב, מס' בית, עיר)". Only consecutive
// questions from one group are joined, so an admin reordering the form can
// always split them again.
const ROW_GROUPS: string[][] = [
  ["city", "street", "house_number"],
  ["id_number", "phone"],
];

// The wizard's steps live in @/lib/profile-sections so the configuration screen
// can group by exactly the same rule — otherwise the admin reorders a flat list
// that the member never sees in that order.

export function ProfileForm({ firstName, lastName, questions, answers, taxonomyOptions = {}, requireCv = false, allowMentorTrack = false }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvError, setCvError] = useState(false);

  // A server-side save error must be seen — scroll it into view.
  useEffect(() => {
    if (state.error) alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

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
  // Multiselects render as chip toggles — the selection is client state,
  // submitted through hidden inputs (storage stays an array of option values).
  const initMultiVals: Record<string, string[]> = {};
  for (const q of rest) {
    if (q.field_type === "bool") initBools[q.key] = answers[q.id] === true;
    const vals = opts(q).map((o) => o.value);
    if (q.field_type === "select") {
      const cur = answers[q.id];
      if (typeof cur === "string" && cur && !vals.includes(cur)) initSelOther[q.id] = true;
    } else if (q.field_type === "multiselect" || q.field_type === "tags") {
      const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      const known = arr.filter((v) => vals.includes(v) && !isOtherVal(v));
      // Custom (free-text) values keep the "אחר" chip on with its text intact.
      initMultiVals[q.id] = arr.some((v) => !vals.includes(v)) ? [...known, "other"] : known;
    }
  }
  const [bools, setBools] = useState(initBools);
  const [selOther, setSelOther] = useState(initSelOther);
  const [multiVals, setMultiVals] = useState(initMultiVals);

  // Language-skills matrix: saved rows first, then any default language not
  // answered yet (with an empty level = "not stored").
  const langQ = rest.find((q) => q.key === LANGUAGE_SKILLS_KEY);
  const initLangRows: LangSkill[] = (() => {
    const saved = langQ ? parseLangSkills(answers[langQ.id]) : [];
    const savedNames = new Set(saved.map((s) => s.lang));
    return [
      ...DEFAULT_LANGUAGES.map(
        (lang) => saved.find((s) => s.lang === lang) ?? { lang, level: "" }
      ),
      ...saved.filter((s) => !DEFAULT_LANGUAGES.includes(s.lang) && savedNames.has(s.lang)),
    ];
  })();
  const [langRows, setLangRows] = useState<LangSkill[]>(initLangRows);
  const [newLang, setNewLang] = useState("");

  function addLanguage() {
    const name = newLang.trim();
    if (!name || langRows.some((r) => r.lang === name)) return;
    setLangRows((rows) => [...rows, { lang: name, level: "" }]);
    setNewLang("");
  }
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
    return groupBySection(rest, visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expChoice, bools]);

  const totalSteps = 1 + sectionSteps.length;
  const cur = Math.min(step, totalSteps - 1);

  // --- validation ---
  function missing(q: ConfigQuestion, fd: FormData): boolean {
    const key = `q_${q.id}`;
    if (q.key === LANGUAGE_SKILLS_KEY) {
      // עברית ואנגלית are always present and must each carry a rated level.
      const langs = fd.getAll(`${key}__lang`).map(String);
      const levels = fd.getAll(`${key}__level`).map(String);
      return DEFAULT_LANGUAGES.some((lang) => {
        const i = langs.indexOf(lang);
        return i === -1 || !LANG_LEVELS.some((l) => l.value === levels[i]);
      });
    }
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
  /** Entry-level rules for the two JSON-array experience questions. */
  function experienceError(q: ConfigQuestion, fd: FormData): string | undefined {
    let entries: ExperienceEntry[] = [];
    try {
      entries = parseExperienceEntries(JSON.parse(String(fd.get(`q_${q.id}`) || "[]")));
    } catch {
      entries = [];
    }
    const requireKind = q.key === PRACTICAL_EXPERIENCE_KEY;
    if (entries.some((e) => !isCompleteExperienceEntry(e, requireKind))) {
      return requireKind
        ? "בכל התנסות שהוספת צריך למלא סוג, מקום, תיאור ותאריכי התחלה וסיום 🙂"
        : "בכל מקום עבודה שהוספת צריך למלא מקום, תיאור ותאריכי התחלה וסיום 🙂";
    }
    if (q.required && entries.length === 0) {
      return "הוסיפי לפחות מקום עבודה אחד כדי שנוכל להציג את הניסיון שלך 🙂";
    }
    return undefined;
  }
  /** practicum_period: start required; end required unless "עוד לא סיימתי"; end after start. */
  function periodError(q: ConfigQuestion, fd: FormData): string | undefined {
    let raw: unknown = null;
    try {
      raw = JSON.parse(String(fd.get(`q_${q.id}`) || "null"));
    } catch {
      raw = null;
    }
    const p = parsePracticumPeriod(raw);
    if (!q.required && !p.start && !p.end) return undefined;
    if (!isValidYm(p.start)) return "סמני מתי התחלת — ואם עוד לא סיימת, סמני את זה 🙂";
    if (p.end !== "current") {
      if (!isValidYm(p.end)) return "סמני גם מתי סיימת — או סמני \"עוד לא סיימתי\" 🙂";
      if (p.end < p.start) return "רגע, תאריך הסיום יוצא לפני ההתחלה — בדקי שוב את התאריכים 🙂";
    }
    return undefined;
  }

  function validateStep(qs: ConfigQuestion[]): boolean {
    const fd = new FormData(formRef.current!);
    const errs: Record<string, string> = {};
    for (const q of qs) {
      if (EXPERIENCE_KEYS.has(q.key)) {
        const msg = experienceError(q, fd);
        if (msg) errs[q.id] = msg;
        continue;
      }
      if (q.key === PRACTICUM_PERIOD_KEY) {
        const msg = periodError(q, fd);
        if (msg) errs[q.id] = msg;
        continue;
      }
      if (q.required && missing(q, fd)) {
        errs[q.id] =
          q.key === LANGUAGE_SKILLS_KEY
            ? "סמני את רמת השליטה שלך בעברית ובאנגלית 🙂"
            : "שדה חובה";
        continue;
      }
      const check = FIELD_VALIDATORS[q.key];
      if (check) {
        const msg = check(String(fd.get(`q_${q.id}`) ?? ""));
        if (msg) errs[q.id] = msg;
      }
    }
    setErrors(errs);
    // Take her to the first problem instead of leaving her to hunt for red
    // text somewhere up a long step.
    const firstBad = qs.find((q) => errs[q.id]);
    if (firstBad) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`q_${firstBad.id}`);
        (el ?? alertRef.current)?.scrollIntoView({ behavior: "instant", block: "center" });
      });
    }
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
  /**
   * All the steps stay mounted and only toggle `hidden`, so the viewport keeps
   * the previous step's offset — after a long step she'd land mid-form instead
   * of on the first field of the new one. Scrolling used to run synchronously
   * inside next()/back(), i.e. BEFORE React committed the step swap: a smooth
   * scroll started against the old tall layout, the document reflowed under it,
   * and the animation visibly fought the clamp — the tester's "לא עובד חלק".
   * Post-commit + instant lands cleanly at the top of the new step.
   */
  const prevStep = useRef(0);
  useEffect(() => {
    if (prevStep.current === cur) return;
    prevStep.current = cur;
    alertRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [cur]);

  const stepTitle = cur === 0 ? "כמה פרטים ונצא לדרך 💜" : sectionSteps[cur - 1].title;
  const stepHint =
    cur === 0
      ? "ספרי לנו מאיפה את מגיעה — ואנחנו נתאים לך את השאלות."
      : sectionSteps[cur - 1].hint;

  // ---- a single question field ----
  function renderField(q: ConfigQuestion) {
    const key = `q_${q.id}`;
    const current = answers[q.id];
    const list = opts(q);
    const err = errors[q.id];

    // Experience lists: repeatable JSON-array editors (CV-style entries).
    if (EXPERIENCE_KEYS.has(q.key)) {
      const isPractical = q.key === PRACTICAL_EXPERIENCE_KEY;
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          {isPractical && (
            <p className="t-body-sm text-ink-500 -mt-0.5 mb-1">
              כאן צריך להופיע כל מה שמופיע בקורות החיים שלך — זה מה שלקוחות פוטנציאליים רואים.
            </p>
          )}
          <ExperienceListEditor
            name={key}
            variant={isPractical ? "practical" : "work"}
            initial={parseExperienceEntries(current)}
            techOptions={taxonomyOptions.tech ?? []}
            error={!!err}
          />
        </Field>
      );
    }

    // Practicum period: start/end month pickers submitting one JSON object.
    if (q.key === PRACTICUM_PERIOD_KEY) {
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          <PeriodPicker name={key} initial={parsePracticumPeriod(current)} />
        </Field>
      );
    }

    // Language skills: a (language × level) matrix with an "add language" row.
    if (q.key === LANGUAGE_SKILLS_KEY) {
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          <div className="flex flex-col gap-2">
            {langRows.map((row, i) => (
              <div key={row.lang} className="flex items-center gap-2">
                <input type="hidden" name={`${key}__lang`} value={row.lang} />
                <span className="w-24 shrink-0 text-sm font-medium text-ink-900">{row.lang}</span>
                {/* The Select renders inside a wrapper div — stretch that. */}
                <div className="flex-1">
                  <Select
                    name={`${key}__level`}
                    value={row.level}
                    onChange={(e) =>
                      setLangRows((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, level: e.target.value } : r))
                      )
                    }
                  >
                    <option value="">בחרי רמה…</option>
                    {LANG_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {!DEFAULT_LANGUAGES.includes(row.lang) && (
                  <button
                    type="button"
                    aria-label={`הסרת ${row.lang}`}
                    onClick={() => setLangRows((rows) => rows.filter((_, j) => j !== i))}
                    className="text-ink-400 hover:text-danger p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLanguage();
                  }
                }}
                placeholder="שפה נוספת (למשל: צרפתית, יידיש…)"
                className="flex-1"
              />
              <Button type="button" size="sm" variant="secondary" onClick={addLanguage}>
                <Plus size={14} /> הוספה
              </Button>
            </div>
          </div>
        </Field>
      );
    }

    // City: searchable input backed by the official settlements list.
    if (q.key === "city") {
      return (
        <Field key={q.id} label={q.label_he} htmlFor={key} error={err}>
          <Input
            id={key}
            name={key}
            list="oc-cities"
            autoComplete="off"
            placeholder="התחילי להקליד עיר…"
            error={!!err}
            defaultValue={typeof current === "string" ? current : ""}
          />
        </Field>
      );
    }

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
      // Chip toggles (the portal-search pattern) — friendlier than a checkbox
      // wall; the selection submits via hidden inputs in the same array format.
      const selected = multiVals[q.id] ?? [];
      const isOther = selected.includes("other");
      return (
        <Field key={q.id} label={q.label_he} error={err}>
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label={q.label_he}>
            {list.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setMultiVals((s) => ({
                      ...s,
                      [q.id]: on
                        ? selected.filter((v) => v !== o.value)
                        : [...selected, o.value],
                    }))
                  }
                  className={cn(
                    "inline-flex items-center px-3 py-[5px] rounded-full text-xs font-semibold",
                    "transition-colors duration-150 border cursor-pointer",
                    on
                      ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                      : "bg-ink-0 text-ink-700 border-ink-200 hover:border-brand-purple"
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {selected.map((v) => (
            <input key={v} type="hidden" name={key} value={v} />
          ))}
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
    const extra =
      q.key === "id_number"
        ? { inputMode: "numeric" as const, dir: "ltr" as const, maxLength: 9 }
        : q.key === "phone"
          ? { type: "tel", inputMode: "tel" as const, dir: "ltr" as const, placeholder: "05X-XXXXXXX" }
          : {};
    return (
      <Field key={q.id} label={q.label_he} htmlFor={key} error={err}>
        {isLong ? (
          <Textarea id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
        ) : (
          <Input
            id={key}
            name={key}
            error={!!err}
            defaultValue={typeof current === "string" ? current : ""}
            {...extra}
          />
        )}
      </Field>
    );
  }

  // Render a step's questions, joining consecutive ROW_GROUPS members into a
  // shared grid row (address trio, ID+phone pair).
  function renderRows(qs: ConfigQuestion[]) {
    const out: ReactNode[] = [];
    for (let i = 0; i < qs.length; ) {
      const grp = ROW_GROUPS.find((g) => g.includes(qs[i].key));
      if (!grp) {
        out.push(renderField(qs[i]));
        i++;
        continue;
      }
      const run: ConfigQuestion[] = [];
      while (i < qs.length && grp.includes(qs[i].key)) {
        run.push(qs[i]);
        i++;
      }
      if (run.length === 1) {
        out.push(renderField(run[0]));
        continue;
      }
      out.push(
        <div
          key={`row-${run[0].id}`}
          className={cn(
            "grid grid-cols-1 gap-3",
            run.length === 3 ? "sm:grid-cols-[1.2fr_1.2fr_0.7fr]" : "sm:grid-cols-2"
          )}
        >
          {run.map(renderField)}
        </div>
      );
    }
    return out;
  }

  return (
    <form
      ref={formRef}
      // Manual submit, not action={action}: React 19 resets an uncontrolled
      // form after a form-action completes, so a save that returned a
      // validation error also wiped everything she had typed back to the
      // stored defaults — "מילאתי ולא נשמר". Dispatching the same action inside
      // startTransition keeps useActionState's pending/state behavior without
      // the reset. Enter on an earlier step advances instead of submitting.
      onSubmit={(e) => {
        e.preventDefault();
        if (cur < totalSteps - 1 || expChoice === null) {
          next();
          return;
        }
        if (!validateStep(sectionSteps[cur - 1]?.questions ?? [])) return;
        const fd = new FormData(e.currentTarget);
        // The CV gate, client-side too: the server refuses without one, but the
        // red frame here beats a round trip.
        if (requireCv && !(fd.get("cv_file") instanceof File && (fd.get("cv_file") as File).size > 0)) {
          setCvError(true);
          return;
        }
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-5"
    >
      <datalist id="oc-cities">
        {CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div ref={alertRef}>
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.ok && <Alert variant="success">הפרופיל נשמר ✓</Alert>}
      </div>

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
                <div className="text-[12.5px] text-ink-500 mt-0.5">בוגרת לימודים/בוטקאמפ, עדיין בלי שנה של ניסיון בתעשייה</div>
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

        {/* The mentor door, right at the first step (PM: offer it on first
            entry). Switches her to the free approval track and reloads this
            wizard with the mentor questionnaire. */}
        {allowMentorTrack && (
          <form action={applyAsMentor} className="mt-1">
            <button
              type="submit"
              className="w-full text-start rounded-[14px] border border-[#EAD9A8] bg-tint-warm/60 p-4 transition-all hover:border-[#E5A93C]"
            >
              <div className="font-display font-bold text-ink-1000">מגיעה בתור מנטורית? 👑</div>
              <div className="text-[12.5px] text-ink-500 mt-0.5">
                מפתחת מנוסה שרוצה לתרום לקהילה — בלי מנוי ובלי תשלום. לחיצה תחליף לשאלון מנטוריות קצר.
              </div>
            </button>
          </form>
        )}
      </div>

      {/* section steps (all mounted so values submit; only current is shown) */}
      {sectionSteps.map((s, i) => (
        <div key={i} className={cn("flex flex-col gap-4", cur === i + 1 ? "" : "hidden")}>
          {renderRows(s.questions)}
        </div>
      ))}

      {/* At least one CV is part of a complete profile (PM rule). Mounted with
          the form so the file submits; visible only on the final step. */}
      {requireCv && (
        <div className={cn("flex flex-col gap-1.5", cur === totalSteps - 1 && expChoice !== null ? "" : "hidden")}>
          <span className="text-xs font-semibold text-ink-700">
            קורות חיים (חובה — לפחות קובץ אחד)
          </span>
          <label
            htmlFor="profile_cv_file"
            className={cn(
              "flex items-center gap-3 border-2 border-dashed rounded-md px-4 py-4 cursor-pointer transition-colors",
              cvFileName
                ? "border-[#A7E3C6] bg-tint-mint"
                : cvError
                  ? "border-danger bg-danger-bg"
                  : "border-ink-300 hover:border-brand-purple"
            )}
          >
            <span className="text-sm text-ink-700">
              {cvFileName ? (
                <>
                  <b dir="ltr">{cvFileName}</b> · נבחר ✓
                </>
              ) : (
                "בחרי קובץ PDF או Word — זה מה שנציג למעסיקים"
              )}
            </span>
          </label>
          <input
            id="profile_cv_file"
            name="cv_file"
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(e) => {
              setCvFileName(e.target.files?.[0]?.name ?? null);
              setCvError(false);
            }}
          />
          {cvError && (
            <span className="text-danger text-xs">בלי קורות חיים אי אפשר לסיים — העלי קובץ אחד 🙂</span>
          )}
        </div>
      )}

      {/* navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-ink-100">
        {cur > 0 ? (
          <Button type="button" variant="ghost" onClick={back}>
            <ChevronRight size={16} /> הקודם
          </Button>
        ) : (
          <span />
        )}

        {/* Distinct keys, deliberately: without them React reuses one DOM node
            for both buttons, and when next() advanced to the last step DURING
            the click's dispatch, the node's type flipped to submit and the
            browser fired the form action against a half-finished form —
            skipping the final step's validation entirely (BUG-020B). */}
        {cur < totalSteps - 1 || expChoice === null ? (
          <Button key="next" type="button" onClick={next}>
            הבא <ChevronLeft size={16} />
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={pending}>
            {pending ? "שומר…" : "סיום ושמירה ✓"}
          </Button>
        )}
      </div>
    </form>
  );
}
