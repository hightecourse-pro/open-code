import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Badge, Button } from "@/components/ui";
import { ANSWER_POINTS, ASSIGNMENT_POINTS, mentorScores } from "@/lib/mentor-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { MentorsList, type MentorRowData } from "./mentor-admin-row";
import {
  approveMentorApplication,
  rejectMentorApplication,
  setMemberRoleAction,
} from "../actions";

export const metadata: Metadata = { title: "ניהול מנטוריות" };
export const dynamic = "force-dynamic";

export default async function AdminMentorsPage() {
  const supabase = await createClient();
  const [{ data: mentors }, { data: pendingApps }, { data: candidates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, created_at, mentor_available")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name"),
    // Self-served applications from the join screen — approving is what mails
    // her the promised "אושרת" email.
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, profile_completed, created_at")
      .eq("role", "mentor")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization")
      .eq("role", "junior")
      .eq("status", "active")
      .order("full_name")
      .limit(50),
  ]);

  const mentorIds = (mentors ?? []).map((m) => m.id);
  const scores = await mentorScores(mentorIds);

  // Per-mentor accompaniment history + bonus ledger + admin log + CV links.
  const admin = createAdminClient();
  const pendingIds = (pendingApps ?? []).map((p) => p.id);
  const cvOwnerIds = [...new Set([...mentorIds, ...pendingIds])];
  const [{ data: historyRows }, { data: bonusRows }, { data: logRows }, { data: cvDocs }] =
    await Promise.all([
      mentorIds.length
        ? admin
            .from("mentor_requests")
            .select("id, profile_id, assigned_mentor_id, reason, kind, created_at, mentor_accepted_at, status")
            .in("assigned_mentor_id", mentorIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      mentorIds.length
        ? admin
            .from("mentor_bonus_points")
            .select("mentor_id, points, reason, created_at")
            .in("mentor_id", mentorIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      mentorIds.length
        ? admin
            .from("mentor_admin_log")
            .select("mentor_id, action, reason, created_at")
            .in("mentor_id", mentorIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      cvOwnerIds.length
        ? admin
            .from("cv_documents")
            .select("profile_id, file_path, is_default, created_at")
            .in("profile_id", cvOwnerIds)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const memberIds = [...new Set((historyRows ?? []).map((h) => h.profile_id))];
  const { data: memberNames } = memberIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as { id: string; full_name: string }[] };
  const memberNameOf = new Map((memberNames ?? []).map((m) => [m.id, m.full_name]));

  // One CV per owner (default first), resolved to short-lived signed links.
  const cvPathOf = new Map<string, string>();
  for (const d of cvDocs ?? []) {
    if (!cvPathOf.has(d.profile_id)) cvPathOf.set(d.profile_id, d.file_path);
  }
  const cvPaths = [...new Set(cvPathOf.values())];
  const { data: cvSigned } = cvPaths.length
    ? await admin.storage.from("cvs").createSignedUrls(cvPaths, 3600)
    : { data: [] };
  const cvUrlOfPath = new Map((cvSigned ?? []).map((s) => [s.path, s.signedUrl]));
  const cvUrlOf = (pid: string) => {
    const p = cvPathOf.get(pid);
    return p ? (cvUrlOfPath.get(p) ?? null) : null;
  };

  const rows: MentorRowData[] = (mentors ?? []).map((m) => {
    const history = (historyRows ?? [])
      .filter((h) => h.assigned_mentor_id === m.id)
      .map((h) => ({
        id: h.id,
        memberName: memberNameOf.get(h.profile_id) ?? "חברת קהילה",
        purpose: h.kind === "employment" ? "ליווי בחודשי עבודה ראשונים" : mentorReasonLabel(h.reason),
        assignedAt: h.created_at,
        acceptedAt: h.mentor_accepted_at,
      }));
    const activeLoad = (historyRows ?? []).filter(
      (h) => h.assigned_mentor_id === m.id && h.status === "handled" && h.mentor_accepted_at
    ).length;
    return {
      id: m.id,
      full_name: m.full_name,
      avatar_initials: m.avatar_initials,
      specialization: m.specialization,
      created_at: m.created_at,
      mentor_available: m.mentor_available !== false,
      activeLoad,
      cvUrl: cvUrlOf(m.id),
      score: scores.get(m.id) ?? { score: 0, answers: 0, assignments: 0, bonus: 0 },
      history,
      bonuses: (bonusRows ?? [])
        .filter((b) => b.mentor_id === m.id)
        .map((b) => ({ points: b.points, reason: b.reason, at: b.created_at })),
      log: (logRows ?? [])
        .filter((l) => l.mentor_id === m.id)
        .map((l) => ({ action: l.action, reason: l.reason, at: l.created_at })),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול מנטוריות</h1>
      </div>

      {(pendingApps ?? []).length > 0 && (
        <div className="bg-white border border-[#EAD9A8] rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-1">
            בקשות הצטרפות כמנטורית ({pendingApps!.length})
          </h3>
          <p className="text-[12.5px] text-ink-500 mb-3">
            אישור שולח לה מייל ופותח לה את הקהילה — בלי מנוי ובלי תשלום.
          </p>
          <div className="flex flex-col">
            {pendingApps!.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                <Avatar size="sm" tone="gold" initials={p.avatar_initials || p.full_name.slice(0, 1)} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/members/${p.id}`}
                    className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {p.full_name}
                  </Link>
                  <div className="text-[11.5px] text-ink-500">
                    {p.profile_completed ? "השאלון מולא — אפשר לעבור עליו בפרופיל" : "עוד ממלאת את השאלון"}
                  </div>
                </div>
                {p.specialization && <Badge variant="purple">{p.specialization}</Badge>}
                {cvUrlOf(p.id) ? (
                  <a
                    href={cvUrlOf(p.id)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline"
                  >
                    <FileText size={13} /> קו&quot;ח
                  </a>
                ) : (
                  <span className="text-[11.5px] text-ink-400">עוד לא העלתה קו&quot;ח</span>
                )}
                <form action={approveMentorApplication.bind(null, p.id)}>
                  <Button type="submit" size="sm">אישור 👑</Button>
                </form>
                {/* Declining requires a personal explanation — it goes to her
                    by email, and she stays a regular (not-subscribed) member. */}
                <details className="w-full">
                  <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-500 hover:text-danger list-none">
                    דחייה…
                  </summary>
                  <form
                    action={rejectMentorApplication.bind(null, p.id)}
                    className="mt-2 flex flex-col gap-2 bg-ink-50 border border-ink-200 rounded-md p-3"
                  >
                    <label className="text-[12px] font-semibold text-ink-700" htmlFor={`reject-${p.id}`}>
                      הודעה אישית שמסבירה את ההחלטה (נשלחת אליה במייל)
                    </label>
                    <textarea
                      id={`reject-${p.id}`}
                      name="note"
                      required
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-md border border-ink-200 bg-white p-2 text-[13px] focus:outline-none focus:border-brand-purple"
                      placeholder="למשל: ראינו שהניסיון שלך עדיין בתחילת הדרך — נשמח שתגישי שוב בעוד שנה…"
                    />
                    <div className="flex items-center gap-2">
                      <Button type="submit" size="sm" variant="ghost">שליחת הדחייה</Button>
                      <span className="text-[11.5px] text-ink-500">
                        היא נשארת משתתפת רגילה (לא מנויה) ותתבקש למלא את שאלון החברות.
                      </span>
                    </div>
                  </form>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-1">מנטוריות פעילות ({mentors?.length ?? 0})</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          הניקוד גלוי לכל הקהילה: {ANSWER_POINTS} נק&#39; על תשובה בפורום · {ASSIGNMENT_POINTS} נק&#39; על
          ליווי שאושר · ובונוסים ידניים על תרומה (סשנים, האקתונים…).
        </p>
        {rows.length > 0 ? (
          <MentorsList mentors={rows} />
        ) : (
          <p className="text-ink-500 text-sm">עדיין אין מנטוריות. בחרי חברה פעילה מהרשימה למטה.</p>
        )}
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">מינוי חברה כמנטורית</h3>
        <div className="flex flex-col">
          {(candidates ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <Avatar size="sm" tone="pink" initials={c.avatar_initials || c.full_name.slice(0, 1)} />
              <div className="flex-1 min-w-0 font-medium text-ink-900 truncate">{c.full_name}</div>
              <form action={setMemberRoleAction.bind(null, c.id, "mentor")}>
                <Button type="submit" size="sm">מינוי כמנטורית 👑</Button>
              </form>
            </div>
          ))}
          {(candidates ?? []).length === 0 && (
            <p className="text-ink-500 text-sm">אין חברות פעילות זמינות למינוי כרגע.</p>
          )}
        </div>
      </div>
    </div>
  );
}
