"use client";

import { useActionState, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Alert, Avatar, Button, Input } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import { cn } from "@/lib/utils";
import { ARENA_TOPICS } from "@/lib/arena-shared";
import { askArenaQuestion, type ArenaFormState } from "./actions";

export interface AskMentorOption {
  id: string;
  name: string;
  initials: string;
  specialization: string | null;
  ai: boolean;
  present: boolean;
  techs: string[];
}

type Target = "random" | "random_ai" | "pick";

/** The participant's question form: topic, who answers (cards, not a dropdown), private or not, rich body with code and screenshots. */
export function AskForm({ mentors }: { mentors: AskMentorOption[] }) {
  const [state, action, pending] = useActionState<ArenaFormState, FormData>(askArenaQuestion, {});
  const [target, setTarget] = useState<Target>("random");
  const [topic, setTopic] = useState("");
  const [picked, setPicked] = useState("");
  const aiCount = mentors.filter((m) => m.ai).length;
  const presentCount = mentors.filter((m) => m.present).length;
  const options: { value: Target; title: string; sub: string }[] = [
    { value: "random", title: "מנטורית אקראית", sub: presentCount > 0 ? `${presentCount} כאן עכשיו 🟢 - הן קודמות; סה״כ ${mentors.length} זמינות` : `אחת מ-${mentors.length} המנטוריות הזמינות` },
    { value: "random_ai", title: "מנטורית שמבינה ב-AI", sub: aiCount > 0 ? `אקראית מתוך ${aiCount} שמפתחות או עובדות עם AI` : "אקראית, לפי מי שמבינה ב-AI" },
    { value: "pick", title: "לבחור מנטורית", sub: "מהכרטיסים - התמחות, טכנולוגיות, AI, ומי כאן עכשיו" },
  ];
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
        <Sparkles size={17} className="text-brand-pink-deep" /> שאלה חדשה
      </h2>
      <p className="text-[12.5px] text-ink-500 mt-0.5">כל המנטוריות רואות את השאלה; מי שבחרת מקבלת אותה גם למייל. התשובה מגיעה אלייך למייל ולכאן. אפשר להדביק קוד ולצרף צילום מסך.</p>
      <form action={action} className="mt-3 flex flex-col gap-3" key={state.ok ? "sent" : "editing"}>
        <label className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-700">כותרת קצרה</span>
          <Input name="title" required maxLength={160} placeholder="למשל: איך לחבר את Gemini לטבלת האקסל של שטראוס?" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-700">השאלה</span>
          <RichTextEditor
            id="arena-body"
            name="body"
            tools={["bold", "ul", "ol", "link", "code", "image"]}
            placeholder="מה ניסיתן, מה קורה, ומה הייתן רוצות שיקרה. קטע קוד (כפתור הקוד) או צילום מסך של השגיאה (כפתור התמונה) עוזרים מאוד."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-700">נושא</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ARENA_TOPICS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTopic(topic === t.key ? "" : t.key)}
                aria-pressed={topic === t.key}
                className={cn("rounded-full border px-2.5 py-1 text-[12.5px] font-semibold", topic === t.key ? "bg-brand-purple text-white border-brand-purple" : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple")}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="topic" value={topic} />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[12.5px] font-semibold text-ink-700 mb-1">מי תענה?</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn("flex items-start gap-2 rounded-[10px] border px-3 py-2 cursor-pointer bg-white", target === o.value ? "border-brand-purple bg-tint-purple/30" : "border-ink-200")}
            >
              <input type="radio" name="target" value={o.value} checked={target === o.value} onChange={() => setTarget(o.value)} className="mt-1" />
              <span>
                <b className="text-[13.5px]">{o.title}</b>
                <span className="block text-[12px] text-ink-600">{o.sub}</span>
              </span>
            </label>
          ))}
          {target === "pick" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {mentors.map((m) => (
                <label
                  key={m.id}
                  className={cn("flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5 cursor-pointer bg-white", picked === m.id ? "border-brand-purple bg-tint-purple/30" : "border-ink-200 hover:border-brand-purple/60")}
                >
                  <input type="radio" name="mentor_id" value={m.id} checked={picked === m.id} onChange={() => setPicked(m.id)} className="mt-1.5" required={target === "pick"} />
                  <Avatar size="sm" tone="gold" crown initials={m.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <b className="text-[13.5px] text-ink-1000">{m.name}</b>
                      {m.present && <span className="text-[11px] font-bold text-success">🟢 כאן עכשיו</span>}
                      {m.ai && <span className="text-[11px] font-bold text-brand-indigo">🤖 AI</span>}
                    </span>
                    {m.specialization && <span className="block text-[12px] text-ink-600">{m.specialization}</span>}
                    {m.techs.length > 0 && <span className="block text-[11.5px] text-ink-500 mt-0.5">{m.techs.join(" · ")}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
          <input type="checkbox" name="is_private" />
          <Lock size={13} className="text-ink-500" /> שאלה פרטית - רק המנטוריות והצוות רואות (לא צוותים אחרים)
        </label>
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
