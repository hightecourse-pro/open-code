import type { Metadata } from "next";
import { Badge, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { AdminCreateJob } from "@/components/patterns/admin-create-job";
import { AdminJobRow, type AdminJob } from "@/components/patterns/admin-job-row";
import { setApplicationStatus } from "../actions";
import type { ApplicationStatus } from "@/types/database";

export const metadata: Metadata = { title: "ניהול משרות" };

const APP_STATUS: Record<ApplicationStatus, { label: string; variant: "warm" | "tech" | "mint" | "pink" | "indigo" }> = {
  draft: { label: "טיוטה", variant: "tech" },
  submitted: { label: "הוגשה", variant: "warm" },
  in_review: { label: "בבדיקה", variant: "indigo" },
  accepted: { label: "התקבלה", variant: "mint" },
  rejected: { label: "נדחתה", variant: "pink" },
};

export default async function AdminJobsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, company, title, source, employment_type, location, tech_tags, external_url, description, status, created_at")
    .order("created_at", { ascending: false });

  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

  // Applications to our internal ("ours") jobs.
  const { data: applications } = await supabase
    .from("applications")
    .select("id, job_id, applicant_id, status, submitted_at")
    .order("submitted_at", { ascending: false });

  const applicantIds = [...new Set((applications ?? []).map((a) => a.applicant_id))];
  const { data: applicants } = applicantIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", applicantIds)
    : { data: [] };
  const nameOf = new Map((applicants ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול משרות</h1>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">הוספת משרה</h3>
        <AdminCreateJob />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">כל המשרות ({jobs?.length ?? 0})</h3>
        <div className="flex flex-col">
          {(jobs ?? []).map((j) => (
            <AdminJobRow key={j.id} job={j as AdminJob} />
          ))}
          {(jobs ?? []).length === 0 && <p className="text-ink-500 text-sm py-4">אין משרות עדיין.</p>}
        </div>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">הגשות מועמדות</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">מועמדות שהגישו למשרות פנימיות — נהלי את התהליך כאן.</p>
        {applications && applications.length > 0 ? (
          <div className="flex flex-col">
            {applications.map((a) => {
              const st = APP_STATUS[a.status];
              return (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-ink-900">{nameOf.get(a.applicant_id) ?? "מועמדת"}</div>
                    <div className="text-xs text-ink-500">
                      {jobMap.get(a.job_id)?.title ?? "משרה"} · {jobMap.get(a.job_id)?.company ?? ""}
                    </div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <div className="flex gap-1.5">
                    <form action={setApplicationStatus.bind(null, a.id, "in_review")}>
                      <Button type="submit" size="sm" variant="ghost">בבדיקה</Button>
                    </form>
                    <form action={setApplicationStatus.bind(null, a.id, "accepted")}>
                      <Button type="submit" size="sm">התקבלה</Button>
                    </form>
                    <form action={setApplicationStatus.bind(null, a.id, "rejected")}>
                      <Button type="submit" size="sm" variant="ghost">דחייה</Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">עדיין אין הגשות.</p>
        )}
      </div>
    </div>
  );
}
