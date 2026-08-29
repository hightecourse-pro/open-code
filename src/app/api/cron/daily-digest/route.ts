import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isResendConfigured, sendResendEmail } from "@/lib/email/resend";
import { dailyDigestEmail } from "@/lib/email/templates";
import { isRestDay } from "@/lib/hebrew-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Bounded batch per run. pg_cron ticks this route every 15 minutes through
// the morning window (Vercel Hobby crons are daily-only — vercel.json keeps a
// single daily tick as a safety), so thousands of members drain across the
// runs — ordered by digest_last_sent_at, oldest first, stamped as processed.
// Nobody is ever starved by a fixed daily cap again.
const BATCH = 150;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const hdr = req.headers.get("authorization");
  return qs === secret || hdr === `Bearer ${secret}`;
}

/** Israel-local calendar date, for the once-a-day guard. */
function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/**
 * Daily digest. Sends each active member a warm roundup of what's waiting: unread
 * chat messages (primary), plus new forum posts / jobs / upcoming sessions.
 * Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET). Manual test:
 *   /api/cron/daily-digest?secret=…&dry=1   (compute only, no send)
 *   /api/cron/daily-digest?secret=…&all=1   (ignore the once-a-day stamp)
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The schedule ships in vercel.json, so a staging deployment gets it too.
  // Staging runs ONLY when an EMAIL_ALLOWLIST is set: every recipient is
  // gated by emailGate (real members' addresses stay unreachable), and the
  // testers DO need the digests to behave — skipping everything outside
  // production made "המיילים הפסיקו" a permanent state on staging.
  if (!isProductionEnv() && !process.env.EMAIL_ALLOWLIST) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  if (!isResendConfigured()) return NextResponse.json({ error: "resend_not_configured" }, { status: 500 });

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const all = url.searchParams.get("all") === "1";
  const testEmail = url.searchParams.get("test");

  // The community rests on Shabbat and on the festivals — and so does its
  // mail. A test address is still allowed through, so the digest can be
  // checked on any day. ?force=1 is the deliberate override.
  const rest = isRestDay();
  if (rest.rest && !testEmail && url.searchParams.get("force") !== "1") {
    return NextResponse.json({ ok: true, skipped: rest.reason, sent: 0 });
  }

  // Deliver a sample digest to one address (for testing), without touching members.
  if (testEmail) {
    const built = dailyDigestEmail({
      name: "בדיקה",
      unreadCount: 2,
      unreadFrom: ["רות", "מיכל"],
      newForumPosts: 3,
      newJobs: 5,
      upcomingSessions: [{ title: "סשן React", when: "15 ביולי" }],
    });
    const r = await sendResendEmail({ to: testEmail, subject: built.subject, html: built.html });
    return NextResponse.json({ ok: r.ok, test: testEmail, error: r.error });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  const in7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  // Anyone stamped after this morning-boundary already got (or was considered
  // for) today's digest — the every-15-minutes window skips her.
  const todayStart = `${israelToday()}T00:00:00+03:00`;

  const [posts, jobs, sessions, unreadRes, batchRes] = await Promise.all([
    admin.from("posts").select("id", { count: "exact", head: true }).eq("kind", "forum").gte("created_at", since),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open").gte("created_at", since),
    admin.from("sessions").select("title, scheduled_at").neq("status", "done").is("canceled_at", null).gte("scheduled_at", now).lte("scheduled_at", in7).order("scheduled_at", { ascending: true }),
    // Unread counts per recipient — one SQL aggregate, not every message row.
    admin.rpc("digest_unread_counts"),
    // This run's batch: active members not yet processed today, oldest-served
    // first. Only the columns the email needs.
    all
      ? admin
          .from("profiles")
          .select("id, first_name, full_name, digest_frequency")
          .eq("status", "active")
          .limit(BATCH)
      : admin
          .from("profiles")
          .select("id, first_name, full_name, digest_frequency")
          .eq("status", "active")
          .or(`digest_last_sent_at.is.null,digest_last_sent_at.lt.${todayStart}`)
          .order("digest_last_sent_at", { ascending: true, nullsFirst: true })
          .limit(BATCH),
  ]);

  const newForumPosts = posts.count ?? 0;
  const newJobs = jobs.count ?? 0;
  const upcomingSessions = (sessions.data ?? []).map((s) => ({
    title: s.title,
    when: new Date(s.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" }),
  }));

  const unreadByRecipient = new Map(
    ((unreadRes.data ?? []) as { recipient: string; unread: number; senders: string[] }[]).map((r) => [
      r.recipient,
      { count: Number(r.unread), from: r.senders ?? [] },
    ])
  );

  const batch = batchRes.data ?? [];
  // Preference filter: 'daily' (default) → send; 'unread' → only with unread
  // messages waiting; 'off' → never. Everyone in the batch gets STAMPED as
  // processed either way — that is what moves the window forward.
  const recipients = batch.filter((p) => {
    const freq = p.digest_frequency || "daily";
    if (freq === "off") return false;
    if (freq === "unread") return (unreadByRecipient.get(p.id)?.count ?? 0) > 0;
    return true;
  });

  const recipientIds = recipients.map((p) => p.id);
  const { data: emailRows } = recipientIds.length
    ? await admin.rpc("member_emails", { p_ids: recipientIds })
    : { data: [] };
  const emailOf = new Map(
    ((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email ?? ""])
  );
  // Sender names for the "unread from" line — only the ones actually needed.
  const senderIds = [
    ...new Set(recipientIds.flatMap((id) => unreadByRecipient.get(id)?.from ?? [])),
  ];
  const { data: senderRows } = senderIds.length
    ? await admin.from("profiles").select("id, first_name, full_name").in("id", senderIds)
    : { data: [] };
  const senderNameOf = new Map(
    (senderRows ?? []).map((p) => [p.id, p.first_name || p.full_name?.split(" ")[0] || "חברה"])
  );

  const results: { email: string; ok: boolean; error?: string }[] = [];
  let sent = 0;
  let nothingToSay = 0;
  for (const p of recipients) {
    const email = emailOf.get(p.id);
    if (!email) continue;
    const u = unreadByRecipient.get(p.id);
    const data = {
      name: p.first_name || p.full_name?.split(" ")[0] || undefined,
      unreadCount: u?.count ?? 0,
      unreadFrom: (u?.from ?? []).map((sid) => senderNameOf.get(sid) ?? "חברה"),
      newForumPosts,
      newJobs,
      upcomingSessions,
    };
    // An empty digest is worse than no digest — it teaches her to ignore us.
    const hasNews =
      data.unreadCount > 0 ||
      data.newForumPosts > 0 ||
      data.newJobs > 0 ||
      data.upcomingSessions.length > 0;
    if (!hasNews) {
      nothingToSay += 1;
      continue;
    }
    if (dry) {
      results.push({ email, ok: true });
      sent += 1;
      continue;
    }
    const built = dailyDigestEmail(data);
    const r = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
    results.push({ email, ok: r.ok, error: r.error });
    if (r.ok) sent += 1;
  }

  // Everyone in the batch was considered — stamp them so the next run in the
  // window moves on to the rest of the community.
  if (!dry && batch.length > 0) {
    await admin
      .from("profiles")
      .update({ digest_last_sent_at: new Date().toISOString() })
      .in("id", batch.map((p) => p.id));
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    // Blocked-by-allowlist is staging behaving correctly, not a delivery
    // failure — only real send errors reach the alerts center.
    const real = failures.filter((f) => f.error !== "blocked_by_allowlist");
    if (real.length > 0) {
      await raiseAlert({
        kind: "digest_send_failed",
        severity: "warning",
        title: `${real.length} מיילים יומיים לא נשלחו`,
        body: `דוגמה לשגיאה: ${real[0].error ?? "?"} — בדרך כלל מכסת Resend או מפתח שפג.`,
        context: { failures: real.slice(0, 10) },
        dedupeKey: "digest-send-failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dry,
    all,
    global: { newForumPosts, newJobs, upcomingSessions: upcomingSessions.length },
    batch: batch.length,
    candidates: recipients.length,
    nothingToSay,
    sent,
    failures,
  });
}
