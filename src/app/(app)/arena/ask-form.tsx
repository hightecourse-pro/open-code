"use client";

import { useActionState, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
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

/**
 * The participant's question form (the owner, 18/10: no addressing - the
 * question goes to the whole arena and whoever can, answers): topic, private
 * or not, rich body with code and screenshots.
 */
export function AskForm({ mentors }: { mentors: AskMentorOption[] }) {
  const [state, action, pending] = useActionState<ArenaFormState, FormData>(askArenaQuestion, {});
  const [topic, setTopic] = useState("");
  const aiCount = mentors.filter((m) => m.ai).length;
  const presentCount = mentors.filter((m) => m.present).length;
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
        <Sparkles size={17} className="text-brand-pink-deep" /> שאלה חדשה
      </h2>
      <p className="text-[12.5px] text-ink-500 mt-0.5">
        השאלה מגיעה לכל המנטוריות בזירה ({mentors.length} זמינות{aiCount ? `, ${aiCount} מבינות ב-AI` : ""}
        {presentCount ? `, ${presentCount} כאן עכשיו 🟢` : ""}) - מי שיכולה, עונה. התשובה מגיעה אלייך למייל ולכאן. אפשר להדביק קוד ולצרף צילום מסך.
      </p>
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
