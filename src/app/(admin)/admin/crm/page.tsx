import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CrmManager, type CrmClientRow, type CrmJobRow } from "./crm-manager";

export const metadata: Metadata = { title: "CRM לקוחות" };

export default async function AdminCrmPage() {
  await requireRole("admin");

  const admin = createAdminClient();
  const [{ data: clients }, { data: jobs }] = await Promise.all([
    // select("*") so the screen keeps rendering whether or not the CRM
    // migration has run (missing columns fall back below).
    admin.from("portal_clients").select("*").order("created_at", { ascending: false }),
    admin
      .from("jobs")
      .select("id, title, client_id, pipeline_status, created_at")
      .not("client_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  // Group each client's jobs for the expanded row (title + pipeline pill).
  const jobsOf = new Map<string, CrmJobRow[]>();
  for (const j of jobs ?? []) {
    if (!j.client_id) continue;
    const list = jobsOf.get(j.client_id) ?? [];
    list.push({ id: j.id, title: j.title, pipeline_status: j.pipeline_status ?? "draft" });
    jobsOf.set(j.client_id, list);
  }

  const rows: CrmClientRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    company_name: c.company_name,
    username: c.username,
    contact_name: c.contact_name ?? null,
    contact_phone: c.contact_phone ?? null,
    contact_email: c.contact_email ?? null,
    // Pre-migration rows: clients with credentials are already "משרה בטיפול".
    crm_status: c.crm_status ?? (c.username ? "job_active" : "initial_call"),
    crm_notes: c.crm_notes ?? null,
    created_at: c.created_at,
    jobs: jobsOf.get(c.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;CRM/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">לקוחות</h1>
        <p className="text-[13px] text-ink-500 mt-1.5">
          כל הלקוחות והלידים במקום אחד — משיחה ראשונית ועד גיוס. לחצי על שורה
          לעריכת פרטים, סטטוס והערות, ולצפייה במשרות של הלקוחה.
        </p>
      </div>

      <CrmManager clients={rows} />
    </div>
  );
}
