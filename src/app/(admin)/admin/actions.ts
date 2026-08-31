"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sendResendEmail } from "@/lib/email/resend";
import {
  applicationPipelineEmail,
  applicationStatusEmail,
  candidateSubmittedEmail,
  jobCandidatesEmail,
  jobPublishedEmail,
  mentorApprovedEmail,
  mentorDeclinedEmail,
  teamPersonalEmail,
  teamRepliedEmail,
  mentorAssignmentInviteEmail,
} from "@/lib/email/templates";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { queueRevokeAll } from "@/lib/drive-shares";
import { activateSubscription } from "@/lib/payments/subscription";
import { loadAudiencePools } from "@/lib/admin/audience";
import { loadClientJob } from "@/lib/portal/jobs";
import { decryptPassword } from "@/lib/portal/auth";
import { getSiteUrl } from "@/lib/site";
import { htmlToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import { buildTechLabelMap, techKey } from "@/lib/tech-match";
import type {
  ApplicationStatus,
  ClientCrmStatus,
  EmploymentType,
  JobKind,
  JobSource,
  JobStatus,
  ProfileStatus,
  QuestionAnswerType,
  ReportStatus,
  TaxonomyKind,
  UserRole,
} from "@/types/database";

/** Promote/demote a member's role (void wrapper for direct form actions). */
export async function setMemberRoleAction(id: string, role: UserRole): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/mentors");
  revalidatePath("/admin/members");
}

/**
 * Resolve or dismiss a report. Resolving ("טופל") also removes the reported
 * content from the community — that's what handling a report means.
 */
export async function updateReportStatus(id: string, status: ReportStatus) {
  await requireRole("admin");
  const supabase = await createClient();

  if (status === "reviewed") {
    const { data: report } = await supabase
      .from("reports")
      .select("target_type, target_id")
      .eq("id", id)
      .maybeSingle();
    if (report) {
      const admin = createAdminClient();
      if (report.target_type === "post") {
        // Clear children first in case the FK isn't cascading.
        await admin.from("reactions").delete().eq("post_id", report.target_id);
        await admin.from("comments").delete().eq("post_id", report.target_id);
        await admin.from("posts").delete().eq("id", report.target_id);
      } else {
        await admin.from("comments").delete().eq("id", report.target_id);
      }
    }
  }

  await supabase.from("reports").update({ status }).eq("id", id);
  revalidatePath("/admin/moderation");
  revalidatePath("/forum");
  revalidatePath("/feed");
}

