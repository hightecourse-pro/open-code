"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { mentorRequestEmail } from "@/lib/email/templates";
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
