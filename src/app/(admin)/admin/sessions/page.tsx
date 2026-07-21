import type { Metadata } from "next";
import { Check, Trash2, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { AdminCreateSession } from "@/components/patterns/admin-create-session";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import { cancelSession, deleteSession, markSessionDone } from "../actions";

export const metadata: Metadata = { title: "ניהול סשנים" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export default async function AdminSessionsPage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    // select * so it stays backward-safe before the canceled_at column exists.
    .select("*")
    .order("scheduled_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;סשנים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול סשנים</h1>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">הוספת סשן</h3>
        <AdminCreateSession />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">כל הסשנים ({sessions?.length ?? 0})</h3>
        <div className="flex flex-col">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{s.title}</div>
                <div className="text-xs text-ink-500" dir="ltr">{fmt(s.scheduled_at)}</div>
              </div>
              {s.topic && <Badge variant="purple">{s.topic}</Badge>}
              {s.canceled_at ? (
                <Badge variant="pink">בוטל</Badge>
              ) : (
                <Badge variant={s.status === "done" ? "tech" : "mint"}>
                  {s.status === "done" ? "הסתיים" : s.status === "live" ? "מתקיים" : "מתוכנן"}
                </Badge>
              )}
              {!s.canceled_at && s.status !== "done" && (
                <>
                  <form action={markSessionDone.bind(null, s.id)}>
                    <button type="submit" className="text-ink-400 hover:text-[#1B7A4B] p-1.5" title="סימון כ'הסתיים'">
                      <Check size={15} />
                    </button>
                  </form>
                  <ConfirmActionButton
                    action={cancelSession.bind(null, s.id)}
                    message="לבטל את הסשן? הוא יסומן כ'בוטל' ויוסתר מהחברות אחרי 24 שעות."
                    title="ביטול סשן"
                    className="text-ink-400 hover:text-brand-pink-deep p-1.5"
                  >
                    <Ban size={15} />
                  </ConfirmActionButton>
                </>
              )}
              <ConfirmActionButton
                action={deleteSession.bind(null, s.id)}
                message="למחוק את הסשן לצמיתות? הפעולה אינה ניתנת לביטול."
                title="מחיקת סשן"
                className="text-ink-400 hover:text-danger p-1.5"
              >
                <Trash2 size={15} />
              </ConfirmActionButton>
            </div>
          ))}
          {(sessions ?? []).length === 0 && <p className="text-ink-500 text-sm py-4">אין סשנים עדיין.</p>}
        </div>
      </div>
    </div>
  );
}