/** Resolve (or reopen) a member's request to be matched with a mentor. */
export async function setMentorRequestStatus(id: string, status: "open" | "handled"): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("mentor_requests")
    .update({ status, handled_at: status === "handled" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/mentor-requests");
  revalidatePath("/mentor");
}

/**
 * Reopen a handled request WITH a documented reason (Shira: no reopen without
 * why). Clears the existing assignment — the assigned mentor's invite dies
 * with it, which the confirm dialog says out loud.
 */
export async function reopenMentorRequest(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return; // the UI requires it; the server won't act without it
  const supabase = await createClient();
  await supabase
    .from("mentor_requests")
    .update({
      status: "open",
      handled_at: null,
      assigned_mentor_id: null,
      mentor_accepted_at: null,
      reopen_reason: reason,
      reopened_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/mentor-requests");
  revalidatePath("/mentor");
}

/** Mark a mentor temporarily unavailable / available again, with a log line. */
export async function setMentorAvailability(
  mentorId: string,
  available: boolean,
  reason?: string
): Promise<void> {
  const me = await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("profiles").update({ mentor_available: available }).eq("id", mentorId);
  await admin.from("mentor_admin_log").insert({
    mentor_id: mentorId,
    action: available ? "available" : "unavailable",
    reason: reason?.trim().slice(0, 300) || null,
    created_by: me.id,
  });
  revalidatePath("/admin/mentors");
  revalidatePath("/admin/mentor-requests");
}

/**
 * Cancel a mentor's appointment — reason required, logged, and every member
 * she actively accompanies is emailed and her request reopened for a new
 * match. (Shira: no cancel without a reason and without telling the members.)
 */
export async function cancelMentorRole(mentorId: string, formData: FormData): Promise<void> {
  const me = await requireRole("admin");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return;
  const admin = createAdminClient();

  const { data: mentor } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", mentorId)
    .maybeSingle();
  if (!mentor) return;

  // Active accompaniments: assigned to her and accepted (the member SEES her).
  const { data: active } = await admin
    .from("mentor_requests")
    .select("id, profile_id")
    .eq("assigned_mentor_id", mentorId)
    .eq("status", "handled")
    .not("mentor_accepted_at", "is", null);

  for (const req of active ?? []) {
    await admin
      .from("mentor_requests")
      .update({
        status: "open",
        handled_at: null,
        assigned_mentor_id: null,
        mentor_accepted_at: null,
        reopen_reason: `המנטורית ${mentor.full_name} סיימה את תפקידה`,
        reopened_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(req.profile_id);
      const to = authUser?.user?.email;
      if (to) {
        const { data: memberRow } = await admin
          .from("profiles")
          .select("first_name, full_name")
          .eq("id", req.profile_id)
          .maybeSingle();
        const first = memberRow?.first_name || memberRow?.full_name?.split(" ")[0] || "";
        await sendResendEmail({
          to,
          subject: "עדכון על הליווי שלך בקוד פתוח 💜",
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7"><p>היי ${first},</p><p>${mentor.full_name} מסיימת את תפקידה כמנטורית בקהילה, ולכן הליווי איתה נעצר. הבקשה שלך חזרה אלינו — אנחנו כבר מחפשות לך מנטורית חדשה ונעדכן אותך ברגע שנשבץ 💜</p><p>צוות קוד פתוח</p></div>`,
        });
      }
    } catch (e) {
      console.error("[mentors] cancel email failed:", e);
    }
  }

  await admin.from("mentor_admin_log").insert({
    mentor_id: mentorId,
    action: "role_cancelled",
    reason,
    created_by: me.id,
  });
  await admin.from("profiles").update({ role: "junior", mentor_available: true }).eq("id", mentorId);
  revalidatePath("/admin/mentors");
  revalidatePath("/admin/mentor-requests");
  revalidatePath("/mentor");
}

/**
 * Assign a mentor to a member's request: marks it handled with the mentor
 * recorded, and tells the member who will accompany her (best-effort email).
 */
export async function assignMentorToRequest(requestId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const mentorId = String(formData.get("mentor_id") ?? "");
  if (!mentorId) return;
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("mentor_requests")
    .select("id, profile_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;

  const { error } = await supabase
    .from("mentor_requests")
    .update({
      assigned_mentor_id: mentorId,
      status: "handled",
      handled_at: new Date().toISOString(),
      // The MENTOR must accept before the member sees her (owner's flow).
      mentor_accepted_at: null,
    })
    .eq("id", requestId);
  if (error) return;

  await inviteMentorToAssignment(requestId);

  revalidatePath("/admin/mentor-requests");
  revalidatePath("/mentor");
}

/**
 * Email the assigned MENTOR: who was matched to her and for what purpose —
 * with the acceptance ask. Best-effort; never rolls back the assignment.
 */
async function inviteMentorToAssignment(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: req } = await admin
      .from("mentor_requests")
      .select("id, profile_id, assigned_mentor_id, reason, note, kind")
      .eq("id", requestId)
      .maybeSingle();
    if (!req?.assigned_mentor_id) return;
    const [{ data: member }, { data: mentor }, { data: mentorAuth }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", req.profile_id).maybeSingle(),
      admin.from("profiles").select("first_name, full_name").eq("id", req.assigned_mentor_id).maybeSingle(),
      admin.auth.admin.getUserById(req.assigned_mentor_id),
    ]);
    const email = mentorAuth?.user?.email;
    if (!email) return;
    const purpose =
      req.kind === "employment" ? "ליווי בחודשי עבודה ראשונים" : mentorReasonLabel(req.reason);
    const built = mentorAssignmentInviteEmail(
      mentor?.first_name || mentor?.full_name?.split(" ")[0] || undefined,
      member?.full_name || "חברת קהילה",
      purpose,
      req.note ?? null
    );
    const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
    if (!sent.ok) console.error("[mentor invite email] send failed:", sent.error);
  } catch (e) {
    console.error("[mentor invite email] failed:", e);
  }
}

/**
 * Employment accompaniment is the admin's call — assign a mentor to accompany
 * a member in her first months on the job. Upsert-style: an existing
 * employment mentor_request row (latest) is updated, otherwise one is
 * inserted already handled. The member is told by email (best-effort).
 */
export async function assignEmploymentMentor(
  profileId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");
  const mentorId = String(formData.get("mentor_id") ?? "");
  if (!mentorId) return { error: "בחרי מנטורית מהרשימה." };
  // Service role: RLS only lets a member insert her OWN request — here the
  // ADMIN creates the assignment on the member's behalf (role verified above).
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("mentor_requests")
    .select("id")
    .eq("profile_id", profileId)
    .eq("kind", "employment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inserted = existing
    ? await supabase
        .from("mentor_requests")
        .update({
          assigned_mentor_id: mentorId,
          status: "handled",
          handled_at: now,
          mentor_accepted_at: null,
        })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("mentor_requests")
        .insert({
          profile_id: profileId,
          kind: "employment",
          reason: "first_months",
          status: "handled",
          assigned_mentor_id: mentorId,
          handled_at: now,
        })
        .select("id")
        .maybeSingle();
  if (inserted.error || !inserted.data) return { error: "השיוך נכשל. רענני את הדף ונסי שוב." };

  // The mentor gets the invite — the member hears about it when she accepts.
  await inviteMentorToAssignment(inserted.data.id);

  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/profile");
  revalidatePath("/admin/mentor-requests");
  return { ok: true };
}

/**
 * Admin-set employment status on a member's profile (retroactive marking).
 * hired_at is only ever set while found_job is on; turning found_job off
 * clears hired_via_us, hired_at and workplace together.
 */
export async function setMemberEmployment(
  profileId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");

  const foundJob = formData.get("found_job") === "on";
  const hiredViaUs = formData.get("hired_via_us") === "on";
  const workplace = String(formData.get("workplace") ?? "").trim().slice(0, 200);
  const dateRaw = String(formData.get("hired_at") ?? "").trim();

  let update: {
    found_job: boolean;
    hired_via_us: boolean;
    hired_at: string | null;
  };
  if (foundJob) {
    const parsed = dateRaw ? new Date(dateRaw) : new Date();
    update = {
      found_job: true,
      hired_via_us: hiredViaUs,
      hired_at: (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString(),
    };
  } else {
    update = { found_job: false, hired_via_us: false, hired_at: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(update).eq("id", profileId);
  if (error) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };

  // The workplace name lives in member_private — other members must never be
  // able to read where she works (and for an internal job it IS the client).
  const { error: wpError } = await createAdminClient()
    .from("member_private")
    .upsert(
      { profile_id: profileId, workplace: foundJob ? workplace || null : null },
      { onConflict: "profile_id" }
    );
  if (wpError) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };

  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/forum"); // the hired-celebration banner lives there
  return { ok: true };
}

// -------------------------------------------------- manual hires (banner-only)

/**
 * Add a woman placed via Open Code without ever joining the community — her
 * name (only) joins the forum's hired-celebration banner for 60 days.
 */
export async function addManualHire(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireRole("admin");

  const full_name = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  if (!full_name) return { error: "כתבי את השם המלא." };
  const dateRaw = String(formData.get("hired_at") ?? "").trim();
  const parsed = dateRaw ? new Date(dateRaw) : new Date();
  const hired_at = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();

  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_hires")
    .insert({ full_name, hired_at, created_by: me.id });
  if (error) return { error: "לא הצלחנו להוסיף כרגע. נסי שוב." };

  revalidatePath("/admin/members");
  revalidatePath("/forum");
  return { ok: true };
}

/** Remove an off-community hire from the banner list. */
export async function deleteManualHire(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("manual_hires").delete().eq("id", id);
  revalidatePath("/admin/members");
  revalidatePath("/forum");
}

export type CrmState = { error?: string };

/**
 * Toggle a member's VIP star, with an optional admin-only reason. Lives in
 * member_crm (admin-only RLS) — never on profiles, which members can read.
 */
export async function toggleVip(id: string, isVip: boolean, reason?: string): Promise<CrmState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("member_crm").upsert(
    { profile_id: id, is_vip: isVip, vip_reason: isVip ? reason?.trim() || null : null },
    { onConflict: "profile_id" }
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  if (error) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  return {};
}

/** Save internal notes on a member (admin-only, for screening). */
export async function saveInternalNotes(id: string, notes: string): Promise<CrmState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("member_crm").upsert(
    { profile_id: id, internal_notes: notes.trim() || null },
    { onConflict: "profile_id" }
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  if (error) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  return {};
}

/**
 * רישום תשלום ידני — the fallback for a real charge whose CallBack never
 * arrived (or arrived broken). Flipping the profile to active by hand creates
 * a ghost: no subscription row, so she never expires and appears in no
 * payment report. This goes through activateSubscription — the same single
 * door the webhook uses — so a subscription AND a payment row are written,
 * and if the CallBack shows up later the webhook's idempotency check finds
 * the asmachta already recorded and skips it.
 */
export async function recordManualPayment(
  profileId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");
  const transactionId = String(formData.get("asmachta") ?? "").trim();
  const amountShekels = Number(formData.get("amount"));
  if (!transactionId) {
    return { error: "צריך את מספר האסמכתא מנדרים — בלעדיו אי אפשר לזהות את החיוב." };
  }
  if (!Number.isFinite(amountShekels) || amountShekels <= 0) {
    return { error: "סכום לא תקין." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("provider_payment_id", transactionId)
    .maybeSingle();
  if (existing) {
    return { error: "האסמכתא הזו כבר רשומה — התשלום נקלט, אין צורך לרשום שוב." };
  }

  await activateSubscription({
    profileId,
    plan: "monthly",
    providerPaymentId: transactionId,
    amountAgorot: Math.round(amountShekels * 100),
    raw: { manual: true, recordedBy: "admin", at: new Date().toISOString() },
  });

  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/admin/members");
  return {};
}

/** Approve / reject / pause a member. Admin-gated (action + RLS + role check). */
/**
 * Hide (or unhide) a profile from the other members — for the team's
 * test/preview accounts. The account itself stays fully functional: it
 * leaves the members directory, the chat search and the employer portal,
 * but its own login sees the app exactly like any member.
 */
export async function setMemberHidden(profileId: string, hidden: boolean): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_hidden: hidden }).eq("id", profileId);
  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function setMemberStatus(profileId: string, status: ProfileStatus) {
  await requireRole("admin");
  const supabase = await createClient();

  // "פעילה" means PAYING for a junior — activation comes from the payment
  // webhook, not from a button. Without this guard a well-meaning אישור used
  // to open chat, courses and Drive to someone who never paid (2026-08-30:
  // "הוא ללא מנוי ועדיין יכול להתכתב"). Mentors' activation is the mentor
  // acceptance flow; admins are never gated.
  if (status === "active") {
    const admin = createAdminClient();
    const [{ data: target }, { count: liveSubs }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", profileId).maybeSingle(),
      admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .eq("status", "active"),
    ]);
    if (target?.role === "junior" && (liveSubs ?? 0) === 0) {
      return {
        error:
          "אין לה מנוי פעיל — חברה ללא תשלום נכנסת חופשי בלי אישור, והפעלה מלאה קורית אוטומטית עם התשלום. אם שולם מחוץ למערכת, שייכי את התשלום במסך התשלומים.",
      };
    }
  }

  const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
  if (error) return { error: error.message };

  // Drive access follows membership — but only one way now. Approving her
  // grants nothing: it decides what she MAY open, and the material reaches her
  // when she opens it. Pausing or rejecting still takes back everything she
  // really did open.
  try {
    if (status === "paused" || status === "rejected") {
      await queueRevokeAll(profileId);
    }
  } catch (e) {
    console.error("[drive] member status queue failed:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/shares");
  return {};
}

/** Change a member's role (e.g. promote to mentor). */
export async function setMemberRole(profileId: string, role: UserRole) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return {};
}

/** Add a tag/value to a taxonomy list (technologies, regions, specializations…). */
export async function addTaxonomy(
  kind: TaxonomyKind,
  labelHe: string,
  groupHe?: string
): Promise<void> {
  await requireRole("admin");
  const label = labelHe.trim();
  if (!label) return;
  // Derive a stable machine value; Hebrew labels fall back to a random slug.
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const value = ascii || `v${Math.random().toString(36).slice(2, 8)}`;
  const supabase = await createClient();
  // Land at the end of the group (or the whole list) so the new chip shows
  // where it was added, not at a random spot.
  const { data: last } = await supabase
    .from("config_taxonomies")
    .select("sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("config_taxonomies").insert({
    kind,
    value,
    label_he: label,
    group_he: groupHe?.trim() || null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  revalidatePath("/admin/config");
}

/** Remove a tag/value from a taxonomy list. */
export async function removeTaxonomy(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("config_taxonomies").delete().eq("id", id);
  revalidatePath("/admin/config");
}

type QOption = { value: string; label: string };

/** Add an option to a select/multiselect profile question's list. */
export async function addQuestionOption(questionId: string, labelHe: string): Promise<void> {
  await requireRole("admin");
  const label = labelHe.trim();
  if (!label) return;
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("config_questions")
    .select("options")
    .eq("id", questionId)
    .single();
  const current: QOption[] = Array.isArray(q?.options) ? (q!.options as unknown as QOption[]) : [];
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const value = ascii || `v${Math.random().toString(36).slice(2, 8)}`;
  if (current.some((o) => o.value === value || o.label === label)) return;
  const next = [...current, { value, label }];
  await supabase.from("config_questions").update({ options: next as never }).eq("id", questionId);
  revalidatePath("/admin/config");
}

/** Remove an option (by value) from a profile question's list. */
export async function removeQuestionOption(questionId: string, value: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("config_questions")
    .select("options")
    .eq("id", questionId)
    .single();
  const current: QOption[] = Array.isArray(q?.options) ? (q!.options as unknown as QOption[]) : [];
  const next = current.filter((o) => o.value !== value);
  await supabase.from("config_questions").update({ options: next as never }).eq("id", questionId);
  revalidatePath("/admin/config");
}

// Questions that drive the form's structure and must never be disabled.
const STRUCTURAL_QUESTION_KEYS = ["has_experience"];

/** Show / hide a profile question (the dynamic configuration screen). */
export async function toggleQuestionActive(id: string, active: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
  // Never allow disabling a structural question (it breaks the form's branching).
  if (!active) {
    const { data: q } = await supabase.from("config_questions").select("key").eq("id", id).maybeSingle();
    if (q && STRUCTURAL_QUESTION_KEYS.includes(q.key)) {
      return { error: "לא ניתן לכבות שאלה מובנית." };
    }
  }
  const { error } = await supabase.from("config_questions").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return {};
}

export type PricingState = { error?: string; ok?: boolean };

/** Set community membership pricing (monthly fee ₪, annual discount %, min term). */
export async function updatePricing(
  _prev: PricingState,
  formData: FormData
): Promise<PricingState> {
  await requireRole("admin");

  const monthlyShekels = Number(formData.get("monthly"));
  const annualDiscountPct = Number(formData.get("discount"));
  const minTermMonths = Number(formData.get("minTerm"));

  if (!Number.isFinite(monthlyShekels) || monthlyShekels <= 0) {
    return { error: "מחיר חודשי לא תקין." };
  }
  if (!Number.isFinite(annualDiscountPct) || annualDiscountPct < 0 || annualDiscountPct > 100) {
    return { error: "אחוז הנחה צריך להיות בין 0 ל-100." };
  }
  // 0 is a real choice — it means no commitment, and the join screen says so.
  if (!Number.isFinite(minTermMonths) || minTermMonths < 0) {
    return { error: "מינימום חודשים לא תקין." };
  }

  const value = {
    monthlyAgorot: Math.round(monthlyShekels * 100),
    annualDiscountPct: Math.round(annualDiscountPct),
    minTermMonths: Math.round(minTermMonths),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "pricing", value }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/config");
  revalidatePath("/join");
  return { ok: true };
}

/**
 * Word the four session-feedback rating questions (the PM: the admin decides
 * what each session's feedback asks). Empty input falls back to the default
 * wording — the slots themselves are fixed DB columns.
 */
export async function updateFeedbackLabels(
  _prev: PricingState,
  formData: FormData
): Promise<PricingState> {
  await requireRole("admin");

  const value: Record<string, string> = {};
  for (const name of ["content", "practical", "clarity", "speaker"]) {
    const label = String(formData.get(name) ?? "").trim();
    if (label) value[name] = label.slice(0, 80);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "session_feedback_labels", value }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/config");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The "מאגר המנטוריות עוד בבנייה" notice on the member's mentor screen —
 * on while the pool is small, off with one click when it's ready.
 */
export async function setMentorPoolNotice(on: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("app_settings")
    .upsert({ key: "mentor_pool_notice", value: { on } }, { onConflict: "key" });
  revalidatePath("/admin/config");
  revalidatePath("/mentor");
}

/**
 * The launch-period nudge above the request widget ("הקהילה בהרצה 🚀") —
 * the owner turns it off here when the launch settles (30/8).
 */
export async function setLaunchNudge(on: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("app_settings")
    .upsert({ key: "launch_nudge", value: { on } }, { onConflict: "key" });
  revalidatePath("/admin/config");
  revalidatePath("/", "layout");
}

export type FormState = { ok?: boolean; error?: string };

const EMPLOYMENT: EmploymentType[] = ["full", "part", "student", "freelance"];
const JOB_KINDS: JobKind[] = [
  "immediate",
  "practicum_placement",
  "practicum_percent",
  "practicum_free",
  "other",
];

function jobFields(formData: FormData) {
  // Linking a job to a portal client is what routes the right CV to the right
  // employer: a candidate's application to this job is what that client
  // downloads from the portal.
  const clientRaw = String(formData.get("client_id") ?? "").trim();
  const client_id = clientRaw || null;
  const company = String(formData.get("company") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const source: JobSource = String(formData.get("source") ?? "open") === "ours" ? "ours" : "open";
  const empRaw = String(formData.get("employment_type") ?? "full");
  const employment_type: EmploymentType = EMPLOYMENT.includes(empRaw as EmploymentType)
    ? (empRaw as EmploymentType)
    : "full";
  const external_url = String(formData.get("external_url") ?? "").trim() || null;
  // The member board's role filter (30/8) — a fixed vocabulary, אחר as the
  // honest fallback.
  const ROLES = ["פיתוח", "בדיקות", "יישום", "ניתוח מערכות", "דאטה", "ניהול מוצר", "עיצוב", "אחר"];
  const roleRaw = String(formData.get("role_category") ?? "").trim();
  const role_category = ROLES.includes(roleRaw) ? roleRaw : "אחר";

  const kindRaw = String(formData.get("job_kind") ?? "immediate");
  const job_kind: JobKind = JOB_KINDS.includes(kindRaw as JobKind)
    ? (kindRaw as JobKind)
    : "immediate";
  // The employer's hire-percentage only means something on a percent-practicum
  // job — anything else (or an empty/invalid value) is stored as null.
  const pctRaw = String(formData.get("practicum_percent") ?? "").trim();
  const pct = pctRaw ? Math.round(Number(pctRaw)) : NaN;
  const practicum_percent =
    job_kind === "practicum_percent" && Number.isFinite(pct) && pct >= 1 && pct <= 100 ? pct : null;

  return {
    company,
    title,
    source,
    client_id,
    employment_type,
    location: String(formData.get("location") ?? "").trim() || null,
    description: String(formData.get("description") ?? ""),
    tech_tags: String(formData.get("tech") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    external_url,
    job_kind,
    practicum_percent,
    role_category,
    description_html: sanitizeRichHtml(String(formData.get("description_html") ?? "")) || null,
  };
}

/**
 * The plain description mirrors the rich one (line breaks kept, styling
 * dropped) — the admin writes once. A manually typed plain text only wins
 * when no rich text exists.
 */
function withDerivedDescription(f: ReturnType<typeof jobFields>) {
  const derived = htmlToPlainText(f.description_html);
  return { ...f, description: derived || f.description };
}

function validateJob(f: ReturnType<typeof jobFields>): string | null {
  if (!f.company || !f.title) return "חברה ותפקיד הם שדות חובה.";
  // Our jobs always belong to a client — the whole pipeline (portal, send-to-
  // client, CRM) hangs off that link, so it's chosen first, never afterthought.
  if (f.source === "ours" && !f.client_id)
    return "למשרה שלנו חובה לבחור לקוח — בחרי מהרשימה או צרי לקוח חדש.";
  // Market ("open") jobs are applied to off-site — a link is required.
  if (f.source === "open" && !f.external_url) return "למשרה מהשוק חובה קישור להגשה.";
  return null;
}

/** Everything except the portal link — used to retry before that migration. */
function withoutClient<T extends { client_id: string | null }>(f: T) {
  const { client_id: _drop, ...rest } = f;
  void _drop;
  return rest;
}

/** Everything except the CRM-migration columns (_jobs_crm.sql) — retry before it ran. */
function withoutCrmColumns<T extends { job_kind: JobKind; practicum_percent: number | null; description_html: string | null }>(
  f: T
) {
  const { job_kind: _k, practicum_percent: _p, description_html: _d, ...rest } = f;
  void _k;
  void _p;
  void _d;
  return rest;
}

/** Postgres/PostgREST "column does not exist" — the pre-migration case only. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /client_id|cv_document_id|job_kind|practicum_percent|description_html|column/i.test(
      error.message ?? ""
    )
  );
}

const ANSWER_TYPES: QuestionAnswerType[] = ["paragraph", "number", "select", "multiselect"];

interface CleanJobQuestion {
  question: string;
  answer_type: QuestionAnswerType;
  options: string[] | null;
  required: boolean;
}

/**
 * Sanitize an admin-typed application question: trimmed non-empty text, a
 * valid answer type (anything else → paragraph) and — for the two choice
 * types — deduped non-empty options (max 20). A choice question with fewer
 * than two options degrades to a free-text paragraph.
 */
function sanitizeJobQuestion(
  rawQuestion: unknown,
  rawType: unknown,
  rawOptions: unknown,
  rawRequired?: unknown
): CleanJobQuestion | null {
  const question = String(rawQuestion ?? "").trim();
  if (!question) return null;
  let answer_type: QuestionAnswerType = ANSWER_TYPES.includes(rawType as QuestionAnswerType)
    ? (rawType as QuestionAnswerType)
    : "paragraph";
  let options: string[] | null = null;
  if (answer_type === "select" || answer_type === "multiselect") {
    const list = Array.isArray(rawOptions) ? rawOptions : [];
    const clean = [...new Set(list.map((o) => String(o ?? "").trim()).filter(Boolean))].slice(0, 20);
    if (clean.length >= 2) options = clean;
    else answer_type = "paragraph";
  }
  // Anything except an explicit "off" keeps the default: required.
  const required = rawRequired === false || rawRequired === "false" || rawRequired === "off" ? false : true;
  return { question, answer_type, options, required };
}

/**
 * Free-typed tech tags settle to the taxonomy's label when recognized —
 * "pyton" and "SQL..." were live on the board, and free text that matches
 * nothing in the taxonomy is exactly what broke profile matching (BUG-007).
 * Unrecognized tags stay as typed; matching canonicalizes anyway.
 */
async function normalizeTechTags(tags: string[]): Promise<string[]> {
  if (tags.length === 0) return tags;
  const { data } = await createAdminClient()
    .from("config_taxonomies")
    .select("value, label_he")
    .eq("kind", "tech");
  const labelByKey = buildTechLabelMap(data ?? []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const pretty = labelByKey.get(techKey(tag)) ?? tag;
    const key = techKey(pretty);
    if (seen.has(key)) continue; // "JS, javascript" collapses to one tag
    seen.add(key);
    out.push(pretty);
  }
  return out;
}

/** Post a new job to the board. */
export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const fields = jobFields(formData);
  fields.tech_tags = await normalizeTechTags(fields.tech_tags);
  const err = validateJob(fields);
  if (err) return { error: err };

  // An "ours" job is born CLOSED (invisible on the board) — it goes live only
  // when the admin publishes it to its audience. Market jobs open immediately.
  const f = {
    ...withDerivedDescription(fields),
    status: (fields.source === "ours" ? "closed" : "open") as JobStatus,
  };

  const supabase = await createClient();
  let jobId: string | null = null;
  const { data: created, error } = await supabase.from("jobs").insert(f).select("id").single();
  jobId = created?.id ?? null;
  if (error) {
    // Backward-safe: retry without newer-migration columns ONLY when a column
    // is what's missing — a real error must still surface. First without the
    // CRM columns (_jobs_crm.sql), then also without the portal link.
    if (!isMissingColumn(error)) return { error: error.message };
    const { data: r1, error: retry } = await supabase
      .from("jobs")
      .insert(withoutCrmColumns(f))
      .select("id")
      .single();
    jobId = r1?.id ?? null;
    if (retry) {
      if (!isMissingColumn(retry)) return { error: retry.message };
      const { data: r2, error: retry2 } = await supabase
        .from("jobs")
        .insert(withoutClient(withoutCrmColumns(f)))
        .select("id")
        .single();
      jobId = r2?.id ?? null;
      if (retry2) return { error: retry2.message };
    }
  }

  // Required application questions typed during creation (JSON array of
  // {question, answer_type, options} objects — legacy plain strings still
  // parse). Best-effort — the job itself is already saved.
  if (jobId) {
    try {
      const raw = JSON.parse(String(formData.get("questions") ?? "[]")) as unknown;
      const questions = (Array.isArray(raw) ? raw : [])
        .map((q) =>
          typeof q === "object" && q !== null
            ? sanitizeJobQuestion(
                (q as Record<string, unknown>).question,
                (q as Record<string, unknown>).answer_type,
                (q as Record<string, unknown>).options,
                (q as Record<string, unknown>).required
              )
            : sanitizeJobQuestion(q, "paragraph", null)
        )
        .filter((q): q is CleanJobQuestion => q !== null)
        .slice(0, 20);
      if (questions.length) {
        const { error: qError } = await supabase.from("job_questions").insert(
          questions.map((q, i) => ({
            job_id: jobId!,
            question: q.question,
            answer_type: q.answer_type,
            options: q.options,
            required: q.required,
            sort_order: i,
          }))
        );
        if (qError && isMissingColumn(qError)) {
          // Pre-migration DB: keep the questions, drop the answer-type columns.
          await supabase
            .from("job_questions")
            .insert(questions.map((q, i) => ({ job_id: jobId!, question: q.question, sort_order: i })));
        } else if (qError) {
          console.error("[create job] questions insert failed:", qError);
        }
      }
    } catch (e) {
      console.error("[create job] questions insert failed:", e);
    }
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  // Back to the list, with the fresh job on top.
  redirect("/admin/jobs?created=1");
}

/** Edit an existing job. */
export async function editJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const fields = jobFields(formData);
  fields.tech_tags = await normalizeTechTags(fields.tech_tags);
  const f = withDerivedDescription(fields);
  const err = validateJob(f);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(f).eq("id", jobId);
  if (error) {
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase.from("jobs").update(withoutCrmColumns(f)).eq("id", jobId);
    if (retry) {
      if (!isMissingColumn(retry)) return { error: retry.message };
      const { error: retry2 } = await supabase
        .from("jobs")
        .update(withoutClient(withoutCrmColumns(f)))
        .eq("id", jobId);
      if (retry2) return { error: retry2.message };
    }
  }
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

/** Close (or reopen) a job — closed jobs disappear from the members' board. */
export async function setJobStatus(jobId: string, open: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").update({ status: open ? "open" : "closed" }).eq("id", jobId);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

/** Bulk close/reopen/delete — the PM's checkbox actions on several jobs. */
export async function bulkJobs(jobIds: string[], op: "close" | "open" | "delete"): Promise<void> {
  await requireRole("admin");
  const ids = [...new Set(jobIds.filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return;
  const supabase = await createClient();
  if (op === "delete") {
    await supabase.from("jobs").delete().in("id", ids);
  } else {
    await supabase.from("jobs").update({ status: op === "open" ? "open" : "closed" }).in("id", ids);
  }
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

/** Delete a job permanently. */
export async function deleteJob(jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").delete().eq("id", jobId);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

// ------------------------------------------------------------ job questions
// The built-in question ("למה את חושבת שאת מתאימה למשרה?") lives in code —
// these are only the extra, per-job questions the admin defines.

/** Add a required application question to a job (appended last). */
export async function addJobQuestion(
  jobId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");
  const parsed = sanitizeJobQuestion(
    formData.get("question"),
    String(formData.get("answer_type") ?? "paragraph"),
    String(formData.get("options") ?? "").split(","),
    formData.get("required") === null ? "off" : "on"
  );
  if (!parsed) return { error: "כתבי את נוסח השאלה." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("job_questions")
    .select("sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("job_questions").insert({
    job_id: jobId,
    question: parsed.question,
    answer_type: parsed.answer_type,
    options: parsed.options,
    required: parsed.required,
    sort_order,
  });
  if (error) {
    // Pre-migration DB: keep the question, drop the answer-type columns.
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase
      .from("job_questions")
      .insert({ job_id: jobId, question: parsed.question, sort_order });
    if (retry) return { error: retry.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

/** Edit an existing application question: text, answer type, options, required. */
export async function updateJobQuestion(
  questionId: string,
  jobId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");
  const parsed = sanitizeJobQuestion(
    formData.get("question"),
    String(formData.get("answer_type") ?? "paragraph"),
    String(formData.get("options") ?? "").split(","),
    formData.get("required") === null ? "off" : "on"
  );
  if (!parsed) return { error: "כתבי את נוסח השאלה." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_questions")
    .update({
      question: parsed.question,
      answer_type: parsed.answer_type,
      options: parsed.options,
      required: parsed.required,
    })
    .eq("id", questionId)
    .eq("job_id", jobId);
  if (error) {
    // Pre-migration DB: keep the text edit, drop the answer-type columns.
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase
      .from("job_questions")
      .update({ question: parsed.question })
      .eq("id", questionId)
      .eq("job_id", jobId);
    if (retry) return { error: retry.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

/** Remove a question from a job. */
export async function deleteJobQuestion(id: string, jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("job_questions").delete().eq("id", id).eq("job_id", jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
}

/** Move a question one step up/down by swapping sort_order with its neighbor. */
export async function moveJobQuestion(id: string, jobId: string, dir: "up" | "down"): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("job_questions")
    .select("id, sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!rows || rows.length < 2) return;

  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return;

  const a = rows[idx];
  const b = rows[swapIdx];
  if (a.sort_order !== b.sort_order) {
    await Promise.all([
      supabase.from("job_questions").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("job_questions").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  } else {
    // Legacy rows can share a sort_order — reindex the whole list (with the
    // two swapped) so every question gets a distinct integer again.
    const order = rows.map((r) => r.id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    await Promise.all(
      order.map((qid, i) =>
        supabase.from("job_questions").update({ sort_order: i }).eq("id", qid)
      )
    );
  }
  revalidatePath(`/admin/jobs/${jobId}`);
}

// ---------------------------------------------------- targeted job publishing

export interface AudienceFilters {
  /**
   * question key → selected catalogue values (display labels). A key with an
   * empty selection doesn't filter; keys come from buildAudienceCatalogue().
   */
  criteria?: Record<string, string[]>;
  /** true = experienced only, false = juniors only, undefined = everyone. */
  experienced?: boolean;
  /** Also offer the job to mentors (senior roles) — per-job admin decision. */
  includeMentors?: boolean;
}

export interface AudienceMember {
  id: string;
  full_name: string;
  specialization: string | null;
  region: string | null;
  /** Paying member (active) vs free (pending). Admin-only indication. */
  is_subscriber: boolean;
  /** Internal VIP flag from member_crm — never leaves admin screens. */
  is_vip: boolean;
}

/**
 * Members eligible for a targeted publish: active/pending juniors with a
 * completed profile, matched against ANY profile criterion. A member passes
 * when, for every criterion with selected values, at least one of them appears
 * in her pool (case-insensitive; pools are label-resolved). Pools come from
 * src/lib/admin/audience.ts — the same pass that builds the panel's catalogue —
 * so what the admin picks and what a member "has" can never drift apart.
 */
export async function previewAudience(
  jobId: string,
  filters: AudienceFilters
): Promise<{ members?: AudienceMember[]; pool?: number; error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin.from("jobs").select("id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };

  const { members: eligible, pools } = await loadAudiencePools(undefined, {
    includeMentors: filters.includeMentors === true,
  });

  let members = eligible;
  if (typeof filters.experienced === "boolean") {
    members = members.filter((p) => p.is_experienced === filters.experienced);
  }

  // OR within one criterion, AND across criteria — like the portal search.
  const criteria = Object.entries(filters.criteria ?? {})
    .map(([key, values]) => ({
      key,
      wanted: (values ?? []).filter(Boolean).map((v) => v.trim().toLowerCase()),
    }))
    .filter((c) => c.wanted.length > 0);
  if (criteria.length > 0) {
    members = members.filter((m) => {
      const mine = pools.get(m.id);
      return criteria.every(({ key, wanted }) => {
        const have = mine?.get(key) ?? [];
        return wanted.some((w) => have.includes(w));
      });
    });
  }

  // VIP flags (member_crm is admin-only — this stays in admin surfaces, never
  // the portal). VIPs float to the top of the audience list.
  const { data: crm } = members.length
    ? await admin.from("member_crm").select("profile_id, is_vip").in("profile_id", members.map((m) => m.id))
    : { data: [] as { profile_id: string; is_vip: boolean | null }[] };
  const vipSet = new Set((crm ?? []).filter((c) => c.is_vip === true).map((c) => c.profile_id));

  const shaped = members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    specialization: m.specialization,
    region: m.region,
    is_subscriber: m.status === "active",
    is_vip: vipSet.has(m.id),
  }));
  shaped.sort((a, b) => Number(b.is_vip) - Number(a.is_vip) || a.full_name.localeCompare(b.full_name, "he"));

  return {
    members: shaped,
    // The pre-criteria pool — lets the UI distinguish "the community has no
    // eligible members yet" from "the criteria filtered everyone out".
    pool: eligible.length,
  };
}

/** Plain-text excerpt of the job description for the email body. */
function jobExcerpt(html: string | null, fallback: string, max = 200): string {
  const text = (html ? html.replace(/<[^>]*>/g, " ") : fallback)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * Publish a job to its chosen audience: write job_targets, flip the job to
 * published/open, and email every target that wasn't emailed yet — so
 * re-publishing with a wider audience only mails the newly added members.
 */
export async function publishJob(
  jobId: string,
  profileIds: string[],
  /** Hand-picked additions ("מעבר לקריטריונים") — recorded as source 'manual'
      so criteria-matched and hand-picked targets stay distinguishable. */
  manualIds: string[] = []
): Promise<{ ok?: boolean; error?: string; sent?: number; failed?: number; queued?: number }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company, description, description_html, published_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };

  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return { error: "בחרי לפחות חברה אחת לפרסום המשרה." };

  const manual = new Set(manualIds);
  const { error: targetsError } = await admin.from("job_targets").upsert(
    ids.map((profile_id) => ({
      job_id: jobId,
      profile_id,
      source: (manual.has(profile_id) ? "manual" : "criteria") as "manual" | "criteria",
    })),
    { onConflict: "job_id,profile_id", ignoreDuplicates: true }
  );
  if (targetsError) {
    if (isMissingColumn(targetsError)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "שמירת קהל היעד נכשלה. נסי שוב." };
  }

  const { error: jobError } = await admin
    .from("jobs")
    .update({
      pipeline_status: "published",
      status: "open",
      published_at: job.published_at ?? new Date().toISOString(),
    })
    .eq("id", jobId);
  if (jobError) return { error: "עדכון סטטוס המשרה נכשל. נסי שוב." };

  // Email only targets that never got the announcement. A small audience is
  // mailed right here (publishing feels instant); anything bigger is left on
  // the queue for the 10-minute notifications cron — a serverless action must
  // never loop thousands of sends (it gets killed mid-loop and nobody knows).
  const INLINE_LIMIT = 25;
  const { data: pending } = await admin
    .from("job_targets")
    .select("profile_id")
    .eq("job_id", jobId)
    .is("emailed_at", null);
  const toEmail = (pending ?? []).map((t) => t.profile_id);
  const inline = toEmail.slice(0, INLINE_LIMIT);
  const queued = Math.max(0, toEmail.length - inline.length);

  let sent = 0;
  let failed = 0;
  if (inline.length > 0) {
    const [{ data: named }, { data: emailRows }] = await Promise.all([
      admin.from("profiles").select("id, first_name, full_name").in("id", inline),
      admin.rpc("member_emails", { p_ids: inline }),
    ]);
    const nameOf = new Map((named ?? []).map((p) => [p.id, p]));
    const emailOf = new Map(
      ((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email])
    );
    const excerpt = jobExcerpt(job.description_html, job.description);
    const applyUrl = `${getSiteUrl()}/jobs`;
    const delivered: string[] = [];
    for (const profileId of inline) {
      try {
        const email = emailOf.get(profileId);
        if (!email) {
          failed++;
          continue;
        }
        const p = nameOf.get(profileId);
        const name = p?.first_name || p?.full_name?.split(" ")[0] || undefined;
        const built = jobPublishedEmail(name, job.title, excerpt, applyUrl);
        const result = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
        if (result.ok) {
          sent++;
          delivered.push(profileId);
        } else {
          failed++;
          console.error("[publish job email] send failed:", result.error);
        }
      } catch (e) {
        failed++;
        console.error("[publish job email] failed:", e);
      }
    }
    if (delivered.length > 0) {
      await admin
        .from("job_targets")
        .update({ emailed_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .in("profile_id", delivered);
    }
  }

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/forum");
  return { ok: true, sent, failed, queued };
}

/**
 * Bring a published job back to draft so the admin can adjust the audience and
 * publish again. Existing targets keep seeing the job (status stays open);
 * re-publishing emails only newly added members.
 */
export async function reopenJobPublish(jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").update({ pipeline_status: "draft" }).eq("id", jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
}

// ------------------------------------------------------- portal job candidates

/** Curate a candidate onto a client's job (shown to the client in the portal). */
export interface MemberFilterInput {
  defId: string;
  type: "choice" | "text" | "language";
  values: string[];
  text: string;
}

/**
 * The candidate finder's matching, moved server-side (2026-08-29): each
 * criterion resolves to member ids in SQL; AND across criteria happens here.
 * The old model preloaded every profile_answers row into the browser — at
 * 3,000 members that was ~90k rows per page view.
 */
export async function evaluateMemberFilters(filters: MemberFilterInput[]): Promise<string[]> {
  await requireRole("admin");
  const admin = createAdminClient();
  let matched: Set<string> | null = null;

  for (const f of filters.slice(0, 12)) {
    let ids: string[] = [];
    if (f.type === "text") {
      const needle = f.text.trim().slice(0, 80);
      if (!needle) continue;
      const { data } = await admin.rpc("match_answer_text", {
        p_question: f.defId,
        p_needle: needle,
      });
      ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
    } else if (f.type === "language") {
      const wanted = f.values.filter(Boolean);
      if (wanted.length === 0) continue;
      // One question's rows only (bounded by member count) — the lang/level
      // pairs live inside a jsonb array of objects, parsed here.
      const { data } = await admin
        .from("profile_answers")
        .select("profile_id, value")
        .eq("question_id", f.defId);
      const { parseLangSkills } = await import("@/lib/language-skills");
      ids = (data ?? [])
        .filter((a) => {
          const skills = parseLangSkills(a.value);
          return wanted.some((sel) => {
            const sep = sel.lastIndexOf("::");
            const lang = sel.slice(0, sep);
            const level = sel.slice(sep + 2);
            return skills.some((s) => s.lang === lang && (level === "*" || s.level === level));
          });
        })
        .map((a) => a.profile_id);
    } else {
      const wanted = f.values.filter(Boolean).slice(0, 40);
      if (wanted.length === 0) continue;
      const { data } = await admin.rpc("match_answer_ids", {
        p_question: f.defId,
        p_values: wanted,
      });
      ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
    }
    const set = new Set(ids);
    matched =
      matched === null ? set : new Set([...(matched as Set<string>)].filter((id) => set.has(id)));
    if (matched.size === 0) break;
  }

  return matched === null ? [] : [...matched].slice(0, 5000);
}

/** The per-job internal note for whoever reviews its applicants. */
export async function setJobTeamNote(jobId: string, note: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("jobs")
    .update({ team_note: note.trim().slice(0, 2000) || null })
    .eq("id", jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function addJobCandidate(jobId: string, profileId: string): Promise<void> {
  const me = await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("job_candidates")
    .upsert({ job_id: jobId, profile_id: profileId, created_by: me.id }, { onConflict: "job_id,profile_id" });
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
}

/** Remove a curated candidate from a job. */
export async function removeJobCandidate(jobId: string, profileId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("job_candidates").delete().eq("job_id", jobId).eq("profile_id", profileId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
}

/**
 * Email the client the candidates curated for their job, with a link straight
 * into that job in the portal. The names are resolved through loadClientJob —
 * the same privacy gate the portal renders behind — so a member who opted out
 * (or is paused / no longer a listed junior) is never named to the client,
 * even if she is still a row in job_candidates.
 *
 * The email also carries the client's portal credentials and an optional
 * personal note; each candidate actually sent gets her own "הגשנו אותך" email
 * and — if she applied — her application flips to status "sent".
 */
export async function sendJobCandidatesToClient(
  jobId: string,
  personalNote?: string
): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };
  if (!job.client_id) return { error: "המשרה לא מקושרת ללקוח פורטל. חברי אותה ללקוח בעריכת המשרה." };

  // Service-role read: the password is stored encrypted (reversible — see
  // portal/auth.ts) exactly so it can be handed to the client here.
  const { data: client } = await admin
    .from("portal_clients")
    .select("company_name, contact_email, username, password_enc")
    .eq("id", job.client_id)
    .maybeSingle();
  if (!client?.contact_email) {
    return { error: "ללקוח אין אימייל ליצירת קשר. הוסיפי אותו במסך לקוחות פורטל." };
  }
  const password = decryptPassword(client.password_enc);
  if (!client.username || !password) {
    return { error: "ללקוח אין עדיין פרטי גישה — הקצי במסך לקוחות פורטל." };
  }

  // Forgiving auto-curation: "אישור סופי" alone is enough to send — every
  // approved application joins job_candidates first (existing rows untouched).
  // Best-effort: a pre-migration DB without admin_mark simply adds nothing.
  const { data: approvedApps } = await admin
    .from("applications")
    .select("applicant_id")
    .eq("job_id", jobId)
    .eq("admin_mark", "approved");
  if (approvedApps?.length) {
    const { error: curateError } = await admin.from("job_candidates").upsert(
      [...new Set(approvedApps.map((a) => a.applicant_id))].map((profileId) => ({
        job_id: jobId,
        profile_id: profileId,
        created_by: me.id,
      })),
      { onConflict: "job_id,profile_id", ignoreDuplicates: true }
    );
    if (curateError) console.error("[job candidates] auto-curate failed:", curateError);
  }

  // Resolve names through the portal's single door, never from profiles
  // directly — this drops any curated candidate the client can't actually see,
  // so the email and the portal job page always name exactly the same people.
  // includeUnsent: this IS the send — we preview what's about to go out.
  const clientJob = await loadClientJob(job.client_id, jobId, { includeUnsent: true });
  const sentCandidates = clientJob?.candidates ?? [];
  const names = sentCandidates.map((c) => c.name).filter(Boolean);
  if (names.length === 0) {
    // Curated rows exist but the privacy gate hides every one of them — tell
    // the admin exactly who is hidden and why (service-role read; this list is
    // admin-facing only and never reaches the client).
    const { data: curatedRows } = await admin
      .from("job_candidates")
      .select("profile_id")
      .eq("job_id", jobId);
    const hiddenIds = [...new Set((curatedRows ?? []).map((r) => r.profile_id))];
    if (hiddenIds.length) {
      const { data: hiddenProfiles } = await admin
        .from("profiles")
        .select("id, full_name, role, status, profile_completed, portal_listed")
        .in("id", hiddenIds);
      const parts = (hiddenProfiles ?? []).map((p) => {
        const reason =
          p.role === "admin"
            ? "חשבון אדמין (רק ג'וניוריות מוצגות)"
            : p.role !== "junior"
              ? "חשבון מנטורית (רק ג'וניוריות מוצגות)"
              : p.status !== "active" && p.status !== "pending"
                ? "חברה מושהית"
                : p.profile_completed !== true
                  ? "הפרופיל לא הושלם"
                  : p.portal_listed === false
                    ? "ביקשה לא להופיע בפורטל"
                    : "לא עומדת בתנאי התצוגה בפורטל";
        return `${p.full_name} — ${reason}`;
      });
      if (parts.length) {
        return {
          error: `אף אחת מהמועמדות שנבחרו לא ניתנת להצגה ללקוח: ${parts.join(", ")}.`,
        };
      }
    }
    return {
      error:
        "אין מועמדות שניתן להציג ללקוח למשרה הזו. ודאי שהוספת מועמדות פעילות המפורסמות בפורטל.",
    };
  }

  const built = jobCandidatesEmail(
    client.company_name,
    job.title,
    names,
    `${getSiteUrl()}/portal/job/${jobId}`,
    {
      personalNote: personalNote?.trim() || null,
      credentials: { username: client.username, password },
    }
  );
  const sent = await sendResendEmail({ to: client.contact_email, subject: built.subject, html: built.html });
  if (!sent.ok) {
    console.error("[job candidates email] send failed:", sent.error);
    return { error: "המייל לא נשלח. נסי שוב." };
  }

  // The client has the list — the job pipeline moves to "candidates sent".
  const { error: pipelineError } = await admin
    .from("jobs")
    .update({ pipeline_status: "candidates_sent" })
    .eq("id", jobId);
  if (pipelineError) console.error("[job candidates] pipeline update failed:", pipelineError);

  // Everything below is best-effort per candidate — the client email is out.
  const now = new Date().toISOString();
  const candidateIds = sentCandidates.map((c) => c.id);

  // Stamp the send: only from this moment do these candidates exist for the
  // client (the portal filters on sent_at). First send time is preserved.
  if (candidateIds.length) {
    const { error: stampError } = await admin
      .from("job_candidates")
      .update({ sent_at: now })
      .eq("job_id", jobId)
      .in("profile_id", candidateIds)
      .is("sent_at", null);
    if (stampError) console.error("[job candidates] sent_at stamp failed:", stampError);
  }
  const { data: apps } = candidateIds.length
    ? await admin
        .from("applications")
        .select("id, applicant_id")
        .eq("job_id", jobId)
        .in("applicant_id", candidateIds)
    : { data: [] as { id: string; applicant_id: string }[] };
  const appOf = new Map((apps ?? []).map((a) => [a.applicant_id, a.id]));

  const { data: people } = candidateIds.length
    ? await admin.from("profiles").select("id, first_name, full_name").in("id", candidateIds)
    : { data: [] as { id: string; first_name: string | null; full_name: string }[] };
  const personOf = new Map((people ?? []).map((p) => [p.id, p]));

  for (const candidate of sentCandidates) {
    const applicationId = appOf.get(candidate.id);
    if (applicationId) {
      const { error: appError } = await admin
        .from("applications")
        .update({ status: "sent", sent_to_client_at: now })
        .eq("id", applicationId);
      if (appError) console.error("[job candidates] application update failed:", appError);
    }
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(candidate.id);
      const email = authUser?.user?.email;
      if (!email) continue;
      const p = personOf.get(candidate.id);
      const name = p?.first_name || p?.full_name?.split(" ")[0] || undefined;
      const memberBuilt = candidateSubmittedEmail(name, job.title, !!applicationId);
      const memberSent = await sendResendEmail({
        to: email,
        subject: memberBuilt.subject,
        html: memberBuilt.html,
      });
      if (!memberSent.ok) console.error("[candidate submitted email] send failed:", memberSent.error);
    } catch (e) {
      console.error("[candidate submitted email] failed:", e);
    }
  }

  // The client has the shortlist — every fresh application that is NOT part of
  // it moves to the waitlist. No email: the member just sees the gentle
  // "התקדמנו בינתיים עם מועמדות אחרות 💜" label in her jobs area.
  {
    let waitQuery = admin
      .from("applications")
      .update({ status: "waitlisted" })
      .eq("job_id", jobId)
      .in("status", ["submitted", "in_review"]);
    if (candidateIds.length) {
      waitQuery = waitQuery.not("applicant_id", "in", `(${candidateIds.join(",")})`);
    }
    const { error: waitError } = await waitQuery;
    if (waitError) console.error("[job candidates] waitlist update failed:", waitError);
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
}

// ------------------------------------------------------------- review center

export type AdminMark = "optional" | "not_fit" | "approved";

/**
 * Internal review mark on an application (אופציונלית / לא מתאימה / אישור
 * סופי). Admin-only — never surfaces to the member or the client.
 */
/**
 * The per-application internal note — "הערה ספציפית שמקושרת לבת במשרה זו"
 * (the owner, 2026-08-30). Lives in admin-only application_notes, so it can
 * never surface through the member's own application rows.
 */
/**
 * A candidate who applied OUTSIDE the community, recorded by email (the
 * owner, 31/8): the moment she signs in with this email she gets a real
 * application on this job, dated to when the team recorded her.
 */
export async function addExternalApplication(jobId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("external_applications")
    .upsert(
      { job_id: jobId, email, note, created_by: user?.id ?? null },
      { onConflict: "job_id,email", ignoreDuplicates: true }
    );
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function deleteExternalApplication(jobId: string, id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("external_applications").delete().eq("id", id);
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function setApplicationNote(
  applicationId: string,
  note: string
): Promise<FormState> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "ההגשה לא נמצאה." };

  const clean = note.trim().slice(0, 500) || null;
  const { error } = await admin
    .from("application_notes")
    .upsert(
      { application_id: applicationId, note: clean, updated_at: new Date().toISOString() },
      { onConflict: "application_id" }
    );
  if (error) return { error: "שמירת ההערה נכשלה. נסי שוב." };

  revalidatePath(`/admin/jobs/${app.job_id}`);
  return { ok: true };
}

export async function setApplicationMark(
  applicationId: string,
  mark: AdminMark | null,
  reason?: string | null
): Promise<FormState> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "ההגשה לא נמצאה." };

  // The reason rides only with "לא מתאימה" — clearing/other marks clear it.
  const admin_mark_reason =
    mark === "not_fit" ? (reason ?? "").trim().slice(0, 500) || null : null;
  const { error } = await admin
    .from("applications")
    .update({ admin_mark: mark, admin_mark_reason })
    .eq("id", applicationId);
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  }

  revalidatePath(`/admin/jobs/${app.job_id}`);
  return { ok: true };
}

/**
 * The same internal mark, applied to a whole selection at once (the review
 * center's bulk bar). One reason is shared by every row — and rides only with
 * "לא מתאימה", any other mark clears it. Admin-only, capped at 200 rows.
 */
export async function setApplicationMarkBulk(
  applicationIds: string[],
  mark: AdminMark | null,
  reason?: string | null
): Promise<FormState> {
  await requireRole("admin");
  const ids = [...new Set(applicationIds.filter((id) => typeof id === "string" && id))].slice(
    0,
    200
  );
  if (ids.length === 0) return { error: "לא נבחרו הגשות." };
  const admin = createAdminClient();

  // All rows in one bulk come from a single job's review center — resolve the
  // job from the first row for the revalidation.
  const { data: rows } = await admin
    .from("applications")
    .select("job_id")
    .in("id", ids)
    .limit(1);
  const jobId = rows?.[0]?.job_id;
  if (!jobId) return { error: "ההגשות לא נמצאו." };

  const admin_mark_reason =
    mark === "not_fit" ? (reason ?? "").trim().slice(0, 500) || null : null;
  const { error } = await admin
    .from("applications")
    .update({ admin_mark: mark, admin_mark_reason })
    .in("id", ids);
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

export type PipelineStatus = "sent" | "interview" | "exam" | "hired" | "declined";

// "sent" = we submitted her to the employer — with or without a portal
// client (the PM's quick "הוגשה ✓"). The rest move her along the pipeline.
const PIPELINE_STATUSES: PipelineStatus[] = ["sent", "interview", "exam", "hired", "declined"];

/**
 * Move an application along the client pipeline (ראיון/מבחן/גויסה/בפעם הבאה)
 * and email the member a warm update. Hiring also celebrates on her profile —
 * found_job / hired_via_us / hired_at / workplace.
 */
/**
 * Close a job's journey — "גויס" (filled, possibly by several members) or
 * "נסגר ללא גיוס" — or reopen it. Closing also takes it off the board.
 */
/**
 * Manually close (or reopen) an open job to NEW submissions — for the times
 * the admin hands candidates to the client outside the system, so the
 * automatic "candidates sent" stamp (the client-email flow) never fired.
 * Members then see "המשרה התקדמה לשלב הבא" and the apply door closes.
 * Only swaps between the open-board stages; draft/closed are never touched.
 */
export async function setJobSubmissionsClosed(jobId: string, closed: boolean): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("pipeline_status, status, source")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.source !== "ours" || job.status !== "open") return;
  if (closed && job.pipeline_status === "published") {
    await admin.from("jobs").update({ pipeline_status: "candidates_sent" }).eq("id", jobId);
  } else if (!closed && (job.pipeline_status === "candidates_sent" || job.pipeline_status === "interviews")) {
    await admin.from("jobs").update({ pipeline_status: "published" }).eq("id", jobId);
  }
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/crm");
  revalidatePath("/jobs");
}

export async function setJobOutcome(
  jobId: string,
  outcome: "hired" | "closed_no_hire" | "reopen"
): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  if (outcome === "reopen") {
    await admin
      .from("jobs")
      .update({ pipeline_status: "published", status: "open" })
      .eq("id", jobId);
  } else {
    await admin
      .from("jobs")
      .update({ pipeline_status: outcome, status: "closed" })
      .eq("id", jobId);
  }
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/crm");
  revalidatePath("/jobs");
}

export async function updateApplicationPipeline(
  applicationId: string,
  status: PipelineStatus
): Promise<FormState> {
  await requireRole("admin");
  if (!PIPELINE_STATUSES.includes(status)) return { error: "סטטוס לא תקין." };
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, applicant_id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "ההגשה לא נמצאה." };

  const { data: job } = await admin
    .from("jobs")
    .select("title, company, pipeline_status")
    .eq("id", app.job_id)
    .maybeSingle();

  const { error } = await admin.from("applications").update({ status }).eq("id", applicationId);
  if (error) return { error: "עדכון הסטטוס נכשל. נסי שוב." };

  // The first candidate reaching an interview/exam moves the JOB to
  // "ראיונות" automatically. Hiring never auto-closes the job — a role can
  // hire several members, so that call stays with the admin.
  if (
    (status === "interview" || status === "exam") &&
    (job?.pipeline_status === "published" || job?.pipeline_status === "candidates_sent")
  ) {
    await admin.from("jobs").update({ pipeline_status: "interviews" }).eq("id", app.job_id);
  }

  // גויסה 🎉 — mark the placement on her profile so the community stats know
  // she found her job through us.
  if (status === "hired") {
    const { error: hiredError } = await admin
      .from("profiles")
      .update({
        found_job: true,
        hired_via_us: true,
        hired_at: new Date().toISOString(),
      })
      .eq("id", app.applicant_id);
    if (hiredError) console.error("[pipeline] hired profile update failed:", hiredError);

    // Where she works is team-only (member_private) — on an internal job the
    // company IS the client, and rule 1 says that name never leaves the team.
    if (job?.company) {
      const { error: wpError } = await admin
        .from("member_private")
        .upsert(
          { profile_id: app.applicant_id, workplace: job.company },
          { onConflict: "profile_id" }
        );
      if (wpError) console.error("[pipeline] workplace write failed:", wpError);
    }
  }

  // Best-effort: the warm status email must not fail the update itself.
  try {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin.from("profiles").select("first_name, full_name").eq("id", app.applicant_id).single(),
      admin.auth.admin.getUserById(app.applicant_id),
    ]);
    const email = authUser?.user?.email;
    if (email && job) {
      const name = profile?.first_name || profile?.full_name?.split(" ")[0] || undefined;
      const built = applicationPipelineEmail(name, job.title, status);
      const sentEmail = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sentEmail.ok) console.error("[pipeline email] send failed:", sentEmail.error);
    }
  } catch (e) {
    console.error("[pipeline email] failed:", e);
  }

  revalidatePath(`/admin/jobs/${app.job_id}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Update a candidate application's status (internal-job pipeline). */
export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("applications").update({ status }).eq("id", applicationId);
  revalidatePath("/admin/jobs");
  // The member sees the new status on her jobs page.
  revalidatePath("/jobs");

  // Best-effort: tell the applicant by email so the status change actually
  // reaches her (in-review / accepted / rejected only).
  if (status === "in_review" || status === "accepted" || status === "rejected") {
    try {
      const { data: app } = await supabase
        .from("applications")
        .select("applicant_id, job_id")
        .eq("id", applicationId)
        .single();
      if (app) {
        const [{ data: job }, { data: profile }] = await Promise.all([
          supabase.from("jobs").select("title, company").eq("id", app.job_id).single(),
          supabase.from("profiles").select("first_name, full_name").eq("id", app.applicant_id).single(),
        ]);
        const { data: authUser } = await createAdminClient().auth.admin.getUserById(app.applicant_id);
        const email = authUser?.user?.email;
        if (email && job) {
          const name = profile?.first_name || profile?.full_name?.split(" ")[0] || undefined;
          const built = applicationStatusEmail(job.title, null, status, name);
          const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
          if (!sent.ok) console.error("[application email] send failed:", sent.error);
        }
      }
    } catch (e) {
      console.error("[application email] failed:", e);
    }
  }
}

// ------------------------------------------------------------- client CRM

const CRM_STATUSES: ClientCrmStatus[] = ["initial_call", "materials_sent", "job_active", "hired"];

/** Shared parse for the CRM contact fields (empty strings become null). */
function crmContactFields(formData: FormData) {
  return {
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? "").trim() || null,
  };
}

/**
 * Add a lead to the client CRM. The lead and the portal client are the same
 * portal_clients row — credentials (username/password) are assigned later, on
 * the clients screen, once the lead reaches "משרה בטיפול".
 */
export async function createCrmLead(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");

  const company_name = String(formData.get("company_name") ?? "").trim();
  if (!company_name) return { error: "שם החברה הוא שדה חובה." };

  const { error } = await createAdminClient()
    .from("portal_clients")
    .insert({ company_name, ...crmContactFields(formData), crm_status: "initial_call" });
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "לא הצלחנו להוסיף את הליד. נסי שוב." };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { ok: true };
}

/**
 * Create a client inline from the new-job flow and hand its id back so the
 * form can select it. Born as job_active — a client created while adding a
 * job is by definition one with a job in progress.
 */
export async function quickCreateClientForJob(
  company: string,
  contactName?: string,
  contactEmail?: string
): Promise<{ id?: string; company_name?: string; error?: string }> {
  await requireRole("admin");
  const company_name = company.trim();
  if (!company_name) return { error: "שם החברה הוא שדה חובה." };

  const { data, error } = await createAdminClient()
    .from("portal_clients")
    .insert({
      company_name,
      contact_name: contactName?.trim() || null,
      contact_email: contactEmail?.trim() || null,
      crm_status: "job_active",
    })
    .select("id, company_name")
    .single();
  if (error || !data) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "לא הצלחנו ליצור את הלקוח. נסי שוב." };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { id: data.id, company_name: data.company_name };
}

/** Update a CRM client's contact details, pipeline status and internal notes. */
export async function updateCrmClient(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");

  const statusRaw = String(formData.get("crm_status") ?? "");
  if (!CRM_STATUSES.includes(statusRaw as ClientCrmStatus)) {
    return { error: "סטטוס לא תקין." };
  }

  const { error } = await createAdminClient()
    .from("portal_clients")
    .update({
      ...crmContactFields(formData),
      crm_status: statusRaw as ClientCrmStatus,
      crm_notes: String(formData.get("crm_notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "השמירה נכשלה. נסי שוב." };
  }

  // The clients screen shows only "משרה בטיפול" — a status change moves rows
  // between the two screens, so both must refresh.
  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { ok: true };
}

/** Soft-cancel a session: shows "בוטל" and auto-hides from members after 24h. */
export async function cancelSession(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").update({ canceled_at: new Date().toISOString() }).eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
}

/** Delete a session immediately (e.g. added by mistake). */
export async function deleteSession(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/content");
  revalidatePath("/events");
}

/** Mark a session as finished. */
export async function markSessionDone(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").update({ status: "done" }).eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
}

/** Schedule a new community session. */
export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  if (!title || !scheduledAt) return { error: "כותרת ומועד הם שדות חובה." };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    title,
    topic: String(formData.get("topic") ?? "") || null,
    scheduled_at: new Date(scheduledAt).toISOString(),
    zoom_url: String(formData.get("zoom_url") ?? "") || null,
    syllabus_url: String(formData.get("syllabus_url") ?? "").trim() || null,
    materials_url: String(formData.get("materials_url") ?? "").trim() || null,
    duration_minutes: (() => {
      const n = Number(formData.get("duration_minutes"));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    })(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
  return { ok: true };
}

// ------------------------------------------------------- mentor applications

/**
 * Approve a self-served mentor application: pending+mentor → active, and the
 * promised email goes out. The free tier means no subscription row is ever
 * created — nothing here will expire.
 */
export async function approveMentorApplication(profileId: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("id, role, status, first_name, full_name")
    .eq("id", profileId)
    .maybeSingle();
  if (!p || p.role !== "mentor" || p.status !== "pending") return;

  await admin.from("profiles").update({ status: "active", member_tier: "free" }).eq("id", profileId);

  try {
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    const email = authUser?.user?.email;
    if (email) {
      const mail = mentorApprovedEmail(p.first_name ?? p.full_name?.split(" ")[0] ?? undefined);
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  } catch (e) {
    console.error("[mentors] approval email failed:", profileId, e);
  }

  revalidatePath("/admin/mentors");
  revalidatePath("/admin");
}

/**
 * Junk-account block (the owner, 1/9): a spam/garbage signup is locked all
 * the way — login banned, community access revoked (rejected) and hidden
 * from every member-facing list. Reversible from the same button.
 */
export async function setMemberJunk(profileId: string, junk: boolean): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update(junk ? { status: "rejected", is_hidden: true } : { status: "pending", is_hidden: false })
    .eq("id", profileId);
  try {
    // 100 years is Supabase's idiom for a permanent ban; "none" lifts it.
    await admin.auth.admin.updateUserById(profileId, { ban_duration: junk ? "876000h" : "none" });
  } catch (e) {
    console.error("[members] junk ban update failed:", profileId, e);
  }
  revalidatePath(`/admin/members/${profileId}`);
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

/**
 * A personal email from the team to one member, from her file page (the
 * owner, 1/9: "תן לי אפשרות לכתוב הודעה גם לאלה שדחיתי כבר") — a branded
 * email carrying exactly the admin's words.
 */
export async function sendPersonalEmail(profileId: string, formData: FormData): Promise<void> {
  const me = await requireRole("admin");
  const note = String(formData.get("note") ?? "").trim().slice(0, 4000);
  if (!note) return;
  const admin = createAdminClient();

  // The note ALSO lands in her chat with the acting admin, and the email
  // invites her to answer there (the owner, 1/9: "להחזיר תשובה דרך הצ'אט").
  const [a_id, b_id] = [me.id, profileId].sort();
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("a_id", a_id)
    .eq("b_id", b_id)
    .maybeSingle();
  let convId = existing?.id;
  if (!convId) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ a_id, b_id })
      .select("id")
      .single();
    convId = created?.id;
  }
  if (convId) {
    await admin.from("messages").insert({ conversation_id: convId, sender_id: me.id, body: note });
    await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
  }

  const { data: p } = await admin
    .from("profiles")
    .select("first_name, full_name")
    .eq("id", profileId)
    .maybeSingle();
  const { data: authUser } = await admin.auth.admin.getUserById(profileId);
  const email = authUser?.user?.email;
  if (!email) return;
  const chatUrl = `${getSiteUrl()}/chat${convId ? `?c=${convId}` : ""}`;
  const mail = teamPersonalEmail(p?.first_name ?? p?.full_name?.split(" ")[0] ?? undefined, note, chatUrl);
  const sent = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (!sent.ok) console.error("[members] personal email failed:", profileId, sent.error);
  revalidatePath(`/admin/members/${profileId}`);
}

/**
 * Decline a mentor application (the owner, 1/9): the admin writes a PERSONAL
 * note that goes to her by email, and she stays in the community as a regular
 * (not-subscribed) member — role junior on the paid track, wizard reopened so
 * she fills the member questionnaire.
 */
export async function rejectMentorApplication(profileId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  if (!note) return; // the personal explanation is the point — never silent
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("id, role, status, first_name, full_name")
    .eq("id", profileId)
    .maybeSingle();
  if (!p || p.role !== "mentor" || p.status !== "pending") return;
  await admin
    .from("profiles")
    .update({
      role: "junior",
      member_tier: "paid",
      profile_completed: false,
      // The registry in ניהול מנטוריות lists past declines by this stamp.
      mentor_declined_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  try {
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    const email = authUser?.user?.email;
    if (email) {
      const mail = mentorDeclinedEmail(p.first_name ?? p.full_name?.split(" ")[0] ?? undefined, note);
      await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    }
  } catch (e) {
    console.error("[mentors] decline email failed:", profileId, e);
  }

  revalidatePath("/admin/mentors");
  revalidatePath("/admin");
}

// --------------------------------------------------------- member requests

/**
 * Answer a member's request from the floating widget: the reply lands in her
 * CHAT (from the acting admin), and the request is marked handled. No emails.
 */
export async function replyToMemberRequest(
  requestId: string,
  formData: FormData
): Promise<void> {
  const me = await requireRole("admin");
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 4000);
  // An explicit "handle without answering" — never an accidental empty send.
  const skipReply = formData.get("skip_reply") === "1";
  if (!reply && !skipReply) return;
  const handledByName = String(formData.get("handled_by_name") ?? "").trim().slice(0, 60) || null;
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("member_requests")
    .select("id, profile_id, subject, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.status !== "open") return;

  if (reply) {
    // Find-or-create the 1:1 with the member, then drop the reply in.
    const [a_id, b_id] = [me.id, req.profile_id].sort();
    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("a_id", a_id)
      .eq("b_id", b_id)
      .maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created } = await admin
        .from("conversations")
        .insert({ a_id, b_id })
        .select("id")
        .single();
      convId = created?.id;
    }
    if (convId) {
      await admin.from("messages").insert({
        conversation_id: convId,
        sender_id: me.id,
        body: `לגבי הבקשה שלך "${req.subject}": ${reply}`,
      });
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
      // The reply lands in chat directly (not through the chat action), so
      // the "someone wrote to you" nudge is sent here (30/8: "נוטיפיקציות
      // כשיש תשובה מהצוות"). The chat badge lights up on its own.
      try {
        const { data: ru } = await admin.auth.admin.getUserById(req.profile_id);
        const email = ru?.user?.email;
        if (email) {
          const { data: rp } = await admin
            .from("profiles")
            .select("first_name, full_name")
            .eq("id", req.profile_id)
            .maybeSingle();
          const built = teamRepliedEmail(req.subject, rp?.first_name || rp?.full_name?.split(" ")[0] || undefined);
          await sendResendEmail({ to: email, subject: built.subject, html: built.html });
        }
      } catch (e) {
        console.error("[requests] reply email failed:", requestId, e);
      }
    }
  }

  await admin
    .from("member_requests")
    .update({
      status: "handled",
      handled_at: new Date().toISOString(),
      handled_by: me.id,
      handled_by_name: handledByName,
      reply: reply || null,
    })
    .eq("id", requestId);
  revalidatePath("/admin/requests");
}

/**
 * The inbox's two preset lists — who is on the team, and the canned replies
 * for recurring questions. Both live in app_settings so every admin sees the
 * same lists.
 */
export async function saveInboxSettings(formData: FormData): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const names = String(formData.get("team_names") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const canned: { title: string; body: string }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("canned_replies") ?? "[]"));
    if (Array.isArray(parsed)) {
      for (const c of parsed.slice(0, 30)) {
        const title = String(c?.title ?? "").trim().slice(0, 80);
        const body = String(c?.body ?? "").trim().slice(0, 2000);
        if (title && body) canned.push({ title, body });
      }
    }
  } catch {
    // Malformed canned list — keep the names update, drop the bad list.
  }
  await admin
    .from("app_settings")
    .upsert({ key: "team_names", value: { names } as never }, { onConflict: "key" });
  await admin
    .from("app_settings")
    .upsert({ key: "canned_replies", value: { items: canned } as never }, { onConflict: "key" });
  revalidatePath("/admin/requests");
}
