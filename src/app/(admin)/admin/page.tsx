import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PendingMentorApplications } from "./mentors/pending-applications";

export const metadata: Metadata = { title: "דשבורד אדמין" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Only a MENTOR candidate goes through approval (the owner, 2026-08-30):
  // a woman who joined without paying is simply a free member — she browses
  // immediately, nothing to approve. Payment (not an admin) activates a
  // subscriber; the approval queue below is mentors only.
  const [subscribers, regulars, unregisteredPayers, pendingMentors, mentors, posts] =
    await Promise.all([
      // The directory view computes "really paying" (active paid / live sub /
      // on the Nedarim payers list) — pending payers count as מנויות too.
      supabase
        .from("members_directory")
        .select("*", { count: "exact", head: true })
        .eq("is_subscriber", true),
      // Regular members: in the community (active or pending), not paying,
      // not mentors/team (the view masks unapproved mentors as juniors).
      supabase
        .from("members_directory")
        .select("*", { count: "exact", head: true })
        .eq("is_subscriber", false)
        .eq("role", "junior"),
      // Paid outside and never signed up — the definer function matches the
      // payers list against auth accounts (null pre-migration → cube shows 0).
      supabase.rpc("admin_unregistered_payers_count"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("role", "mentor"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "mentor")
        .eq("status", "active"),
      supabase.from("posts").select("*", { count: "exact", head: true }),
    ]);

  // Each cube IS its filter (the tester's ask) — clicking lands on the list
  // it counts, already narrowed.
  const stats = [
    { label: "מנויות 💜", value: subscribers.count ?? 0, href: "/admin/members?status=active" },
    { label: "משתתפות רגילות", value: regulars.count ?? 0, href: "/admin/members" },
    { label: "שילמו וטרם נרשמו", value: (unregisteredPayers.data as number | null) ?? 0, href: "/admin/payments" },
    { label: "מנטוריות לאישור", value: pendingMentors.count ?? 0, href: "/admin/mentors" },
    { label: "מנטוריות", value: mentors.count ?? 0, href: "/admin/mentors" },
    { label: "פוסטים בקהילה", value: posts.count ?? 0, href: "/forum" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;admin/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">דשבורד</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white border border-ink-200 rounded-2xl p-4 px-[18px] hover:border-brand-purple hover:shadow-sm transition-all"
          >
            <div className="text-xs text-ink-500 tracking-[0.04em] uppercase font-semibold">
              {s.label}
            </div>
            <div className="font-display font-black text-[28px] text-ink-1000 mt-1">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* The SAME rich approval card as /admin/mentors (the owner, 10/9:
          "תסדר לי בדשבורד את אישור המנטוריות") — one component, so approving
          here also sends her the אושרת email. */}
      <PendingMentorApplications
        heading="מנטוריות חדשות לאישור"
        sub="רק הצטרפות כמנטורית עוברת אישור צוות — חברה שנרשמה בלי מנוי נכנסת מיד, בלי אישור."
        showEmpty
        footer={
          <Link
            href="/admin/mentors"
            className="inline-block mt-3 text-sm text-brand-purple font-semibold"
          >
            לניהול מנטוריות ←
          </Link>
        }
      />
    </div>
  );
}
