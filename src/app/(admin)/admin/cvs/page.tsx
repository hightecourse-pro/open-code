import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { AdminCvTable, type AdminCvRow } from "@/components/patterns/admin-cv-table";

export const metadata: Metadata = { title: "קורות חיים" };

/**
 * Staff browser for every CV in the community: search by member, filter by
 * language, download in one click (signed URLs, valid for an hour). Files
 * stay in the private `cvs` bucket — this page is the convenient window.
 */
export default async function AdminCvsPage() {
  await requireRole("admin");

  // cv_documents is owner-only under RLS — staff browse via the service role.
  const admin = createAdminClient();
  const { data: docs } = await admin
    .from("cv_documents")
    .select("id, profile_id, label, language, file_path, file_name, created_at")
    .order("created_at", { ascending: false });

  const supabase = await createClient();
  const memberIds = [...new Set((docs ?? []).map((d) => d.profile_id))];
  const { data: members } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, specialization")
        .in("id", memberIds)
    : { data: [] };
  const memberOf = new Map((members ?? []).map((m) => [m.id, m]));

  // One batched call for all download links.
  const paths = (docs ?? []).map((d) => d.file_path);
  const { data: signed } = paths.length
    ? await admin.storage.from("cvs").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const rows: AdminCvRow[] = (docs ?? []).map((d) => ({
    id: d.id,
    profile_id: d.profile_id,
    member_name: memberOf.get(d.profile_id)?.full_name ?? "חברת קהילה",
    specialization: memberOf.get(d.profile_id)?.specialization ?? null,
    label: d.label,
    language: d.language,
    file_name: d.file_name,
    created_at: d.created_at,
    download_url: urlOf.get(d.file_path) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קו&quot;ח/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">קורות חיים</h1>
        <p className="t-body-sm text-ink-500">
          כל הקבצים שהחברות העלו — חיפוש, סינון לפי שפה והורדה בקליק. הקישורים תקפים לשעה.
        </p>
      </div>

      <AdminCvTable rows={rows} />
    </div>
  );
}
