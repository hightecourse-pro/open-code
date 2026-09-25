import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSE_KEY, COURSE_TITLE, coursePaymentUrl, courseNotifyEmail } from "@/lib/course-registration";
import { RegistrationsTable, type RegistrationRow } from "./registrations-table";

export const metadata: Metadata = { title: "נרשמות לקורס" };
export const dynamic = "force-dynamic";

/**
 * נרשמות לקורס (the owner, 25/9): every woman who went through
 * /masters-course/register - subscriber or not, where she stands with the
 * payment (confirmed by hand, the clearing is Shufra's), and a note.
 */
export default async function CourseRegistrationsPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_registrations")
    .select("id, email, full_name, phone, profile_id, is_subscriber, membership_note, status, paid_at, notes, created_at")
    .eq("course_key", COURSE_KEY)
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as RegistrationRow[];

  // Live membership beside the snapshot: a woman who joined AFTER registering
  // should read as a subscriber now (the scholarship follows the membership).
  const ids = rows.map((r) => r.profile_id).filter((x): x is string => !!x);
  const liveSub = new Map<string, boolean>();
  if (ids.length) {
    const { inChunks } = await import("@/lib/chunk");
    const profs = await inChunks<{ id: string; status: string; member_tier: string }>(ids, (chunk) =>
      admin.from("profiles").select("id, status, member_tier").in("id", chunk)
    );
    for (const p of profs) liveSub.set(p.id, p.status === "active" && p.member_tier === "paid");
  }
  const withLive = rows.map((r) => ({ ...r, subscriber_now: r.profile_id ? (liveSub.get(r.profile_id) ?? false) : false }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">נרשמות לקורס {COURSE_TITLE}</h1>
        <p className="text-[13.5px] text-ink-600 mt-1 leading-relaxed">
          כל מי שנרשמה בדף הציבורי (/masters-course/register). התשלום נסלק אצל שופרא בנדרים - אחרי אישור מהן סמני ״שולם״ כאן.
          על כל הרשמה חדשה יוצאים התראה בניהול ומייל ל-{courseNotifyEmail()}.
        </p>
        <p className="text-[12px] text-ink-500 mt-1" dir="ltr">
          דף התשלום: {coursePaymentUrl()}
        </p>
      </div>
      <RegistrationsTable rows={withLive} />
    </div>
  );
}
