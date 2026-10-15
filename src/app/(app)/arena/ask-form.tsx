"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { askArenaQuestion, type ArenaFormState } from "./actions";

export interface AskMentorOption {
  id: string;
  name: string;
  specialization: string | null;
  ai: boolean;
}

type Target = "random" | "random_ai" | "pick";

/** The participant's question form: who answers is her call. */
export function AskForm({ mentors }: { mentors: AskMentorOption[] }) {
  const [state, action, pending] = useActionState<ArenaFormState, FormData>(askArenaQuestion, {});
  const [target, setTarget] = useState<Target>("random");
  const aiCount = mentors.filter((m) => m.ai).length;
  const options: { value: Target; title: string; sub: string }[] = [
    { value: "random", title: "מנטורית אקראית", sub: `אחת מ-${mentors.length} המנטוריות הזמינות` },
    { value: "random_ai", title: "מנטורית שמבינה ב-AI", sub: aiCount > 0 ? `אקראית מתוך ${aiCount} שמפתחות או עובדות עם AI` : "אקראית, לפי מי שמבינה ב-AI" },
    { value: "pick", title: "לבחור מנטורית", sub: "מהרשימה - עם סימון למי שמבינה ב-AI" },
  ];
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
        <Sparkles size={17} className="text-brand-pink-deep" /> שאלה חדשה
      </h2>
      <p className="text-[12.5px] text-ink-500 mt-0.5">כל המנטוריות רואות את השאלה; מי שבחרת מקבלת אותה גם למייל. התשובה מגיעה אלייך למייל ולכאן.</p>
      <form action={action} className="mt-3 flex flex-col gap-3" key={state.ok ? "sent" : "editing"}>
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-700">כותרת קצרה</span>
          <Input name="title" required maxLength={160} placeholder="למשל: איך לחבר את Gemini לטבלת האקסל של שטראוס?" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-700">השאלה</span>
          <textarea
            name="body"
            required
            rows={5}
            maxLength={4000}
            placeholder="מה ניסיתן, מה קורה, ומה הייתן רוצות שיקרה. קטע קוד או הודעת שגיאה עוזרים מאוד."
            className="w-full rounded-[10px] border border-ink-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed focus:border-brand-purple outline-none"
          />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[12.5px] font-semibold text-ink-700 mb-1">מי תענה?</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex items-start gap-2 rounded-[10px] border px-3 py-2 cursor-pointer bg-white",
                target === o.value ? "border-brand-purple bg-tint-purple/30" : "border-ink-200"
              )}
            >
              <input type="radio" name="target" value={o.value} checked={target === o.value} onChange={() => setTarget(o.value)} className="mt-1" />
              <span>
                <b className="text-[13.5px]">{o.title}</b>
                <span className="block text-[12px] text-ink-600">{o.sub}</span>
              </span>
            </label>
          ))}
          {target === "pick" && (
            <select name="mentor_id" required className="text-[13px] border border-ink-300 rounded-md px-2.5 py-2 bg-white text-ink-800 mt-1" defaultValue="">
              <option value="" disabled>
                בחרי מנטורית…
              </option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.specialization ? ` · ${m.specialization}` : ""}
                  {m.ai ? " · 🤖 AI" : ""}
                </option>
              ))}
            </select>
          )}
        </fieldset>
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.ok && state.info && <Alert variant="success">{state.info}</Alert>}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "שולחת…" : "לשלוח לזירה"}
          </Button>
        </div>
      </form>
    </section>
  );
}
