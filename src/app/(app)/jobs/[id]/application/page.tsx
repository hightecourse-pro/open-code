import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { netfreeSafeUrl } from "@/lib/netfree";
import { FIT_QUESTION } from "@/lib/member-overview";

export const metadata: Metadata = { title: "פרטי המשרה ומה הגשתי" };

const DATE_HE = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

function answerText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(" · ");
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * ״מה הגשתי״ (the owner, 6.11, after טובי גולדשטיין's request: ״שגם אחרי שהגשתי למשרה
 * מסוימת והיא כבר לא זמינה יהיה אפשר לראות מה הגשתי במשרה הזאת כדי לדייק את עצמי לפעם
 * הבאה״): her own application, read-only, also when the job has closed or is no longer
 * visible - the role, when she applied, her answers in the questions' words, the CV she
 * attached, her note. Nothing of the team's (marks, notes) is shown here.
 *
 * Since 10.11 the page also carries the job's requirements (חדוה אברמוביץ: ״אחרי שכבר הגשתי
 * למשרה כלשהי אני לא יכולה לראות את הדרישות או את הפרטים של המשרה… אם רוצים להתכונן״): an applied
 * job leaves the board, so without this the only way to its description was the edit link, and
 * none once the application was forwarded or the job closed.
 */
export default async function MyApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireCommunityAccess();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Hers, by RLS. The job and its questions come from the admin client on purpose: a closed
  // or hidden job is exactly the case she asked about.
  const { data: app } = await supabase
    .from("applications")
    .select("id, job_id, status, note, submitted_at, created_at, answers, cv_document_id, edited_at, sent_to_client_at")
    .eq("job_id", id)
    .eq("applicant_id", profile.id)
    .maybeSingle();
  if (!app || app.status === "draft") notFound();

  const [{ data: job }, { data: questions }, { data: cv }] = await Promise.all([
    admin.from("jobs").select("id, title, company, status, pipeline_status, location, employment_type, description, description_html").eq("id", app.job_id).maybeSingle(),
    admin.from("job_questions").select("id, question, sort_order").eq("job_id", app.job_id).order("sort_order", { ascending: true }),
    app.cv_document_id ? supabase.from("cv_documents").select("id, label, file_name, file_path").eq("id", app.cv_document_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const closedLabel = !job || job.status === "open" ? null : job.pipeline_status === "hired" ? "המשרה אוישה" : "המשרה נסגרה";
  const editable = app.status === "submitted" && !app.sent_to_client_at && job?.status === "open" && !["candidates_sent", "interviews"].includes(job?.pipeline_status ?? "");

  const raw = (app.answers && typeof app.answers === "object" && !Array.isArray(app.answers) ? (app.answers as Record<string, unknown>) : {}) as Record<string, unknown>;
  const answers: { label: string; answer: string }[] = [];
  if (answerText(raw.fit)) answers.push({ label: FIT_QUESTION, answer: answerText(raw.fit) });
  const known = new Set(["fit"]);
  for (const q of questions ?? []) {
    known.add(q.id);
    if (answerText(raw[q.id])) answers.push({ label: q.question, answer: answerText(raw[q.id]) });
  }
  for (const [k, v] of Object.entries(raw)) if (!known.has(k) && answerText(v)) answers.push({ label: k, answer: answerText(v) });

  let cvUrl: string | null = null;
  if (cv?.file_path) {
    const { data } = await supabase.storage.from("cvs").createSignedUrl(cv.file_path, 3600);
    if (data?.signedUrl) cvUrl = netfreeSafeUrl(data.signedUrl);
  }
  const appliedAt = app.submitted_at ?? app.created_at;
  // The requirements exactly as the admin styled them (sanitized at save time by lib/rich-text).
  const requirementsHtml = job?.description_html?.trim() ? job.description_html : null;
  const requirementsText = !requirementsHtml && job?.description?.trim() ? job.description : null;

  return (
    <div className="flex flex-col gap-5 max-w-[640px]" data-testid="my-application">
      <Link href="/jobs?view=mine" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline self-start">
        <ArrowRight size={15} /> חזרה להגשות שלי
      </Link>

      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פרטי המשרה ומה הגשתי/&gt;</span>
        <h1 className="font-display text-[26px] font-black text-ink-1000 mt-1">{job?.title ?? "משרה"}</h1>
        <p className="text-[13.5px] text-ink-600 mt-1 flex items-center gap-2 flex-wrap">
          {appliedAt && <span>הוגשה {DATE_HE.format(new Date(appliedAt))}</span>}
          {app.edited_at && <span className="text-ink-400">· עודכנה {DATE_HE.format(new Date(app.edited_at))}</span>}
          {closedLabel && (
            <span className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-ink-100 text-ink-500" data-testid="my-application-closed">
              {closedLabel}
            </span>
          )}
        </p>
        <p className="text-[13px] text-ink-500 mt-2">דרישות המשרה ומה שכתבת בהגשה, מילה במילה - גם כשהמשרה כבר לא פתוחה. שימושי כדי להתכונן לראיון ולדייק את ההגשה הבאה.</p>
      </div>

      {(requirementsHtml || requirementsText) && (
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm" data-testid="my-application-job">
          <h2 className="font-display text-lg font-bold text-ink-1000 mb-3">דרישות המשרה</h2>
          {requirementsHtml ? (
            <div
              dir="rtl"
              className={[
                "font-body text-[15px] leading-relaxed text-ink-900",
                "[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-1.5",
                "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-brand-purple",
                "[&_a]:text-brand-purple [&_a]:underline",
                "[&_p]:my-1.5 [&_b]:text-ink-1000 [&_strong]:text-ink-1000",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: requirementsHtml }}
            />
          ) : (
            <p className="t-body whitespace-pre-line text-ink-900">{requirementsText}</p>
          )}
        </section>
      )}

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4" data-testid="my-application-answers">
        {answers.length === 0 && <p className="text-[13.5px] text-ink-500">להגשה הזו לא היו שאלות.</p>}
        {answers.map((qa, i) => (
          <div key={i} data-testid="my-application-answer">
            <div className="text-[12.5px] font-bold text-brand-purple">{qa.label}</div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-900 whitespace-pre-line break-words">{qa.answer}</p>
          </div>
        ))}
        {app.note && (
          <div data-testid="my-application-note">
            <div className="text-[12.5px] font-bold text-brand-purple">הערה שצירפת</div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-900 whitespace-pre-line break-words">{app.note}</p>
          </div>
        )}
        <div className="pt-3 border-t border-ink-100 text-[13.5px] flex items-center gap-2 flex-wrap" data-testid="my-application-cv">
          <FileText size={15} className="text-brand-pink-deep" />
          {cv ? (
            <>
              <span>
                קורות החיים שצירפת: <b>{cv.label}</b>
                {cv.file_name ? <span className="text-ink-500"> ({cv.file_name})</span> : null}
              </span>
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noopener" className="font-semibold text-brand-purple hover:underline">
                  לפתוח ↗
                </a>
              )}
            </>
          ) : (
            <span className="text-ink-500">{app.cv_document_id ? "קורות החיים שצירפת נמחקו מהרשימה שלך." : "ההגשה נשלחה בלי קובץ קורות חיים."}</span>
          )}
        </div>
      </section>

      {editable && (
        <p className="text-[13px] text-ink-600">
          ההגשה עוד פתוחה לעריכה:{" "}
          <Link href={`/jobs/${app.job_id}/apply`} className="font-semibold text-brand-purple hover:underline">
            לערוך או להסיר ✏️
          </Link>
        </p>
      )}
    </div>
  );
}
