import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isResendConfigured, sendResendEmail } from "@/lib/email/resend";
import { dailyDigestEmail } from "@/lib/email/templates";
import { isRestDay } from "@/lib/hebrew-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Respect the Resend free tier (100/day) — cap sends per run.
const MAX_SENDS = 90;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const hdr = req.headers.get("authorization");
  return qs === secret || hdr === `Bearer ${secret}`;
}

/**
 * Daily digest. Sends each active member a warm roundup of what's waiting: unread
 * chat messages (primary), plus new forum posts / jobs / upcoming sessions.
 * Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET). Manual test:
 *   /api/cron/daily-digest?secret=…&dry=1   (compute only, no send)
 *   /api/cron/daily-digest?secret=…&all=1   (send to every active member)
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The schedule ships in vercel.json, so a staging deployment gets it too —
  // and this nightly run emails real people and pauses real subscriptions.
  // Outside production it reports itself and does nothing.
  if (!isProductionEnv()) {
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

  const [posts, jobs, sessions, convos, unread, profiles, usersList] = await Promise.all([
    admin.from("posts").select("id", { count: "exact", head: true }).eq("kind", "forum").gte("created_at", since),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open").gte("created_at", since),
    admin.from("sessions").select("title, scheduled_at").neq("status", "done").is("canceled_at", null).gte("scheduled_at", now).lte("scheduled_at", in7).order("scheduled_at", { ascending: true }),
    admin.from("conversations").select("id, a_id, b_id"),
    admin.from("messages").select("conversation_id, sender_id").is("read_at", null),
    admin.from("profiles").select("*"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const newForumPosts = posts.count ?? 0;
  const newJobs = jobs.count ?? 0;
  const upcomingSessions = (sessions.data ?? []).map((s) => ({
    title: s.title,
    when: new Date(s.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" }),
  }));

  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id, p.first_name || p.full_name?.split(" ")[0] || ""]));
  const emailOf = new Map((usersList.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  // Subscribers only. Free members browse the community but deliberately get
  // no daily mail — and therefore no session reminders, which are a paid perk.
  const activeMembers = (profiles.data ?? []).filter((p) => p.status === "active");

  // Unread messages grouped by recipient (1:1 conversations).
  const convMap = new Map((convos.data ?? []).map((c) => [c.id, c]));
  const unreadByRecipient = new Map<string, { count: number; from: Set<string> }>();
  for (const m of unread.data ?? []) {
    const c = convMap.get(m.conversation_id);
    if (!c) continue;
    const recipient = c.a_id === m.sender_id ? c.b_id : c.a_id;
    const e = unreadByRecipient.get(recipient) ?? { count: 0, from: new Set<string>() };
    e.count += 1;
    e.from.add(m.sender_id);
    unreadByRecipient.set(recipient, e);
  }

  // Recipients honor each member's preference: 'daily' (default) → everyone;
  // 'unread' → only when there are new messages; 'off' → never. ?all=1 forces
  // send to everyone who hasn't opted out.
  const recipients = activeMembers
    .filter((p) => {
      const freq = p.digest_frequency || "daily";
      if (freq === "off") return false;
      if (all) return true;
      if (freq === "unread") return (unreadByRecipient.get(p.id)?.count ?? 0) > 0;
      return true; // daily
    })
    .map((p) => p.id);

  const results: { email: string; ok: boolean; error?: string }[] = [];
  let sent = 0;
  let nothingToSay = 0;
  for (const id of recipients) {
    if (sent >= MAX_SENDS) break;
    const email = emailOf.get(id);
    if (!email) continue;
    const u = unreadByRecipient.get(id);
    const data = {
      name: nameOf.get(id) || undefined,
      unreadCount: u?.count ?? 0,
      unreadFrom: [...(u?.from ?? [])].map((sid) => nameOf.get(sid) || "חברה").filter(Boolean),
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
    candidates: recipients.length,
    nothingToSay,
    sent,
    failures,
  });
}
