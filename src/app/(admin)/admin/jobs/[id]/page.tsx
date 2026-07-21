import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Inbox, Mail, UserCheck, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientJob } from "@/lib/portal/jobs";
import { Alert, Badge, Button } from "@/components/ui";
import { addJobCandidate, removeJobCandidate } from "@/app/(admin)/admin/actions";
import { CandidatePicker } from "./candidate-picker";
import { SendCandidatesButton } from "./send-candidates-button";

export const metadata: Metadata = { title: "ניהול מועמדות למשרה" };

const cardClass = "bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm";

export default async function AdminJobCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // This page reads employer-portal data via the service role, so gate it
  // explicitly beyond the (admin) layout.
  await requireRole("admin");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company, client_id, source")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: applications }, { data: curated }, { data: members }] = await Promise.all([
    admin
      .from("applications")
      .select("id, applicant_id, submitted_at")
      .eq("job_id", id)
      .order("submitted_at", { ascending: false }),
    admin
      .from("job_candidates")
      .select("profile_id, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, full_name, specialization")
      .eq("status", "active")
      .eq("role", "junior")
      .eq("profile_completed", true)
      .order("full_name", { ascending: true }),
  ]);

  const client = job.client_id
    ? (
        await admin
          .from("portal_clients")
          .select("id, company_name")
          .eq("id", job.client_id)
          .maybeSingle()
      ).data
    : null;

  // The exact set the client actually sees in the portal (privacy-gated). A
  // curated candidate outside it — opted out, paused, no longer a listed junior
  // — is silently hidden from the client, so flag it for the admin instead of
  // letting the counts quietly disagree.
  const visibleToClient = job.client_id
    ? new Set((await loadClientJob(job.client_id, id))?.candidates.map((c) => c.id) ?? [])
    : null;

  // Names for applicants + curated candidates — they may not all be in the
  // active-junior list above (e.g. paused members).
  const applicantIds = [...new Set((applications ?? []).map((a) => a.applicant_id))];
  const curatedIds = [...new Set((curated ?? []).map((c) => c.profile_id))];
  const needIds = [...new Set([...applicantIds, ...curatedIds])];
  const { data: named } = needIds.length
    ? await admin.from("profiles").select("id, full_name, specialization").in("id", needIds)
    : { data: [] as { id: string; full_name: string; specialization: string | null }[] };
  const profileOf = new Map((named ?? []).map((p) => [p.id, p]));
  const curatedSet = new Set(curatedIds);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline self-start"
      >
        <ArrowRight size={15} /> חזרה לניהול משרות
      </Link>

      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדות/&gt;</span>
            <h1 className="font-display text-[24px] font-black text-ink-1000 mt-1">{job.title}</h1>
            <p className="text-[13px] text-ink-500 mt-1">{job.company}</p>
          </div>
          <Badge variant={job.source === "ours" ? "pink" : "tech"}>
            {job.source === "ours" ? "משרה שלנו" : "משרה מהשוק"}
          </Badge>
        </div>
        <div className="mt-3">
          {client ? (
            <p className="text-[13px] text-ink-700">
              מקושרת ללקוח:{" "}
              <span className="font-semibold text-ink-900">{client.company_name}</span>
            </p>
          ) : (
            <Alert variant="warn">
              לא מקושרת ללקוח — חברי אותה ללקוח בעריכת המשרה.
            </Alert>
          )}
        </div>
      </div>

      {/* Send to client */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <Mail size={16} className="text-brand-purple" /> שליחה ללקוח
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          המייל שולח ללקוח קישור לצפייה במועמדות שנבחרו, ישירות בעמוד המשרה בפורטל.
        </p>
        <SendCandidatesButton jobId={job.id} />
      </div>

      {/* Applicants */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <Inbox size={16} className="text-brand-pink-deep" /> מועמדות שהגישו ({applications?.length ?? 0})
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          מועמדות שהגישו למשרה הזו — הוסיפי אותן למועמדות שיוצגו ללקוח.
        </p>
        {applications && applications.length > 0 ? (
          <div className="flex flex-col">
            {applications.map((a) => {
              const p = profileOf.get(a.applicant_id);
              const isCurated = curatedSet.has(a.applicant_id);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap"
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-ink-900">{p?.full_name ?? "מועמדת"}</div>
                    <div className="text-xs text-ink-500">{p?.specialization ?? "—"}</div>
                  </div>
                  {isCurated ? (
                    <Badge variant="mint">נבחרה למשרה ✓</Badge>
                  ) : (
                    <form action={addJobCandidate.bind(null, job.id, a.applicant_id)}>
                      <Button type="submit" size="sm">
                        הוספה למשרה בפורטל
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">אין הגשות למשרה הזו עדיין.</p>
        )}
      </div>

      {/* Curated */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <UserCheck size={16} className="text-brand-purple" /> המועמדות שנבחרו למשרה ({curated?.length ?? 0})
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          אלו המועמדות שהלקוח יראה בפורטל עבור המשרה הזו.
        </p>
        {curated && curated.length > 0 ? (
          <div className="flex flex-col">
            {curated.map((c) => {
              const p = profileOf.get(c.profile_id);
              const hidden = visibleToClient !== null && !visibleToClient.has(c.profile_id);
              return (
                <div
                  key={c.profile_id}
                  className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap"
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-ink-900">{p?.full_name ?? "מועמדת"}</div>
                    <div className="text-xs text-ink-500">{p?.specialization ?? "—"}</div>
                  </div>
                  {hidden && (
                    <Badge variant="warm" title="לא עומדת בתנאי התצוגה בפורטל (למשל ביקשה לא להופיע, או אינה פעילה) — הלקוח לא יראה אותה ולא תישלח במייל.">
                      לא מוצגת ללקוח
                    </Badge>
                  )}
                  <form action={removeJobCandidate.bind(null, job.id, c.profile_id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      הסרה
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">עדיין לא נבחרו מועמדות למשרה הזו.</p>
        )}
      </div>

      {/* Add anyone */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <UserPlus size={16} className="text-brand-pink-deep" /> הוספת מועמדת נוספת
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          חיפוש בכל חברות הקהילה הפעילות והוספה ישירה למשרה.
        </p>
        <CandidatePicker jobId={job.id} members={members ?? []} addedIds={curatedIds} />
      </div>
    </div>
  );
}
