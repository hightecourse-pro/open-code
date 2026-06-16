import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge } from "@/components/ui";
import { startConversation } from "../chat/actions";

export const metadata: Metadata = { title: "המנטוריות שלי" };

export default async function MentorPage() {
  const supabase = await createClient();
  const { data: mentors } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, specialization, bio")
    .eq("role", "mentor")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המנטוריות שלנו 👑</h1>
        <p className="t-body-sm text-ink-700">נשים מנוסות שהצטרפו כדי לעזור. אפשר לכתוב להן ישירות.</p>
      </div>

      {mentors && mentors.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mentors.map((m) => (
            <div key={m.id} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar size="lg" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
                <div>
                  <div className="font-display font-bold text-ink-1000">{m.full_name}</div>
                  {m.specialization && <Badge variant="purple">{m.specialization}</Badge>}
                </div>
              </div>
              {m.bio && <p className="text-[13.5px] text-ink-700 leading-relaxed line-clamp-3">{m.bio}</p>}
              <form action={startConversation.bind(null, m.id)} className="mt-auto">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2.5 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple transition-colors"
                >
                  <MessageCircle size={15} /> שלחי הודעה
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          עדיין לא הצטרפו מנטוריות. בקרוב 💜
        </div>
      )}
    </div>
  );
}
