import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout";
import { HiredBanner, type HiredMember } from "@/components/patterns/hired-banner";
import { MemberRequestWidget } from "@/components/patterns/member-request-widget";
import { ProfileOnboarding } from "@/components/patterns/profile-onboarding";
import { SessionFeedbackBanner } from "@/components/patterns/session-feedback-banner";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { getFeedbackAspects } from "@/lib/feedback-questions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Women who recently started a job — the whole community celebrates, on every
 * screen (the PM: floating, not buried in the forum). Two sources: members
 * (profiles) and off-community placements (manual_hires, admin-only RLS →
 * service role; banner names are public by design). Names only — a member's
 * workplace is never shown to other members.
 */
async function recentlyHired(): Promise<HiredMember[]> {
  const hiredSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const [{ data: hiredMembers }, { data: manualHires }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, hired_at")
      .eq("found_job", true)
      .gte("hired_at", hiredSince)
      .order("hired_at", { ascending: false })
      .limit(6),
    createAdminClient()
      .from("manual_hires")
      .select("full_name, hired_at")
      .gte("hired_at", hiredSince)
      .order("hired_at", { ascending: false })
      .limit(6),
  ]);
  return [...(hiredMembers ?? []), ...(manualHires ?? [])]
    .filter((h) => !!h.hired_at)
    .sort((a, b) => new Date(b.hired_at!).getTime() - new Date(a.hired_at!).getTime())
    .slice(0, 6)
    .map((h) => ({ full_name: h.full_name }));
}

/**
 * Messages waiting for her — the same rule the daily digest counts by: in one
 * of her conversations, written by the other side, never read.
 *
 * One head-only count, no explicit conversation filter: messages RLS
 * (messages_select) already scopes every row to a conversation she is part
 * of, so the old two-hop version (fetch her conversation ids, then count
 * inside them) counted exactly the same set one round trip later. Verified
 * against the live DB: both formulas agree for every profile (2026-08-19).
 */
