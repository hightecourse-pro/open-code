import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appEnv, isProductionEnv } from "@/lib/env";
import { isEmailDay, ymdIL } from "@/lib/il-calendar";
import { sendResendEmail } from "@/lib/email/resend";
import { questionnaireReminderEmail } from "@/lib/email/templates";

/**
 * Questionnaire reminders (the owner, 18/9: "יש לנו הרבה שלא סיימו את
 * השאלון — אם עבר שבועיים מאז שנכנסו, לשלוח להן מייל ידידותי").
 *
 * Who: junior / mentor accounts that joined at least 14 days ago and still
 * have profile_completed = false (pending or active — a paying member who
 * never finished counts too). Never the team, never paused/rejected.
 * When: not on Shabbat / chag (isEmailDay), at most one reminder per 14 days
 * and at most MAX_REMINDERS in total per member — a nudge, not nagging.
 * Every send is written to profile_reminders so the members table shows it.
 *
 * Scheduled daily in vercel.json; also callable with ?secret=CRON_SECRET
 * (+ &dry=1 to list without sending).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DAYS_SINCE_JOIN = 14;
const DAYS_BETWEEN = 14;
const MAX_REMINDERS = 2;
const BATCH = 40;

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
  // Staging runs only with an EMAIL_ALLOWLIST — emailGate blocks everyone
  // else, so the only inboxes reachable are the team's own.
  if (!isProductionEnv() && !process.env.EMAIL_ALLOWLIST) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const now = new Date();
  if (!isEmailDay(ymdIL(now))) {
    return NextResponse.json({ skipped: "not_email_day", day: ymdIL(now) });
  }

  const admin = createAdminClient();
  const joinedBefore = new Date(now.getTime() - DAYS_SINCE_JOIN * 24 * 3600 * 1000).toISOString();
  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, full_name, role, status, created_at")
    .eq("profile_completed", false)
    .in("role", ["junior", "mentor"])
    .in("status", ["pending", "active"])
    .lte("created_at", joinedBefore)
    .order("created_at", { ascending: true })
    .limit(400);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (candidates ?? []).map((c) => c.id);
  if (ids.length === 0) return NextResponse.json({ candidates: 0, sent: 0 });

  const { data: past } = await admin
    .from("profile_reminders")
    .select("profile_id, sent_at")
    .in("profile_id", ids)
    .eq("kind", "questionnaire");
  const history = new Map<string, string[]>();
  for (const r of past ?? []) history.set(r.profile_id, [...(history.get(r.profile_id) ?? []), r.sent_at]);

  const cutoff = now.getTime() - DAYS_BETWEEN * 24 * 3600 * 1000;
  const due = (candidates ?? []).filter((c) => {
    const h = history.get(c.id) ?? [];
    if (h.length >= MAX_REMINDERS) return false;
    return h.every((iso) => new Date(iso).getTime() < cutoff);
  }).slice(0, BATCH);

  const { data: emailRows } = due.length
    ? await admin.rpc("member_emails", { p_ids: due.map((d) => d.id) })
    : { data: [] as { id: string; email: string | null }[] };
  const emailOf = new Map(
    ((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email ?? ""])
  );

  let sent = 0;
  let blocked = 0;
  const results: { id: string; name: string; role: string; result: string }[] = [];
  for (const c of due) {
    const to = emailOf.get(c.id) ?? "";
    if (!to) {
      results.push({ id: c.id, name: c.full_name, role: c.role, result: "no_email" });
      continue;
    }
    if (dryRun) {
      results.push({ id: c.id, name: c.full_name, role: c.role, result: "would_send" });
      continue;
    }
    const mail = questionnaireReminderEmail(c.full_name, c.role === "mentor" ? "mentor" : "junior");
    const r = await sendResendEmail({ to, subject: mail.subject, html: mail.html });
    if (r.ok) {
      sent++;
      await admin.from("profile_reminders").insert({ profile_id: c.id, kind: "questionnaire" });
      results.push({ id: c.id, name: c.full_name, role: c.role, result: "sent" });
    } else {
      // A blocked address (staging allowlist) is not a failure worth retrying
      // tomorrow with a different outcome — but it is not recorded as sent.
      if (r.error === "blocked_by_allowlist") blocked++;
      results.push({ id: c.id, name: c.full_name, role: c.role, result: r.error ?? "failed" });
    }
  }

  return NextResponse.json({
    env: appEnv(),
    dryRun,
    candidates: ids.length,
    due: due.length,
    sent,
    blocked,
    results,
  });
}
