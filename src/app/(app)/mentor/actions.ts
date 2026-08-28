"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { getProfile, isSubscriber } from "@/lib/auth";
import { sendResendEmail } from "@/lib/email/resend";
import { assignedMentorEmail, mentorRequestEmail } from "@/lib/email/templates";
import { MENTOR_REQUEST_REASONS, mentorReasonLabel } from "@/lib/mentor-requests";

export type MentorRequestState = { ok?: boolean; error?: string };

/**
 * A member asks to be matched with a mentor. Stores the request for the admin
 * queue and emails the team (best-effort — a failed email never loses the
 * request).
 */
export async function requestMentor(
  _prev: MentorRequestState,
  formData: FormData
): Promise<MentorRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "תצטרכי להתחבר מחדש." };

  // Mentoring is part of the paid membership.
  const me = await getProfile();
  if (!me || !isSubscriber(me)) {
    return { error: "ליווי אישי של מנטורית נפתח עם מנוי לקהילה 💜" };
  }

  const reason = String(formData.get("reason") ?? "");
  if (!MENTOR_REQUEST_REASONS.some((r) => r.value === reason)) {
    return { error: "בחרי במה נוכל לעזור לך 🙂" };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);

  // One open request at a time — a second ask would just duplicate the queue.
  const { data: existing } = await supabase
    .from("mentor_requests")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    return { error: "כבר יש לך בקשה פתוחה — אנחנו עליה 💜" };
  }

  const { error } = await supabase
    .from("mentor_requests")
    .insert({ profile_id: user.id, reason, note: note || null });
  if (error) {
    return { error: "לא הצלחנו לשלוח את הבקשה כרגע. בואי ננסה שוב." };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const admin = createAdminClient();
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    const built = mentorRequestEmail(
      profile?.full_name || "חברת קהילה",
      mentorReasonLabel(reason),
      note
    );
    for (const a of admins ?? []) {
      const { data: authUser } = await admin.auth.admin.getUserById(a.id);
      const email = authUser?.user?.email;
      if (!email) continue;
      const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sent.ok) console.error("[mentor request email] send failed:", sent.error);
    }
  } catch (e) {
    console.error("[mentor request email] failed:", e);
  }

  revalidatePath("/mentor");
  revalidatePath("/admin/mentor-requests");
  return { ok: true };
}

/**
 * The MENTOR accepts an assignment made to her. Only now the member sees her
 * (and gets the "צוותה לך מנטורית" email) — the owner's flow: assignment
 * starts as an invitation, never as a fact.
 */
export async function acceptMentorAssignment(requestId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("mentor_requests")
    .select("id, profile_id, assigned_mentor_id, mentor_accepted_at")
    .eq("id", requestId)
    .maybeSingle();
  // Only HER assignment, and only once.
  if (!req || req.assigned_mentor_id !== user.id || req.mentor_accepted_at) return;

  await admin
    .from("mentor_requests")
    .update({ mentor_accepted_at: new Date().toISOString() })
    .eq("id", requestId);

  // Now — and only now — the member hears who accompanies her.
  try {
    const [{ data: member }, { data: mentor }, { data: memberAuth }] = await Promise.all([
      admin.from("profiles").select("first_name, full_name").eq("id", req.profile_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      admin.auth.admin.getUserById(req.profile_id),
    ]);
    const email = memberAuth?.user?.email;
    if (email) {
      const built = assignedMentorEmail(
        member?.first_name || member?.full_name || undefined,
        mentor?.full_name || "מנטורית מהקהילה"
      );
      const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sent.ok) console.error("[mentor accept email] send failed:", sent.error);
    }
  } catch (e) {
    console.error("[mentor accept email] failed:", e);
  }

  await raiseAlert({
    kind: "mentor_assignment_accepted",
    severity: "info",
    title: "מנטורית אישרה שיבוץ 👑",
    body: "השיבוץ אושר — המנטית רואה אותה מעכשיו וקיבלה מייל.",
    context: { requestId, mentorId: user.id },
    dedupeKey: `mentor-accept:${requestId}`,
  });

  revalidatePath("/mentor");
  revalidatePath("/profile");
  revalidatePath("/admin/mentor-requests");
}

/**
 * The mentor passes on an assignment: it goes back to the open queue with no
 * mentor, and the admin is alerted to pick someone else. The member never
 * saw the assignment, so nothing breaks for her.
 */
export async function declineMentorAssignment(requestId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("mentor_requests")
    .select("id, assigned_mentor_id, mentor_accepted_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.assigned_mentor_id !== user.id || req.mentor_accepted_at) return;

  const { data: mentor } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  await admin
    .from("mentor_requests")
    .update({
      assigned_mentor_id: null,
      status: "open",
      handled_at: null,
      // Visible on the admin requests screen — a decline is no longer silent.
      reopen_reason: `המנטורית ${mentor?.full_name ?? ""} סירבה לליווי`.trim(),
      reopened_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  await raiseAlert({
    kind: "mentor_assignment_declined",
    severity: "warning",
    title: `${mentor?.full_name ?? "מנטורית"} ויתרה על שיבוץ — צריך לשבץ מישהי אחרת`,
    body: "הבקשה חזרה לתור הפתוח במסך בקשות למנטורית.",
    context: { requestId, mentorId: user.id },
    dedupeKey: `mentor-decline:${requestId}:${Date.now()}`,
  });

  revalidatePath("/mentor");
  revalidatePath("/admin/mentor-requests");
}
