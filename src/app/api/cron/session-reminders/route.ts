import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { sessionReminderEmail } from "@/lib/email/templates";

/**
 * Session reminder emails, on the owner's schedule: the morning of the session
 * at 10:00 Israel time, half an hour before, and at the start. Ticked every
 * ten minutes by pg_cron (Vercel's Hobby crons are daily-only), so each stage
 * fires on the first tick inside its window.
 *
 * Recipients are the women entitled to join: paying members, mentors and the
 * team — or every active member when the session is open to all. Outside
 * production the EMAIL_ALLOWLIST gate inside sendResendEmail keeps every real
 * address safe, so this endpoint deliberately does NOT no-op on staging: an
 * allowlisted test inbox is how the flow gets verified end to end.
 *
 * A (session, stage) pair is CLAIMED in session_reminders before anything is
 * sent — two overlapping ticks can never double-mail.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Stage = "morning" | "t30" | "start";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

/** Israel-local calendar date (YYYY-MM-DD) and hour for a moment in time. */
function israelParts(d: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

const TIME_IL = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** Which stages are due for a session right now. */
function dueStages(now: Date, scheduledAt: Date): Stage[] {
  const due: Stage[] = [];
  const msUntil = scheduledAt.getTime() - now.getTime();
  const nowIL = israelParts(now);
  const sessionIL = israelParts(scheduledAt);
  // Morning-of: from 10:00 Israel time until the session starts.
  if (nowIL.date === sessionIL.date && nowIL.hour >= 10 && msUntil > 0) due.push("morning");
  // Half an hour before: inside the final 30 minutes.
  if (msUntil > 0 && msUntil <= 30 * 60 * 1000) due.push("t30");
  // Starting now: the first 15 minutes after the hour.
  if (msUntil <= 0 && msUntil > -15 * 60 * 1000) due.push("start");
  return due;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // Everything from "just started" to "later today" — dueStages narrows it.
  const { data: sessions, error } = await admin
    .from("sessions")
    .select("id, title, scheduled_at, zoom_url, open_to_all, status, canceled_at, is_published")
    .eq("is_published", true)
    .is("canceled_at", null)
    .gte("scheduled_at", new Date(now.getTime() - 20 * 60 * 1000).toISOString())
    .lte("scheduled_at", new Date(now.getTime() + 24 * 3600 * 1000).toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const work: { session: NonNullable<typeof sessions>[number]; stage: Stage }[] = [];
  for (const s of sessions ?? []) {
    if (s.status === "done") continue;
    for (const stage of dueStages(now, new Date(s.scheduled_at))) {
      work.push({ session: s, stage });
    }
  }
  if (work.length === 0) return NextResponse.json({ ok: true, sent: [] });

  // Recipient pool, loaded once: entitled to sessions = the mayOpenSessions
  // rule; open-to-all sessions widen to every active member.
  const [{ data: profiles }, usersList] = await Promise.all([
    admin.from("profiles").select("id, first_name, full_name, status, member_tier, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailOf = new Map((usersList.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const active = (profiles ?? []).filter((p) => p.status === "active");
  const entitled = active.filter(
    (p) => p.member_tier === "paid" || p.role === "mentor" || p.role === "admin"
  );

  const sent: { session: string; stage: Stage; recipients: number }[] = [];
  for (const { session, stage } of work) {
    // Claim first — a second tick landing here finds the row and moves on.
    const { error: claimErr } = await admin
      .from("session_reminders")
      .insert({ session_id: session.id, stage });
    if (claimErr) continue; // already claimed (unique) — or table missing

    const pool = session.open_to_all ? active : entitled;
    const time = TIME_IL.format(new Date(session.scheduled_at));
    let count = 0;
    for (const p of pool) {
      const email = emailOf.get(p.id);
      if (!email) continue;
      const mail = sessionReminderEmail(stage, session.title, time, session.zoom_url ?? null);
      const res = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
      if (res.ok) count++;
    }
    await admin
      .from("session_reminders")
      .update({ recipients: count })
      .eq("session_id", session.id)
      .eq("stage", stage);
    sent.push({ session: session.id, stage, recipients: count });
  }

  return NextResponse.json({ ok: true, sent });
}
