import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmissionsTable, type SubmissionRow } from "./submissions-table";

export const metadata: Metadata = { title: "רשימת הגשות" };
export const dynamic = "force-dynamic";

/**
 * Every member the team FINALLY submitted (admin mark "אישור סופי", or actually
 * sent to a client) — one table across all jobs, with the details the office
 * needs at hand: studies, contact, which client, when. Exportable to Excel.
 */
export default async function AdminSubmissionsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: apps } = await admin
    .from("applications")
    .select("id, applicant_id, job_id, status, admin_mark, submitted_at, sent_to_client_at")
    .or("admin_mark.eq.approved,sent_to_client_at.not.is.null")
    .order("submitted_at", { ascending: false })
    .limit(1000);

  const rows = apps ?? [];
  const jobIds = [...new Set(rows.map((a) => a.job_id))];
  const profileIds = [...new Set(rows.map((a) => a.applicant_id))];

  const [{ data: jobs }, { data: profiles }, { data: questions }, { data: crm }] =
    await Promise.all([
      jobIds.length
        ? admin.from("jobs").select("id, title, company, client_id").in("id", jobIds)
        : Promise.resolve({ data: [] }),
      profileIds.length
        ? admin.from("profiles").select("id, full_name, specialization").in("id", profileIds)
        : Promise.resolve({ data: [] }),
      admin
        .from("config_questions")
        .select("id, key")
        .in("key", ["study_place", "graduation_year", "phone"]),
      profileIds.length
        ? admin.from("member_crm").select("profile_id, internal_notes").in("profile_id", profileIds)
        : Promise.resolve({ data: [] }),
    ]);

  const clientIds = [...new Set((jobs ?? []).map((j) => j.client_id).filter(Boolean))] as string[];
  const { data: clients } = clientIds.length
    ? await admin.from("portal_clients").select("id, company_name").in("id", clientIds)
    : { data: [] };
  const clientNameOf = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const jobOf = new Map((jobs ?? []).map((j) => [j.id, j]));
  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  const crmNoteOf = new Map((crm ?? []).map((c) => [c.profile_id, c.internal_notes]));

  // study place / graduation year / phone live in profile_answers.
  const qIdOf = new Map((questions ?? []).map((q) => [q.key, q.id]));
  const answerIds = [...qIdOf.values()];
  const { data: answers } =
    profileIds.length && answerIds.length
      ? await admin
          .from("profile_answers")
          .select("profile_id, question_id, value")
          .in("profile_id", profileIds)
          .in("question_id", answerIds)
      : { data: [] };
  const answerMap = new Map(
    (answers ?? []).map((a) => [`${a.profile_id}:${a.question_id}`, a.value])
  );
  const answerOf = (pid: string, key: string): string => {
    const qid = qIdOf.get(key);
    const v = qid ? answerMap.get(`${pid}:${qid}`) : undefined;
    if (v == null) return "";
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  // Emails in ONE set-based call — the getUserById loop was seconds of
  // sequential auth API calls at a few hundred submissions.
  const { data: emailRows } = profileIds.length
    ? await admin.rpc("member_emails", { p_ids: profileIds })
    : { data: [] };
  const emailOf = new Map(
    ((emailRows ?? []) as { id: string; email: string | null }[])
      .filter((r): r is { id: string; email: string } => !!r.email)
      .map((r) => [r.id, r.email])
  );

  const items: SubmissionRow[] = rows.map((a) => {
    const p = profileOf.get(a.applicant_id);
    const j = jobOf.get(a.job_id);
    return {
      id: a.id,
      profileId: a.applicant_id,
      jobId: a.job_id,
      name: p?.full_name ?? "חברת קהילה",
      specialization: p?.specialization ?? "",
      studyPlace: answerOf(a.applicant_id, "study_place"),
      graduationYear: answerOf(a.applicant_id, "graduation_year"),
      phone: answerOf(a.applicant_id, "phone"),
      email: emailOf.get(a.applicant_id) ?? "",
      jobTitle: j?.title ?? "—",
      clientCompany: (j?.client_id ? clientNameOf.get(j.client_id) : null) ?? j?.company ?? "—",
      submittedAt: a.submitted_at,
      sentAt: a.sent_to_client_at,
      status: a.status,
      crmNote: crmNoteOf.get(a.applicant_id) ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הגשות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2">
          <ClipboardList size={24} className="text-brand-purple" /> רשימת הגשות
        </h1>
        <p className="t-body-sm text-ink-500">
          כל מי שאושרה סופית או הוגשה ללקוח, מכל המשרות — עם פרטי הקשר, הלימודים והחברה.
          מתעדכן אוטומטית ברגע שמסמנים &quot;אישור סופי&quot; במשרה.
        </p>
      </div>

      <SubmissionsTable rows={items} />
    </div>
  );
}
