import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { AdminJobsManager } from "@/components/patterns/admin-jobs-manager";
import {
  type AdminJob,
  type JobAppCounts,
  type PortalClientOption,
} from "@/components/patterns/admin-job-row";

export const metadata: Metadata = { title: "ניהול משרות" };

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; created?: string }>;
}) {
  await requireRole("admin");
  // Arriving from the CRM's "משרה חדשה ללקוח" — preselect that client.
  const { client: initialClientId, created } = await searchParams;
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, company, title, source, employment_type, location, tech_tags, external_url, description, description_html, status, client_id, job_kind, practicum_percent, pipeline_status, created_at"
    )
    .order("created_at", { ascending: false });

  // Portal clients a job can be linked to (admin-only table → service role).
  const { data: clientRows } = await createAdminClient()
    .from("portal_clients")
    .select("id, company_name")
    .eq("is_active", true)
    .order("company_name", { ascending: true });
  const clients: PortalClientOption[] = (clientRows ?? []).map((c) => ({
    id: c.id,
    company_name: c.company_name,
  }));

  // Applications are managed inside each job's מועמדות tab — here we only
  // surface per-job counts (total + fresh submissions) on the rows.
  const { data: applications } = await supabase.from("applications").select("job_id, status");
  const appCounts: Record<string, JobAppCounts> = {};
  for (const a of applications ?? []) {
    const counts = (appCounts[a.job_id] ??= { total: 0, newCount: 0 });
    counts.total += 1;
    if (a.status === "submitted") counts.newCount += 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול משרות</h1>
        <p className="text-sm text-ink-500 mt-1">
          כל משרה נפתחת לדף ניהול מלא — פרסום, שאלות, מועמדות ולקוח.
        </p>
      </div>

      <AdminJobsManager
        jobs={(jobs ?? []) as AdminJob[]}
        clients={clients}
        appCounts={appCounts}
        initialClientId={initialClientId}
        created={created === "1"}
      />
    </div>
  );
}
