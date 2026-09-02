import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  RequestsInbox,
  type CannedReply,
  type InboxRequest,
} from "@/components/patterns/requests-inbox";

export const metadata: Metadata = { title: "פניות לצוות" };
export const dynamic = "force-dynamic";

/**
 * The inbox behind the members' floating "יש לך בקשה?" widget. Replying sends
 * the answer into HER CHAT and marks the request handled — one motion.
 */
export default async function AdminRequestsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: requests }, { data: settings }] = await Promise.all([
    supabase
      .from("member_requests")
      .select("id, profile_id, subject, body, status, created_at, handled_at, handled_by_name, reply")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("app_settings").select("key, value").in("key", ["team_names", "canned_replies"]),
  ]);

  const ids = [...new Set((requests ?? []).map((r) => r.profile_id))];
  const { data: members } = ids.length
    ? await supabase.from("profiles").select("id, full_name, status, member_tier, role").in("id", ids)
    : { data: [] };
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  // מנויה badge (the owner, 2/9) — paying junior; team/mentor labeled apart.
  const subscriberOf = new Map(
    (members ?? []).map((m) => [
      m.id,
      m.role === "junior" && m.status === "active" && m.member_tier === "paid",
    ])
  );

  const settingOf = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const teamNames = ((settingOf.get("team_names") as { names?: string[] } | undefined)?.names ?? []).filter(
    (n): n is string => typeof n === "string"
  );
  const canned = ((settingOf.get("canned_replies") as { items?: CannedReply[] } | undefined)?.items ?? []).filter(
    (c): c is CannedReply => !!c?.title && !!c?.body
  );

  const items: InboxRequest[] = (requests ?? []).map((r) => ({
    id: r.id,
    profile_id: r.profile_id,
    memberName: nameOf.get(r.profile_id) ?? "חברת קהילה",
    isSubscriber: subscriberOf.get(r.profile_id) ?? false,
    subject: r.subject,
    body: r.body,
    status: r.status,
    created_at: r.created_at,
    handled_at: r.handled_at,
    handled_by_name: r.handled_by_name,
    reply: r.reply,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פניות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2">
          <Inbox size={24} className="text-brand-purple" /> פניות לצוות
        </h1>
        <p className="t-body-sm text-ink-500">
          הודעות מהכפתור הצף. תשובה נשלחת אליה ישירות בצ&apos;אט ומסמנת את הפנייה כטופלה —
          עם שם מי שטיפלה, כדי שכולן ידעו איפה זה עומד.
        </p>
      </div>

      <RequestsInbox requests={items} teamNames={teamNames} canned={canned} />
    </div>
  );
}
