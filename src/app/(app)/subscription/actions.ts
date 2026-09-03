"use server";

import { revalidatePath } from "next/cache";
import { kevaIdsFor } from "@/lib/payments/subscription";
import { nedarimKevaAction } from "@/lib/payments/nedarim";
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
 * Since 3/9 Nedarim exposes a keva API — the cancel FREEZES her standing
 * order automatically (DisableKeva) and resume reactivates it. If the call
 * fails, the old critical manual-handling alert fires instead — the gap
 * lives in the alerts center, never in silence.
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

  // Nedarim gave us a keva API (3/9) — freeze her standing order right here,
  // so a canceled membership stops charging without anyone remembering to.
  // Freeze (not delete): she may resume until the period ends. Any failure
  // falls back to the old manual-handling alert, never to silence.
  let kevaLine = "לא מצאנו אצלנו מזהה הוראת קבע — יש לבדוק ולבטל ידנית בנדרים.";
  let kevaOk = false;
  const kevaIds = await kevaIdsFor(user.id);
  if (kevaIds[0]) {
    const r = await nedarimKevaAction("DisableKeva", kevaIds[0]);
    kevaOk = r.ok;
    kevaLine = r.ok
      ? `הוראת הקבע ${kevaIds[0]} הוקפאה אוטומטית בנדרים ✓ (תשובתם: ${r.detail.slice(0, 120)})`
      : `ניסינו להקפיא את הוראת הקבע ${kevaIds[0]} אוטומטית — נכשל (${r.detail.slice(0, 160)}). יש לבטל ידנית בנדרים!`;
  }

  const { data: who } = await admin.from("profiles").select("full_name, first_name").eq("id", user.id).maybeSingle();
  await raiseAlert({
    kind: "subscription_cancel_requested",
    severity: kevaOk ? "warning" : "critical",
    title: `${who?.full_name ?? "חברה"} ביטלה את חידוש המנוי${kevaOk ? "" : " — צריך לבטל את הוראת הקבע בנדרים"}`,
    body: `המנוי שלה פעיל עד ${until} ואז יושהה אוטומטית. ${kevaLine}`,
    context: { profileId: user.id, currentPeriodEnd: sub.current_period_end, kevaIds },
    dedupeKey: `sub-cancel:${user.id}`,
  });

  if (user.email) {
    const mail = subscriptionCanceledEmail(who?.first_name ?? undefined, until);
    await sendResendEmail({ to: user.email, subject: mail.subject, html: mail.html });
  }

  // The subscription lives on ITS page — refreshing /profile alone left the
  // screen frozen ("חידוש מנוי בלחיצה לא עובד", a member, 1/9).
  revalidatePath("/subscription");
  revalidatePath("/subscription");
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

  // Mirror of the cancel: the keva we froze comes back to life.
  let kevaLine = "לא מצאנו מזהה הוראת קבע — יש לוודא ידנית שהיא פעילה בנדרים.";
  let kevaOk = false;
  const kevaIds = await kevaIdsFor(user.id);
  if (kevaIds[0]) {
    const r = await nedarimKevaAction("EnableKevaNew", kevaIds[0]);
    kevaOk = r.ok;
    kevaLine = r.ok
      ? `הוראת הקבע ${kevaIds[0]} הופעלה מחדש אוטומטית בנדרים ✓`
      : `הפעלת הוראת הקבע ${kevaIds[0]} מחדש נכשלה (${r.detail.slice(0, 160)}) — יש להפעיל ידנית בנדרים, אחרת החידוש הבא לא ייגבה!`;
  }

  const { data: who } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  await raiseAlert({
    kind: "subscription_cancel_reverted",
    severity: kevaOk ? "info" : "critical",
    title: `${who?.full_name ?? "חברה"} הפעילה מחדש את חידוש המנוי`,
    body: kevaLine,
    context: { profileId: user.id, kevaIds },
    dedupeKey: `sub-cancel-revert:${user.id}`,
  });

  revalidatePath("/profile");
  return {};
}
