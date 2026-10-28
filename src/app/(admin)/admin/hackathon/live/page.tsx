import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminView } from "@/lib/hackathon-live";
import { loadAdminSubmissions } from "@/lib/hackathon-submission";
import { LiveAdmin, type SubmittedTeam } from "./live-admin";

export const metadata: Metadata = { title: "גמר בשידור חי" };
export const dynamic = "force-dynamic";

/**
 * לוח הבקרה של ערב הגמר (the owner, 26/10): the question order and the
 * weights, the finalists and the judges per challenge, the Yemot line - and
 * what the hall screen (/live) shows right now.
 */
export default async function LiveAdminPage() {
  await requireRole("admin");
  const [initial, submissions] = await Promise.all([adminView({ poll: false }), loadAdminSubmissions()]);
  const submitted: SubmittedTeam[] = submissions
    .filter((s) => s.submittedAt)
    .map((s) => ({ teamKey: s.teamKey, challengeKey: s.challengeKey, team: s.members.map((m) => m.name).join(" + ") }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-1000">גמר ההאקתון בשידור חי</h1>
          <p className="text-ink-500 text-sm">
            הקהל מצביע בטלפון, השופטות מדרגות מהטלפון שלהן, והמסך באולם מציג את השקלול בזמן אמת.{" "}
            <Link href="/admin/hackathon" className="text-brand-purple underline">
              חזרה לניהול ההאקתון
            </Link>
          </p>
        </div>
      </div>
      <LiveAdmin initial={initial} submitted={submitted} />
    </div>
  );
}
