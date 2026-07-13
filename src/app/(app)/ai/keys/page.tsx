import type { Metadata } from "next";
import { ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { listUserKeys } from "@/lib/ai/keys";
import { Badge } from "@/components/ui";
import { AddKeyForm } from "@/components/patterns/add-key-form";
import { removeKey } from "./actions";

export const metadata: Metadata = { title: "מפתחות ה-AI שלי" };

const STATUS: Record<string, { label: string; variant: "mint" | "warm" | "tech" }> = {
  active: { label: "פעיל", variant: "mint" },
  exhausted: { label: "נגמרה המכסה", variant: "warm" },
  invalid: { label: "לא תקין", variant: "tech" },
};

const STEPS = [
  "היכנסי ל-Google AI Studio (הכפתור למעלה) והתחברי עם חשבון Google שלך.",
  'לחצי על "Create API key" (צור מפתח API).',
  "בחרי פרויקט קיים או צרי פרויקט חדש ב-Google Cloud.",
  "העתיקי את המפתח שנוצר (כפתור ההעתקה).",
  "הדביקי אותו בטופס למטה ושמרי. זהו! 💜",
];

export default async function AiKeysPage() {
  const keys = await listUserKeys();
  const hasActive = keys.some((k) => k.status === "active");

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מפתחות AI/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מפתחות ה-AI שלי</h1>
        <p className="t-body-sm text-ink-700">
          כלי ה-AI (בודקת קו&quot;ח וסימולטור הראיונות) עובדים עם מפתח Google משלך — כך השליטה והמכסה
          בידיים שלך. המפתח נשמר אצלנו <b>מוצפן</b> ולא נחשף לאף אחת אחרת.
        </p>
      </div>

      {!hasActive && (
        <div className="bg-tint-warm border border-[#F8D98C] rounded-md p-4 text-[13.5px] text-[#8C5E0E]">
          עדיין אין לך מפתח פעיל — כלי ה-AI לא יעבדו עד שתוסיפי מפתח אחד למטה.
        </div>
      )}

      {/* instructions */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-1">איך משיגים מפתח מ-Google?</h2>
        <p className="t-body-sm text-ink-500 mb-4">חינמי, לוקח דקה. קודם פתחי את AI Studio, ואז עקבי אחרי השלבים:</p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mb-4 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white hover:opacity-90 transition-opacity"
        >
          פתיחת Google AI Studio <ExternalLink size={14} />
        </a>
        <ol className="flex flex-col gap-2.5">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14px] text-ink-800">
              <span className="w-6 h-6 rounded-full bg-tint-purple text-brand-purple font-display font-bold text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* add key */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-3 flex items-center gap-2">
          <KeyRound size={18} className="text-brand-purple" /> הוספת מפתח
        </h2>
        <AddKeyForm />
      </div>

      {/* existing keys */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-3">המפתחות שלי ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-ink-500 text-sm">עדיין לא הוספת מפתחות.</p>
        ) : (
          <div className="flex flex-col">
            {keys.map((k) => {
              const st = STATUS[k.status] ?? STATUS.active;
              return (
                <div key={k.id} className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0">
                  <KeyRound size={16} className="text-ink-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900 truncate">
                      {k.label || "מפתח Google"}{" "}
                      <span className="font-mono text-xs text-ink-400" dir="ltr">
                        …{k.key_last4}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-500">
                      נוסף {new Date(k.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <form action={removeKey.bind(null, k.id)}>
                    <button
                      type="submit"
                      aria-label="מחיקה"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-danger hover:bg-danger-bg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {keys.some((k) => k.status !== "active") && (
        <div className="bg-tint-purple border border-[#DDC9EC] rounded-md p-4 text-[13.5px] text-ink-700">
          💡 מפתח שנגמרה לו המכסה? פשוט צרי מפתח חדש מחשבון Google אחר והוסיפי אותו כאן — נשתמש בו אוטומטית.
        </div>
      )}
    </div>
  );
}
