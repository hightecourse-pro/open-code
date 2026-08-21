import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Button } from "@/components/ui";
import { ANSWER_POINTS, ASSIGNMENT_POINTS, mentorScores } from "@/lib/mentor-score";
import {
  approveMentorApplication,
  rejectMentorApplication,
  setMemberRoleAction,
} from "../actions";

export const metadata: Metadata = { title: "ניהול מנטוריות" };

export default async function AdminMentorsPage() {
  const supabase = await createClient();
  const [{ data: mentors }, { data: pendingApps }, { data: candidates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name"),
    // Self-served applications from the join screen — approving is what mails
    // her the promised "אושרת" email.
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, profile_completed, created_at")
      .eq("role", "mentor")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization")
      .eq("role", "junior")
      .eq("status", "active")
      .order("full_name")
      .limit(50),
  ]);

  const scores = await mentorScores((mentors ?? []).map((m) => m.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול מנטוריות</h1>
      </div>

      {(pendingApps ?? []).length > 0 && (
        <div className="bg-white border border-[#EAD9A8] rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-1">
            בקשות הצטרפות כמנטורית ({pendingApps!.length})
          </h3>
          <p className="text-[12.5px] text-ink-500 mb-3">
            אישור שולח לה מייל ופותח לה את הקהילה — בלי מנוי ובלי תשלום.
          </p>
          <div className="flex flex-col">
            {pendingApps!.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                <Avatar size="sm" tone="gold" initials={p.avatar_initials || p.full_name.slice(0, 1)} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/members/${p.id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {p.full_name}
                  </Link>
                  <div className="text-[11.5px] text-ink-500">
                    {p.profile_completed ? "השאלון מולא — אפשר לעבור עליו בפרופיל" : "עוד ממלאת את השאלון"}
                  </div>
                </div>
                {p.specialization && <Badge variant="purple">{p.specialization}</Badge>}
                <form action={approveMentorApplication.bind(null, p.id)}>
                  <Button type="submit" size="sm">אישור 👑</Button>
                </form>
                <form action={rejectMentorApplication.bind(null, p.id)}>
                  <Button type="submit" size="sm" variant="ghost">דחייה</Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">מנטוריות פעילות ({mentors?.length ?? 0})</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          הניקוד גלוי לכל הקהילה: {ANSWER_POINTS} נק&#39; על תשובה בפורום · {ASSIGNMENT_POINTS} נק&#39; על
          הצמדה לחברה. כאן רואים גם ממה הוא מורכב.
        </p>
        {mentors && mentors.length > 0 ? (
          <div className="flex flex-col">
            {mentors.map((m) => {
              const s = scores.get(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                  <Avatar size="sm" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="font-medium text-ink-900 truncate hover:text-brand-purple hover:underline"
                    >
                      {m.full_name}
                    </Link>
                    <div className="text-[11.5px] text-ink-500">
                      ⭐ {s?.score ?? 0} נק&#39; — {s?.answers ?? 0} תשובות בפורום · {s?.assignments ?? 0} הצמדות
                    </div>
                  </div>
                  {m.specialization && <Badge variant="purple">{m.specialization}</Badge>}
                  <form action={setMemberRoleAction.bind(null, m.id, "junior")}>
                    <Button type="submit" variant="ghost" size="sm">ביטול המינוי</Button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">עדיין אין מנטוריות. בחרי חברה פעילה מהרשימה למטה.</p>
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
