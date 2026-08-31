import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { jobPublishedEmail, newMessageEmail, sessionReminderEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";

/**
 * The 10-minute notifications tick (pg_cron): session reminders and queued
 * job-published emails.
 *
 * Scale model (2026-08-29): a due (session, stage) no longer mails its whole
 * pool inside one invocation — at thousands of members that blows the
 * serverless time limit mid-loop with the stage already claimed, silently
 * skipping most of the community. Instead the claim ENQUEUES one row per
 * recipient (a single insert..select), and every tick drains a bounded batch
 * from the queue. Two overlapping ticks can't double-mail: the claim is
 * unique, and each queue row is stamped before the next is sent.
 *
 * Recipients are the women entitled to join: paying members, mentors and the
 * team — or every active member when the session is open to all. Outside
 * production the EMAIL_ALLOWLIST gate inside sendResendEmail keeps every real
 * address safe.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Bounded work per tick — ~35-45s of sequential sends at the worst.
const REMINDER_BATCH = 90;
const JOB_EMAIL_BATCH = 60;

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

type AdminClient = ReturnType<typeof createAdminClient>;

/** One email-per-id map via the set-based SQL function (no per-member calls). */
async function emailsFor(admin: AdminClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.rpc("member_emails", { p_ids: ids });
  return new Map(
    ((data ?? []) as { id: string; email: string | null }[])
      .filter((r): r is { id: string; email: string } => !!r.email)
      .map((r) => [r.id, r.email])
  );
}

/** Claim newly due (session, stage) pairs and enqueue their recipients. */
async function enqueueDueReminders(admin: AdminClient, now: Date) {
  const { data: sessions, error } = await admin
    .from("sessions")
    .select("id, title, scheduled_at, zoom_url, open_to_all, status, canceled_at, is_published")
    .eq("is_published", true)
    .is("canceled_at", null)
    .gte("scheduled_at", new Date(now.getTime() - 20 * 60 * 1000).toISOString())
    .lte("scheduled_at", new Date(now.getTime() + 24 * 3600 * 1000).toISOString());
  if (error) return { enqueued: 0, error: error.message };

  const work: { session: NonNullable<typeof sessions>[number]; stage: Stage }[] = [];
  for (const s of sessions ?? []) {
    if (s.status === "done") continue;
    for (const stage of dueStages(now, new Date(s.scheduled_at))) {
      work.push({ session: s, stage });
    }
  }
  if (work.length === 0) return { enqueued: 0 };

  let enqueued = 0;
  for (const { session, stage } of work) {
    // Claim first — a second tick landing here finds the row and moves on.
    const { error: claimErr } = await admin
      .from("session_reminders")
      .insert({ session_id: session.id, stage });
    if (claimErr) continue; // already claimed (unique) — or table missing

    // One set-based insert enqueues the whole pool: paid + mentors + team, or
    // every active member when the session is open to all.
    const pool = admin
      .from("profiles")
      .select("id")
      .eq("status", "active");
    const { data: poolRows } = session.open_to_all
      ? await pool
      : await pool.or("member_tier.eq.paid,role.eq.mentor,role.eq.admin");
    const rows = (poolRows ?? []).map((p) => ({
      session_id: session.id,
      stage,
      profile_id: p.id,
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      await admin
        .from("session_reminder_queue")
        .upsert(rows.slice(i, i + 1000), { onConflict: "session_id,stage,profile_id", ignoreDuplicates: true });
    }
    enqueued += rows.length;
  }
  return { enqueued };
}

/** Drain a bounded batch of unsent reminder rows. */
async function drainReminderQueue(admin: AdminClient) {
  const { data: batch } = await admin
    .from("session_reminder_queue")
    .select("session_id, stage, profile_id")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(REMINDER_BATCH);
  if (!batch?.length) return { sent: 0, remaining: 0 };

  const sessionIds = [...new Set(batch.map((b) => b.session_id))];
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, title, scheduled_at, zoom_url, status, canceled_at")
    .in("id", sessionIds);
  const sessionOf = new Map((sessions ?? []).map((s) => [s.id, s]));
  const emailOf = await emailsFor(admin, [...new Set(batch.map((b) => b.profile_id))]);

  let sent = 0;
  for (const row of batch) {
    const session = sessionOf.get(row.session_id);
    // A canceled/finished session voids its queued reminders.
    const voided = !session || session.status === "done" || session.canceled_at;
    const email = voided ? null : emailOf.get(row.profile_id);
    if (email && session) {
      const time = TIME_IL.format(new Date(session.scheduled_at));
      const mail = sessionReminderEmail(row.stage as Stage, session.title, time, session.zoom_url ?? null);
      const res = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
      if (res.ok) sent++;
    }
    // Stamp regardless (missing email / voided session = processed) so the
    // queue always drains and never wedges on one bad row.
    await admin
      .from("session_reminder_queue")
      .update({ sent_at: new Date().toISOString() })
      .eq("session_id", row.session_id)
      .eq("stage", row.stage)
      .eq("profile_id", row.profile_id);
  }

  const { count: remaining } = await admin
    .from("session_reminder_queue")
    .select("*", { count: "exact", head: true })
    .is("sent_at", null);
  return { sent, remaining: remaining ?? 0 };
}

/** Drain queued job-published emails (publishJob mails ~25 inline, rest here). */
async function drainJobEmails(admin: AdminClient) {
  const { data: targets } = await admin
    .from("job_targets")
    .select("job_id, profile_id")
    .is("emailed_at", null)
    .order("created_at", { ascending: true })
    .limit(JOB_EMAIL_BATCH);
  if (!targets?.length) return { sent: 0, remaining: 0 };

  const jobIds = [...new Set(targets.map((t) => t.job_id))];
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, description, description_html, status, pipeline_status")
    .in("id", jobIds);
  const jobOf = new Map((jobs ?? []).map((j) => [j.id, j]));
  const profileIds = [...new Set(targets.map((t) => t.profile_id))];
  const [{ data: named }, emailOf] = await Promise.all([
    admin.from("profiles").select("id, first_name, full_name").in("id", profileIds),
    emailsFor(admin, profileIds),
  ]);
  const nameOf = new Map((named ?? []).map((p) => [p.id, p]));
  const applyUrl = `${getSiteUrl()}/jobs`;
  const excerptOf = new Map(
    (jobs ?? []).map((j) => {
      const text = (j.description_html ? j.description_html.replace(/<[^>]*>/g, " ") : j.description)
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      return [j.id, text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text];
    })
  );

  let sent = 0;
  for (const t of targets) {
    const job = jobOf.get(t.job_id);
    // Only live, published jobs still announce; a withdrawn one just drains —
    // and so does a job already sent to the client / in interviews / hired
    // (the owner, 2026-08-30: no submission nudges once the job moved on).
    const live = job && job.status === "open" && job.pipeline_status === "published";
    const email = live ? emailOf.get(t.profile_id) : null;
    if (email && job) {
      const p = nameOf.get(t.profile_id);
      const name = p?.first_name || p?.full_name?.split(" ")[0] || undefined;
      const built = jobPublishedEmail(name, job.title, excerptOf.get(job.id) ?? "", applyUrl);
      const res = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (res.ok) sent++;
    }
    await admin
      .from("job_targets")
      .update({ emailed_at: new Date().toISOString() })
      .eq("job_id", t.job_id)
      .eq("profile_id", t.profile_id);
  }

  const { count: remaining } = await admin
    .from("job_targets")
    .select("*", { count: "exact", head: true })
    .is("emailed_at", null);
  return { sent, remaining: remaining ?? 0 };
}

/**
 * Chat email grace (the owner, 1/9): "מישהי כתבה לך" goes out only for
 * messages ≥5 minutes old that are still unread AND unanswered. One email per
 * conversation-sender per tick; a burst of messages marks as one. Answered or
 * read in time → marked handled silently, no email ever.
 */
async function drainChatEmailGrace(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: pending, error } = await admin
    .from("messages")
    .select("id, conversation_id, sender_id, created_at")
    .is("read_at", null)
    .is("email_notified_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);
  // Pre-migration (missing column) folds to a no-op.
  if (error || !pending?.length) return { sent: 0, skipped: 0 };

  const convIds = [...new Set(pending.map((m) => m.conversation_id))];
  const { data: convs } = await admin
    .from("conversations")
    .select("id, a_id, b_id")
    .in("id", convIds);
  const convOf = new Map((convs ?? []).map((c) => [c.id, c]));

  // Group by (conversation, sender) — each group is one potential email.
  const groups = new Map<string, typeof pending>();
  for (const m of pending) {
    const key = `${m.conversation_id}:${m.sender_id}`;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }

  let sent = 0;
  let skipped = 0;
  const stamp = new Date().toISOString();
  for (const group of groups.values()) {
    const conv = convOf.get(group[0].conversation_id);
    const ids = group.map((m) => m.id);
    if (!conv) {
      await admin.from("messages").update({ email_notified_at: stamp }).in("id", ids);
      continue;
    }
    const senderId = group[0].sender_id;
    const recipientId = conv.a_id === senderId ? conv.b_id : conv.a_id;
    // "ולא עניתי": did the recipient write anything after the oldest waiting
    // message? Then the conversation is alive — no email.
    const { count: replied } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("sender_id", recipientId)
      .gt("created_at", group[0].created_at);
    const { data: rp } = await admin
      .from("profiles")
      .select("digest_frequency")
      .eq("id", recipientId)
      .maybeSingle();
    const wantsEmail = (rp?.digest_frequency || "daily") !== "off";
    if ((replied ?? 0) === 0 && wantsEmail) {
      try {
        const { data: ru } = await admin.auth.admin.getUserById(recipientId);
        const email = ru?.user?.email;
        const { data: sp } = await admin
          .from("profiles")
          .select("first_name, full_name")
          .eq("id", senderId)
          .maybeSingle();
        if (email) {
          const built = newMessageEmail(sp?.first_name || sp?.full_name?.split(" ")[0] || "חברה");
          const r = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
          if (r.ok) sent++;
        }
      } catch (e) {
        console.error("[chat email grace] send failed:", recipientId, e);
      }
    } else {
      skipped++;
    }
    await admin.from("messages").update({ email_notified_at: stamp }).in("id", ids);
  }
  return { sent, skipped };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const enq = await enqueueDueReminders(admin, now);
  const reminders = await drainReminderQueue(admin);
  const jobEmails = await drainJobEmails(admin);
  const chatEmails = await drainChatEmailGrace(admin);

  return NextResponse.json({ ok: true, enqueued: enq.enqueued, reminders, jobEmails, chatEmails });
}
