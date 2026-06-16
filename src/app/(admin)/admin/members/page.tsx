import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { MemberActions } from "@/components/patterns/member-actions";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";

export const metadata: Metadata = { title: "ניהול חברות" };

// Pending first, then by newest.
const STATUS_ORDER = { pending: 0, active: 1, paused: 2, rejected: 3 } as const;

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, role, status, specialization, region, created_at")
    .order("created_at", { ascending: false });

  const sorted = (members ?? []).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;חברות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול חברות</h1>
        <p className="t-body-sm text-ink-500">אישור חברות חדשות, ניהול סטטוס ותפקידים.</p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["חברה", "תחום", "תפקיד", "סטטוס", "פעולות"].map((h) => (
                <th
                  key={h}
                  className="text-right p-2 text-[11px] text-ink-500 tracking-[0.04em] uppercase font-semibold border-b border-ink-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="p-2 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <Avatar
                      size="xs"
                      tone={m.role === "mentor" ? "gold" : "pink"}
                      initials={m.avatar_initials || m.full_name.slice(0, 1) || "ק"}
                    />
                    <span className="font-medium text-ink-900">{m.full_name || "—"}</span>
                  </div>
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">
                  {m.specialization || "—"}
                </td>
                <td className="p-2 border-b border-ink-100">
                  <RoleTag role={m.role} />
                </td>
                <td className="p-2 border-b border-ink-100">
                  <StatusPill status={m.status} />
                </td>
                <td className="p-2 border-b border-ink-100">
                  <MemberActions profileId={m.id} status={m.status} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-ink-500">
                  עדיין אין חברות רשומות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
