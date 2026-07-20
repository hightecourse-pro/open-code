import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsManager, type PortalClientRow } from "./clients-manager";

export const metadata: Metadata = { title: "לקוחות פורטל" };

export default async function AdminClientsPage() {
  await requireRole("admin");

  const admin = createAdminClient();
  const [{ data: clients }, { data: jobs }] = await Promise.all([
    admin
      .from("portal_clients")
      .select("id, company_name, username, contact_name, contact_email, is_active, created_at, last_login_at")
      .order("created_at", { ascending: false }),
    // Only the FK column — enough to count each client's jobs without
    // pulling job content into an unrelated screen.
    admin.from("jobs").select("client_id"),
  ]);

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (j.client_id) jobCounts.set(j.client_id, (jobCounts.get(j.client_id) ?? 0) + 1);
  }

  const rows: PortalClientRow[] = (clients ?? []).map((c) => ({
    ...c,
    job_count: jobCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;לקוחות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">לקוחות פורטל</h1>
        <p className="text-[13px] text-ink-500 mt-1.5">
          חברות שקיבלו גישה לפורטל המעסיקים. הן מתחברות בכתובת{" "}
          <span className="font-mono text-ink-700" dir="ltr">
            /portal/login
          </span>{" "}
          עם שם המשתמש והסיסמה שתפיקי כאן.
        </p>
      </div>

      <ClientsManager clients={rows} />
    </div>
  );
}
