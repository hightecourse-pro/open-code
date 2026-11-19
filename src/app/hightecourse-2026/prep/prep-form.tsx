"use client";

import { useState, useTransition } from "react";
import { H } from "@/app/ai-course/theme";
import { AI_TOOLS, CONF, DEV_TOOLS, LICENSE_LABEL, TEXT, TOOL_NONE, TOOL_OTHER, type LicenseSource, type PrepAnswers, type PrepKind } from "@/lib/hc-preconf/config";
import { submitPrepAnswers } from "./actions";

/*
  The questionnaire (the owner, 19/11): role, laptop yes/no (״לא״ → the
  rental line), the AI tools with a licence - the developers' list or the
  general one - with ״אין לי״ → the free-tools note; the soft-skills course
  adds the office; the management course asks its four questions. What she
  answered before is already filled in; sending again replaces it.
*/
type Questions = { role: boolean; office: boolean; laptop: boolean; tools: "dev" | "ai" | null; mgmt: boolean };

const inputCls = "w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-[16px] outline-none transition-colors placeholder:text-[#9AAAB9] focus:border-[#004878]";
const fmtDate = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[14.5px] font-bold" style={{ color: H.navy }}>
        {label}
      </label>
      {hint && (
        <p className="text-[13.5px]" style={{ color: H.muted }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function Choice({ name, value, label, checked, onChange, type = "radio", testId }: { name: string; value: string; label: string; checked: boolean; onChange: () => void; type?: "radio" | "checkbox"; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border-2 bg-white px-3.5 py-2.5 text-[15.5px]" style={{ borderColor: checked ? H.navy : H.line, color: H.ink }}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="h-4.5 w-4.5" style={{ accentColor: H.navy }} data-testid={testId} />
      <span className={checked ? "font-bold" : ""}>{label}</span>
    </label>
  );
}

export function PrepForm({ token, kind, laptopRequired, questions, initial, answeredAt }: { token: string; kind: PrepKind; laptopRequired: boolean; questions: Questions; initial: PrepAnswers; answeredAt: string | null }) {
  const [a, setA] = useState<PrepAnswers>({ ...initial, tools: initial.tools ?? [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PrepAnswers>(k: K, v: PrepAnswers[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const tools = a.tools ?? [];
  const toolList = questions.tools === "dev" ? DEV_TOOLS : AI_TOOLS;
  const hasNone = tools.includes(TOOL_NONE);
  const hasOther = tools.includes(TOOL_OTHER);
  const hasRealTool = tools.some((t) => t !== TOOL_NONE);
  const toggleTool = (t: string) => {
    setA((prev) => {
      const cur = prev.tools ?? [];
      if (t === TOOL_NONE) return { ...prev, tools: cur.includes(t) ? [] : [TOOL_NONE] };
      const without = cur.filter((x) => x !== TOOL_NONE);
      return { ...prev, tools: without.includes(t) ? without.filter((x) => x !== t) : [...without, t] };
    });
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (questions.role && !(a.role ?? "").trim()) e.role = "מה התפקיד שלך?";
    if (questions.office && !(a.office ?? "").trim()) e.office = "באיזה משרד / חברה את עובדת?";
    if (questions.laptop && !a.laptop) e.laptop = "מגיעה עם מחשב נייד או בלי?";
    if (questions.tools) {
      if (tools.length === 0) e.tools = "סמני את הכלים שיש לך, או ״אין לי״.";
      if (hasOther && !(a.toolsOther ?? "").trim()) e.toolsOther = "איזה כלי?";
      if (hasRealTool && !a.license) e.license = "מאיפה הרישיון?";
    }
    if (questions.mgmt) {
      if (!(a.mgmtRole ?? "").trim()) e.mgmtRole = "מה התפקיד הניהולי שלך?";
      if (!(a.years ?? "").trim()) e.years = "כמה שנות ניסיון?";
    }
    return e;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    start(async () => {
      const r = await submitPrepAnswers(token, a).catch(() => ({ ok: false, error: "network" }));
      if (!r.ok) {
        setServerError("השמירה לא הצליחה - נסי שוב בעוד רגע.");
        return;
      }
      setDone(new Date().toISOString());
    });
  };

  const err = (k: string) =>
    errors[k] ? (
      <p className="text-[13.5px] font-bold" style={{ color: H.red }} data-testid={`prep-error-${k}`}>
        {errors[k]}
      </p>
    ) : null;

  if (done) {
    return (
      <section className="rounded-[26px] bg-white p-6 shadow-sm sm:p-9" data-testid="prep-done">
        <h2 className="text-[26px] font-black" style={{ color: H.navy }}>
          תודה, נשמר!
        </h2>
        <p className="mt-2 text-[16px] leading-relaxed">התשובות שלך נשמרו אצלנו. אפשר לחזור לקישור הזה ולעדכן אותן עד הכנס.</p>
        {questions.laptop && a.laptop === "no" && (
          <div className="mt-4 rounded-xl px-4 py-3 text-[15px] leading-relaxed" style={{ background: H.yellowSoft, borderRight: `4px solid ${H.yellow}` }}>
            {TEXT.noLaptopOption}{" "}
            <a href={CONF.site} className="font-bold underline" style={{ color: H.navy }}>
              לאזור האישי
            </a>
          </div>
        )}
        <button type="button" onClick={() => setDone(null)} className="mt-5 rounded-full px-5 py-2 text-[14.5px] font-bold" style={{ border: `1.5px solid ${H.navy}`, color: H.navy }} data-testid="prep-edit">
          לעריכת התשובות
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-[26px] bg-white p-6 shadow-sm sm:p-9" data-testid="prep-form" data-kind={kind}>
      {answeredAt && (
        <p className="rounded-xl px-4 py-2.5 text-[14px]" style={{ background: H.row, color: H.muted }} data-testid="prep-answered-before">
          מילאת את השאלון ב-<span dir="ltr">{fmtDate.format(new Date(answeredAt))}</span>. אפשר לעדכן ולשלוח שוב.
        </p>
      )}

      {!questions.laptop && (
        <p className="rounded-xl px-4 py-3 text-[15px] font-bold" style={{ background: H.row, color: H.navy }} data-testid="prep-no-laptop">
          לקורס שלך לא נדרש מחשב נייד.
        </p>
      )}

      {questions.role && (
        <Field label="תפקיד" htmlFor="prep-role">
          <input id="prep-role" className={inputCls} style={{ borderColor: H.line }} value={a.role ?? ""} onChange={(e) => set("role", e.target.value)} autoComplete="organization-title" data-testid="prep-role" />
          {err("role")}
        </Field>
      )}

      {questions.office && (
        <Field label="משרד / חברה" htmlFor="prep-office">
          <input id="prep-office" className={inputCls} style={{ borderColor: H.line }} value={a.office ?? ""} onChange={(e) => set("office", e.target.value)} autoComplete="organization" data-testid="prep-office" />
          {err("office")}
        </Field>
      )}

      {questions.laptop && (
        <Field label="האם את מגיעה עם מחשב נייד?" hint={laptopRequired ? "בקורס שלך נדרש מחשב נייד, והתרגול נעשה עם כלי AI." : undefined}>
          <div className="grid grid-cols-2 gap-2">
            <Choice name="laptop" value="yes" label="כן, מגיעה עם מחשב" checked={a.laptop === "yes"} onChange={() => set("laptop", "yes")} testId="prep-laptop-yes" />
            <Choice name="laptop" value="no" label="לא" checked={a.laptop === "no"} onChange={() => set("laptop", "no")} testId="prep-laptop-no" />
          </div>
          {a.laptop === "no" && (
            <div className="rounded-xl px-4 py-3 text-[14.5px] leading-relaxed" style={{ background: H.yellowSoft, borderRight: `4px solid ${H.yellow}` }} data-testid="prep-rental-note">
              {TEXT.noLaptopOption}{" "}
              <a href={CONF.site} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: H.navy }}>
                לאזור האישי באתר הייטקורס
              </a>
            </div>
          )}
          {err("laptop")}
        </Field>
      )}

      {questions.tools && (
        <Field label={questions.tools === "dev" ? "איזה כלי AI לפיתוח יש לך עם רישיון?" : "איזה כלי AI יש לך עם רישיון?"} hint="רישיון מהעבודה או פרטי - אפשר לסמן כמה.">
          <div className="grid gap-2 sm:grid-cols-2">
            {toolList.map((t) => (
              <Choice key={t} type="checkbox" name="tools" value={t} label={t} checked={tools.includes(t)} onChange={() => toggleTool(t)} testId={`prep-tool-${t.replace(/\s+/g, "-").toLowerCase()}`} />
            ))}
            <Choice type="checkbox" name="tools" value={TOOL_OTHER} label="אחר" checked={hasOther} onChange={() => toggleTool(TOOL_OTHER)} testId="prep-tool-other" />
            <Choice type="checkbox" name="tools" value={TOOL_NONE} label={TOOL_NONE} checked={hasNone} onChange={() => toggleTool(TOOL_NONE)} testId="prep-tool-none" />
          </div>
          {hasOther && (
            <div className="space-y-1.5">
              <input className={inputCls} style={{ borderColor: H.line }} placeholder="איזה כלי?" value={a.toolsOther ?? ""} onChange={(e) => set("toolsOther", e.target.value)} data-testid="prep-tools-other" />
              {err("toolsOther")}
            </div>
          )}
          {hasNone && (
            <p className="rounded-xl px-4 py-3 text-[14.5px] leading-relaxed" style={{ background: H.yellowSoft, borderRight: `4px solid ${H.yellow}` }} data-testid="prep-no-tools-note">
              {TEXT.noToolsNote}
            </p>
          )}
          {err("tools")}
          {hasRealTool && (
            <div className="space-y-1.5 pt-1">
              <span className="block text-[14px] font-bold" style={{ color: H.navy }}>
                מאיפה הרישיון?
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(LICENSE_LABEL) as LicenseSource[]).map((k) => (
                  <Choice key={k} name="license" value={k} label={LICENSE_LABEL[k]} checked={a.license === k} onChange={() => set("license", k)} testId={`prep-license-${k}`} />
                ))}
              </div>
              {err("license")}
            </div>
          )}
        </Field>
      )}

      {questions.mgmt && (
        <>
          <Field label="תפקיד ניהולי" htmlFor="prep-mgmt-role">
            <input id="prep-mgmt-role" className={inputCls} style={{ borderColor: H.line }} value={a.mgmtRole ?? ""} onChange={(e) => set("mgmtRole", e.target.value)} data-testid="prep-mgmt-role" />
            {err("mgmtRole")}
          </Field>
          <Field label="מספר עובדים מתחתייך" hint={TEXT.employeesHint} htmlFor="prep-employees">
            <input id="prep-employees" className={inputCls} style={{ borderColor: H.line }} inputMode="numeric" value={a.employees ?? ""} onChange={(e) => set("employees", e.target.value)} data-testid="prep-employees" />
          </Field>
          <Field label="שנות ניסיון" htmlFor="prep-years">
            <input id="prep-years" className={inputCls} style={{ borderColor: H.line }} inputMode="numeric" value={a.years ?? ""} onChange={(e) => set("years", e.target.value)} data-testid="prep-years" />
            {err("years")}
          </Field>
        </>
      )}

      <Field label="משהו שחשוב לנו לדעת? (לא חובה)" htmlFor="prep-note">
        <textarea id="prep-note" className={inputCls} style={{ borderColor: H.line }} rows={2} value={a.note ?? ""} onChange={(e) => set("note", e.target.value)} data-testid="prep-note" />
      </Field>

      {serverError && (
        <p className="text-[14px] font-bold" style={{ color: H.red }} data-testid="prep-server-error">
          {serverError}
        </p>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-full px-6 py-3.5 text-[17px] font-black disabled:opacity-60 sm:w-auto" style={{ background: H.yellow, color: H.navy }} data-testid="prep-submit">
        {pending ? "שומרת..." : "שליחה"}
      </button>
    </form>
  );
}
