import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { MemberActions } from "@/components/patterns/member-actions";

export const metadata: Metadata = { title: "דשבורד אדמין" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [active, pending, mentors, posts] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "mentor"),
    supabase.from("posts").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "חברות פעילות", value: active.count ?? 0 },
    { label: "ממתינות לאישור", value: pending.count ?? 0 },
    { label: "מנטוריות", value: mentors.count ?? 0 },
    { label: "פוסטים בקהילה", value: posts.count ?? 0 },
  ];

  const { data: pendingMembers } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, specialization, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(8);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;admin/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">דשבורד</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-ink-200 rounded-2xl p-4 px-[18px]">
            <div className="text-xs text-ink-500 tracking-[0.04em] uppercase font-semibold">
              {s.label}
            </div>
            <div className="font-display font-black text-[28px] text-ink-1000 mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold flex items-center gap-2 mb-1">
          חברות חדשות לאישור
          {(pendingMembers?.length ?? 0) > 0 && (
            <span className="bg-tint-pink text-brand-pink-deep px-2 py-px rounded-full text-[11px] font-bold">
              {pendingMembers!.length}
            </span>
          )}
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3.5">אשרי או דחי הצטרפות לקהילה.</p>

        {pendingMembers && pendingMembers.length > 0 ? (
          <div className="flex flex-col">
            {pendingMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0"
              >
                <Avatar size="xs" initials={m.avatar_initials || m.full_name.slice(0, 1) || "ק"} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{m.full_name || "—"}</div>
                  <div className="text-xs text-ink-500">{m.specialization || "חברה חדשה"}</div>
                </div>
                <MemberActions profileId={m.id} status={m.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500 py-4 text-center">אין כרגע חברות שממתינות לאישור 🎉</p>
        )}

        <Link
          href="/admin/members"
          className="inline-block mt-3 text-sm text-brand-purple font-semibold"
        >
          לכל החברות ←
        </Link>
      </div>
    </div>
  );
}
