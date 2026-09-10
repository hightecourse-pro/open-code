import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { deactivateSubscription } from "@/lib/payments/subscription";
import { sendResendEmail } from "@/lib/email/resend";
import { subscriptionEndedEmail, subscriptionEndingSoonEmail } from "@/lib/email/templates";
import { backToEligible, hebDateLine, isEmailDay, shiftDay, ymdIL } from "@/lib/il-calendar";
import { processShareQueue } from "@/lib/drive-shares";

/**
 * Daily maintenance (multiple jobs in one endpoint because the Hobby plan
 * allows only once-a-day crons). The subscription lifecycle (the owner, 10/9):
 *
 *   1. Two days BEFORE a non-renewing subscription ends — a reminder email.
 *      A send-day that lands on Shabbat/chag moves EARLIER; the copy carries
 *      the explicit end date, so moved wording stays true.
 *   2. The day AFTER the period ends — access is blocked ("הסתיים ב-14,
 *      ב-15 הכל חסום"). Blocking runs every day; it is automatic, not mail.
 *   3. The "המנוי הסתיים" email — on the first email-eligible day after the
 *      block (never on Shabbat/chag).
 *
 * Plus the Drive share queue and attachment hygiene.
 * Scheduled daily in vercel.json; also callable with ?secret=CRON_SECRET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The schedule ships in vercel.json, so a staging deployment gets it too.
  // Staging runs ONLY when an EMAIL_ALLOWLIST is set: every recipient is
  // gated by emailGate (real members' addresses stay unreachable), and this
  // run also drains the Drive share queue — skipping it left staging course
  // shares stuck on pending for days.
  if (!isProductionEnv() && !process.env.EMAIL_ALLOWLIST) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const now = new Date();
  const todayIL = ymdIL(now);
  const emailDay = isEmailDay(todayIL);

  // ---------------------------------------------------------------- expire
  // Blocked from the day AFTER the period's calendar day (Israel time): a
  // subscription whose end date was yesterday or earlier is deactivated now.
  const { data: endedRows, error } = await admin
    .from("subscriptions")
    .select("profile_id, current_period_end")
    // Every live state, not just 'active' — a stale 'trialing' or 'past_due'
    // row would otherwise keep access forever.
    .in("status", ["active", "trialing", "past_due"])
    .not("current_period_end", "is", null)
    .lt("current_period_end", now.toISOString())
    .order("current_period_end", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const toExpire = (endedRows ?? []).filter(
    (s) => ymdIL(new Date(s.current_period_end as string)) < todayIL
  );
  const ids = [...new Set(toExpire.map((s) => s.profile_id))];

  // -------------------------------------------- reminders (2 days ahead)
  // Only subscriptions that are actually ENDING get one: renewal turned off,
  // or already failing payment. An auto-renewing member's period just rolls.
  const { data: endingSoon } = await admin
    .from("subscriptions")
    .select("id, profile_id, current_period_end, status, cancel_at_period_end, ending_reminder_sent_at")
    .in("status", ["active", "trialing", "past_due"])
    .is("ending_reminder_sent_at", null)
    .not("current_period_end", "is", null)
    .gt("current_period_end", now.toISOString())
    .lt("current_period_end", new Date(now.getTime() + 8 * 24 * 3600 * 1000).toISOString())
    .or("cancel_at_period_end.eq.true,status.eq.past_due");
  const reminderDue = (endingSoon ?? []).filter((s) => {
    const endDay = ymdIL(new Date(s.current_period_end as string));
    // Ideal = two days before the end; Shabbat/chag moves it earlier.
    const sendDay = backToEligible(shiftDay(endDay, -2));
    return todayIL >= sendDay;
  });

  // ---------------------------- ended emails (first eligible day after)
  const { data: endedUnmailed } = await admin
    .from("subscriptions")
    .select("id, profile_id, canceled_at")
    .eq("status", "canceled")
    .is("ended_email_sent_at", null)
    .not("canceled_at", "is", null)
    .gt("canceled_at", new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString())
    .limit(50);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      todayIL,
      emailDay,
      expiring: ids.length,
      remindersDue: reminderDue.length,
      endedEmailsDue: (endedUnmailed ?? []).length,
    });
  }

  // Names and emails for everyone this run touches, in two set-based calls.
  const everyone = [
    ...new Set([
      ...ids,
      ...reminderDue.map((s) => s.profile_id),
      ...(endedUnmailed ?? []).map((s) => s.profile_id),
    ]),
  ];
  const [{ data: whoRows }, { data: emailRows }] = everyone.length
    ? await Promise.all([
        admin.from("profiles").select("id, full_name, first_name").in("id", everyone),
        admin.rpc("member_emails", { p_ids: everyone }),
      ])
    : [{ data: [] }, { data: [] }];
  const whoOf = new Map((whoRows ?? []).map((p) => [p.id, p]));
  const emailOf = new Map(
    ((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email])
  );

  // 1. reminders — email-eligible days only
  let remindersSent = 0;
  if (emailDay) {
    for (const s of reminderDue) {
      try {
        const email = emailOf.get(s.profile_id);
        if (!email) continue;
        const endDay = ymdIL(new Date(s.current_period_end as string));
        const mail = subscriptionEndingSoonEmail(
          whoOf.get(s.profile_id)?.first_name ?? undefined,
          hebDateLine(endDay)
        );
        const sent = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
        if (sent.ok) {
          await admin
            .from("subscriptions")
            .update({ ending_reminder_sent_at: now.toISOString() })
            .eq("id", s.id);
          remindersSent++;
        }
      } catch (e) {
        console.error("[subscriptions] reminder failed:", s.profile_id, e);
      }
    }
  }

  // 2. expire — every day, Shabbat included (an automatic gate, not mail)
  let expiredCount = 0;
  for (const profileId of ids) {
    try {
      await deactivateSubscription(profileId);
      expiredCount++;
      // A subscription that reached expiry with no renewal recorded is
      // exactly the case the owner asked to SEE: either she truly stopped
      // paying, or a renewal callback never arrived while the card kept being
      // charged. Both deserve a row in the alerts center, per member.
      const who = whoOf.get(profileId);
      await raiseAlert({
        kind: "subscription_expired",
        severity: "warning",
        title: `המנוי של ${who?.full_name ?? profileId} פג בלי חידוש — הועברה להשהיה`,
        body: "לא נרשם תשלום מחדש. אם היא כן חויבה בכרטיס — זה חידוש שלא דווח, וצריך לרשום אותו ידנית בדף שלה.",
        context: { profileId },
        dedupeKey: `sub-expired:${profileId}`,
      });
    } catch (e) {
      console.error("[subscriptions] expire failed:", profileId, e);
    }
  }

  // 3. ended emails — the first eligible day on/after the block
  let endedEmailsSent = 0;
  if (emailDay) {
    for (const s of endedUnmailed ?? []) {
      try {
        const email = emailOf.get(s.profile_id);
        if (!email) continue;
        const mail = subscriptionEndedEmail(whoOf.get(s.profile_id)?.first_name ?? undefined);
        const sent = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
        if (sent.ok) {
          await admin
            .from("subscriptions")
            .update({ ended_email_sent_at: now.toISOString() })
            .eq("id", s.id);
          endedEmailsSent++;
        }
      } catch (e) {
        console.error("[subscriptions] ended email failed:", s.profile_id, e);
      }
    }
    // Freshly expired this run: their notice goes out right now too (today is
    // eligible — otherwise the next eligible run picks them up above).
    for (const profileId of ids) {
      try {
        const email = emailOf.get(profileId);
        if (!email) continue;
        const { data: row } = await admin
          .from("subscriptions")
          .select("id")
          .eq("profile_id", profileId)
          .eq("status", "canceled")
          .is("ended_email_sent_at", null)
          .order("canceled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!row) continue;
        const mail = subscriptionEndedEmail(whoOf.get(profileId)?.first_name ?? undefined);
        const sent = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
        if (sent.ok) {
          await admin
            .from("subscriptions")
            .update({ ended_email_sent_at: now.toISOString() })
            .eq("id", row.id);
          endedEmailsSent++;
        }
      } catch (e) {
        console.error("[subscriptions] ended email (fresh) failed:", profileId, e);
      }
    }
  }

  // …then action the Drive share queue (grants + revocations).
  let drive;
  try {
    drive = await processShareQueue(60);
  } catch (e) {
    console.error("[subscriptions] drive sync failed:", e);
  }

  // Attachment hygiene: files uploaded while composing but never sent stay
  // UNLINKED (context_id null). A day is ample grace for a draft; after that
  // the file and its row go. Bounded per run like everything else here.
  let attachmentsSwept = 0;
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: orphans } = await admin
      .from("attachments")
      .select("id, file_path")
      .is("context_id", null)
      .lt("created_at", dayAgo)
      .limit(100);
    if (orphans?.length) {
      await admin.storage.from("attachments").remove(orphans.map((o) => o.file_path));
      await admin.from("attachments").delete().in("id", orphans.map((o) => o.id));
      attachmentsSwept = orphans.length;
    }
  } catch (e) {
    console.error("[subscriptions] attachment sweep failed:", e);
  }

  // Bounded per run; the rest are picked up by tomorrow's run.
  return NextResponse.json({
    ok: true,
    todayIL,
    emailDay,
    expired: expiredCount,
    remindersSent,
    endedEmailsSent,
    drive,
    attachmentsSwept,
  });
}
