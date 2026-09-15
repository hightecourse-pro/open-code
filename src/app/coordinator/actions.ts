"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { coordinatorOtpEmail } from "@/lib/email/templates";
import {
  createOtp,
  endCoordinatorSession,
  getCoordinator,
  startCoordinatorSession,
  verifyOtp,
} from "@/lib/coordinators";

export type OtpState = { error?: string; sent?: boolean; email?: string };

/** Step 1: request a code. The answer never reveals whether the email exists. */
export async function requestCoordinatorOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "כתבי כתובת מייל תקינה." };
  const code = await createOtp(email);
  if (code) {
    const mail = coordinatorOtpEmail(code);
    const sent = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    if (!sent.ok) console.error("[coordinator] otp email failed:", sent.error);
  }
  // Same answer either way — the form must not confirm which emails exist.
  return { sent: true, email };
}

/** Step 2: verify the code and open the session. */
export async function verifyCoordinatorOtp(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) return { error: "חסר קוד.", sent: true, email };
  const contactId = await verifyOtp(email, code);
  if (!contactId) {
    return { error: "הקוד לא נכון או שפג תוקפו — אפשר לבקש קוד חדש.", sent: true, email };
  }
  await startCoordinatorSession(contactId);
  redirect("/coordinator");
}

export async function coordinatorLogout(): Promise<void> {
  await endCoordinatorSession();
  redirect("/coordinator/login");
}

/** Leave the admin's "view as coordinator" mode — back to the admin screen. */
export async function exitAdminView(): Promise<void> {
  await endCoordinatorSession();
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set("oc_coord_admin", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/coordinator",
    maxAge: 0,
  });
  redirect("/admin/coordinators");
}

export type ReviewState = { error?: string; ok?: boolean };

/**
 * Save the coordinator's assessment of ONE of her graduates — hers alone:
 * scoped by the session's contact id, upserted on (contact, profile).
 */
export async function saveCoordinatorReview(
  profileId: string,
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  // She may only review HER graduates — verify the profile's study place.
  const { loadGraduates } = await import("@/lib/coordinator-data");
  const grads = await loadGraduates(me.institutions);
  if (!grads.some((g) => g.id === profileId)) return { error: "הבוגרת לא נמצאה ברשימה שלך." };

  const num = (k: string): number | null => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const foundRaw = String(formData.get("found_job") ?? "");
  const found_job = foundRaw === "yes" ? true : foundRaw === "no" ? false : null;

  const admin = createAdminClient();
  const { error } = await admin.from("coordinator_reviews").upsert(
    {
      contact_id: me.id,
      profile_id: profileId,
      communication: num("communication"),
      talent: num("talent"),
      note: String(formData.get("note") ?? "").trim().slice(0, 4000) || null,
      found_job,
      found_job_place: String(formData.get("found_job_place") ?? "").trim().slice(0, 200) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,profile_id" }
  );
  if (error) {
    console.error("[coordinator] review save failed:", error.message);
    return { error: "השמירה נכשלה — נסי שוב." };
  }
  revalidatePath("/coordinator");
  revalidatePath(`/coordinator/member/${profileId}`);
  return { ok: true };
}
