"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { sendResendEmail } from "@/lib/email/resend";
import { subscriptionCanceledEmail } from "@/lib/email/templates";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * She turns auto-renewal off. The membership stays fully active until
 * current_period_end — the nightly cron pauses it there, like any other
 * expiry, and mails her the ending notice.
 *
 * The app cannot cancel the Nedarim standing order itself (no API handle on
 * HK orders), so this ALSO raises a critical alert for the owner: until the
 * order is canceled in the Nedarim console, the card keeps being charged.
 * That gap must live in the alerts center, never in silence.
 */
export async function cancelRenewal(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, status, current_period_end, canceled_at")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!sub || sub.status !== "active") return { error: "לא מצאנו מנוי פעיל לביטול." };
  if (sub.canceled_at) return {};

  const { error } = await admin
    .from("subscriptions")
    .update({ canceled_at: new Date().toISOString() })
    .eq("id", sub.id);
  if (error) return { error: "משהו השתבש — נסי שוב עוד רגע." };

  const until = sub.current_period_end ? DATE_HE.format(new Date(sub.current_period_end)) : "סוף התקופה ששולמה";

  const { data: who } = await admin.from("profiles").select("full_name, first_name").eq("id", user.id).maybeSingle();
  await raiseAlert({
    kind: "subscription_cancel_requested",
    severity: "critical",
    title: `${who?.full_name ?? "חברה"} ביטלה את חידוש המנוי — צריך לבטל את הוראת הקבע בנדרים`,
    body: `המנוי שלה פעיל עד ${until} ואז יושהה אוטומטית. שימי לב: את הוראת הקבע בנדרים המערכת לא יכולה לבטל — אם לא תבוטל שם ידנית, הכרטיס שלה ימשיך להיות מחויב.`,
    context: { profileId: user.id, currentPeriodEnd: sub.current_period_end },
    dedupeKey: `sub-cancel:${user.id}`,
  });

  if (user.email) {
    const mail = subscriptionCanceledEmail(who?.first_name ?? undefined, until);
    await sendResendEmail({ to: user.email, subject: mail.subject, html: mail.html });
  }

  revalidatePath("/profile");
  return {};
}

/** She changed her mind while still active — auto-renewal back on. */
export async function resumeRenewal(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, status, canceled_at")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!sub || sub.status !== "active" || !sub.canceled_at) return {};

  await admin.from("subscriptions").update({ canceled_at: null }).eq("id", sub.id);

  const { data: who } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  await raiseAlert({
    kind: "subscription_cancel_reverted",
    severity: "warning",
    title: `${who?.full_name ?? "חברה"} הפעילה מחדש את חידוש המנוי`,
    body: "אם הוראת הקבע שלה בנדרים כבר בוטלה בינתיים — צריך לתאם איתה הקמה מחדש, אחרת החידוש הבא לא ייגבה.",
    context: { profileId: user.id },
    dedupeKey: `sub-cancel-revert:${user.id}`,
  });

  revalidatePath("/profile");
  return {};
}
