import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Button } from "@/components/ui";
import { setMemberRoleAction } from "../actions";

export const metadata: Metadata = { title: "ניהול מנטוריות" };

export default async function AdminMentorsPage() {
  const supabase = await createClient();
  const [{ data: mentors }, { data: candidates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization")
      .eq("role", "mentor")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization")
      .eq("role", "junior")
      .eq("status", "active")
      .order("full_name")
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול מנטוריות</h1>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">מנטוריות פעילות ({mentors?.length ?? 0})</h3>
        {mentors && mentors.length > 0 ? (
          <div className="flex flex-col">
            {mentors.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
                <Avatar size="sm" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{m.full_name}</div>
                  {m.specialization && <Badge variant="purple">{m.specialization}</Badge>}
                </div>
                <form action={setMemberRoleAction.bind(null, m.id, "junior")}>
                  <Button type="submit" variant="ghost" size="sm">הסרה ממנטורית</Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">עדיין אין מנטוריות. מנּי חברה פעילה מהרשימה למטה.</p>
        )}
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">מינוי חברה כמנטורית</h3>
        <div className="flex flex-col">
          {(candidates ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <Avatar size="sm" tone="pink" initials={c.avatar_initials || c.full_name.slice(0, 1)} />
              <div className="flex-1 min-w-0 font-medium text-ink-900 truncate">{c.full_name}</div>
              <form action={setMemberRoleAction.bind(null, c.id, "mentor")}>
                <Button type="submit" size="sm">מינוי כמנטורית 👑</Button>
              </form>
            </div>
          ))}
          {(candidates ?? []).length === 0 && (
            <p className="text-ink-500 text-sm">אין חברות פעילות זמינות למינוי כרגע.</p>
          )}
        </div>
      </div>
    </div>
  );
}
