import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MembersTable, type MemberRow } from "@/components/patterns/members-table";

export const metadata: Metadata = { title: "ניהול חברות" };

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, role, status, specialization, region, is_vip, internal_notes, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;חברות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול חברות</h1>
        <p className="t-body-sm text-ink-500">
          חיפוש וסינון מיידיים, אישור וניהול סטטוס/תפקיד, סימון VIP והערות פנימיות.
        </p>
      </div>

      <MembersTable members={(members ?? []) as MemberRow[]} />
    </div>
  );
}