async function unreadMessageCount(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", profileId)
    .is("read_at", null);
  return count ?? 0;
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Anyone signed in may look around; paying unlocks taking part. Only a
  // rejected member is turned away here.
  const profile = await requireCommunityAccess();

  // First-login gate: members must complete their profile before entering.
  // (Admins/staff skip — they manage, they don't onboard.)
  if (!profile.profile_completed && profile.role !== "admin") {
    return <ProfileOnboarding profile={profile} />;
  }

  const meta = [profile.specialization, profile.region].filter(Boolean).join(" · ");
  const subscriber = isSubscriber(profile);
  // A free member reads the history she already has, so the count is hers too.
  const unreadCount = await unreadMessageCount(profile.id);

  // "היית איתנו בסשן?" — for a week after a session ends, until she answers.
  // The newest unanswered one; active members only. Title AND date ride along
  // (the PM: it must be obvious WHICH session is being asked about).
  let feedbackSession: { id: string; title: string; scheduled_at: string } | null = null;
  if (profile.status === "active") {
    const supabase = await createClient();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    // Two hours of grace: a session that STARTED but hasn't ended is live,
    // and "היית איתנו?" while she's still inside it would be absurd.
    const endedEdge = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const [{ data: ended }, { data: answered }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, title, scheduled_at")
        .eq("is_published", true)
        .is("canceled_at", null)
        // An admin-marked live session is still running — never ask about it.
        .neq("status", "live")
        .gte("scheduled_at", weekAgo)
        .lt("scheduled_at", endedEdge)
        .order("scheduled_at", { ascending: false })
        .limit(5),
      supabase.from("session_feedback").select("session_id").eq("profile_id", profile.id),
    ]);
    const done = new Set((answered ?? []).map((a) => a.session_id));
    feedbackSession = (ended ?? []).find((s) => !done.has(s.id)) ?? null;
  }
  // The admin-worded rating questions + the celebration names — only fetched
  // when someone will actually see them.
  const [feedbackAspects, hired] = await Promise.all([
    feedbackSession ? getFeedbackAspects() : Promise.resolve([]),
    recentlyHired(),
  ]);

  // Her recent team requests — the widget shows their status and WHO answered.
  const myRequests = await (async () => {
    const supabase = await createClient();
    const { data: reqs } = await supabase
      .from("member_requests")
      .select("id, subject, status, created_at, handled_at, handled_by")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!reqs?.length) return [];
    const adminIds = [...new Set(reqs.map((r) => r.handled_by).filter((v): v is string => !!v))];
    const { data: admins } = adminIds.length
      ? await supabase.from("profiles").select("id, first_name, full_name").in("id", adminIds)
      : { data: [] };
    const nameOf = new Map(
      (admins ?? []).map((a) => [a.id, a.first_name || a.full_name?.split(" ")[0] || "הצוות"])
    );
    return reqs.map((r) => ({
      id: r.id,
      subject: r.subject,
      status: r.status,
      created_at: r.created_at,
      handled_at: r.handled_at,
      handledByName: r.handled_by ? (nameOf.get(r.handled_by) ?? null) : null,
    }));
  })();

  // She turned auto-renewal off but is still inside the paid period — a quiet
  // standing reminder of the end date, with the way back one click away.
  let cancelNotice: string | null = null;
  if (subscriber && profile.role === "junior") {
    const supabase = await createClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, canceled_at, current_period_end")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (sub?.status === "active" && sub.canceled_at && sub.current_period_end) {
      cancelNotice = new Intl.DateTimeFormat("he-IL", {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Jerusalem",
      }).format(new Date(sub.current_period_end));
    }
  }

  return (
    <AppShell
      user={{
        name: profile.full_name || "חברה",
        meta: meta || "חברת קהילה",
        initials: profile.avatar_initials || profile.full_name.slice(0, 1) || "ק",
        isAdmin: profile.role === "admin",
        isMentor: profile.role === "mentor",
        isSubscriber: subscriber,
        unreadCount,
      }}
    >
      {feedbackSession && (
        <SessionFeedbackBanner
          sessionId={feedbackSession.id}
          sessionTitle={feedbackSession.title}
          sessionDate={new Intl.DateTimeFormat("he-IL", {
            day: "numeric",
            month: "numeric",
            timeZone: "Asia/Jerusalem",
          }).format(new Date(feedbackSession.scheduled_at))}
          aspects={feedbackAspects}
        />
      )}
      {cancelNotice && (
        <Link
          href="/profile"
          className="flex items-center gap-2.5 bg-tint-warm border border-[#F8D98C] rounded-md p-3 px-4 mb-5 text-[13.5px] text-[#8C5E0E] hover:border-[#E5A93C] transition-colors"
        >
          <span className="flex-1">
            ביטלת את חידוש המנוי — הוא פעיל עד <b>{cancelNotice}</b>. התחרטת? אפשר להפעיל מחדש
            בלחיצה.
          </span>
          <span className="font-display font-semibold whitespace-nowrap">לפרופיל ←</span>
        </Link>
      )}
      {!subscriber && (
        <Link
          href="/join"
          className="flex items-center gap-2.5 bg-brand-gradient-soft border border-[#DDC9EC] rounded-md p-3 px-4 mb-5 text-[13.5px] text-ink-900 hover:border-brand-purple transition-colors"
        >
          <Sparkles size={17} className="text-brand-pink-deep shrink-0" />
          <span className="flex-1">
            את מסתכלת מסביב 👋 עם מנוי נפתחות גם הקלטות הסשנים, הקורסים, כלי ה-AI והשיחות בפורום.
          </span>
          <span className="font-display font-semibold text-brand-purple whitespace-nowrap">
            למנוי ←
          </span>
        </Link>
      )}
      {children}
      {/* The floating message-to-the-team widget (PM ask) — the reply lands
          back in her chat. */}
      <MemberRequestWidget requests={myRequests} />
      {/* The hired celebration — floating, minimizable, on every screen. */}
      <HiredBanner members={hired} />
    </AppShell>
  );
}
