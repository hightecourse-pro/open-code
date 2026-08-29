import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { AdminCvTable, type AdminCvRow } from "@/components/patterns/admin-cv-table";

export const metadata: Metadata = { title: "קורות חיים" };

/**
 * Staff browser for every CV in the community: search by member, separate
 * language/type filters, preview + download (signed URLs, valid for an hour),
 * bulk download, and job-tailored files linking to their job.
 */
export default async function AdminCvsPage() {
  await requireRole("admin");

  // cv_documents is owner-only under RLS — staff browse via the service role.
  const admin = createAdminClient();
  // Bounded: the newest 1200 documents (well past today's community). Links
  // are signed ON CLICK by /admin/cv-files/sign — not en masse per page view.
  const { data: docs } = await admin
    .from("cv_documents")
    .select("id, profile_id, label, language, file_path, file_name, created_at, is_default")
    .order("created_at", { ascending: false })
    .limit(1200);

  const supabase = await createClient();
  const memberIds = [...new Set((docs ?? []).map((d) => d.profile_id))];
  const { data: members } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, specialization")
        .in("id", memberIds)
    : { data: [] };
  const memberOf = new Map((members ?? []).map((m) => [m.id, m]));

  // A job-tailored file was born inside an application — resolve which job,
  // so the row can link to it (Shira: "קובץ מותאם למשרה לא מקשר למשרה").
  const docIds = (docs ?? []).map((d) => d.id);
  const { data: appRows } = docIds.length
    ? await admin
        .from("applications")
        .select("cv_document_id, job_id")
        .in("cv_document_id", docIds)
    : { data: [] };
  const jobIds = [...new Set((appRows ?? []).map((a) => a.job_id))];
  const { data: jobRows } = jobIds.length
    ? await admin.from("jobs").select("id, title").in("id", jobIds)
    : { data: [] };
  const jobTitleOf = new Map((jobRows ?? []).map((j) => [j.id, j.title]));
  const jobOfDoc = new Map(
    (appRows ?? []).flatMap((a) => (a.cv_document_id ? [[a.cv_document_id, a.job_id] as const] : []))
  );

  const rows: AdminCvRow[] = (docs ?? []).map((d) => {
    const jobId = jobOfDoc.get(d.id) ?? null;
    return {
      id: d.id,
      profile_id: d.profile_id,
      member_name: memberOf.get(d.profile_id)?.full_name ?? "חברת קהילה",
      specialization: memberOf.get(d.profile_id)?.specialization ?? null,
      label: d.label,
      language: d.language,
      file_name: d.file_name,
      created_at: d.created_at,
      is_default: d.is_default,
      job_id: jobId,
      job_title: jobId ? (jobTitleOf.get(jobId) ?? null) : null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קו&quot;ח/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">קורות חיים</h1>
        <p className="t-body-sm text-ink-500">
          כל הקבצים שהחברות העלו, מקובצים לפי חברה — חיפוש, סינון, תצוגה מקדימה, הורדה בודדת
          או מרוכזת. הקישורים תקפים לשעה.
        </p>
      </div>

      <AdminCvTable rows={rows} />
    </div>
  );
}
