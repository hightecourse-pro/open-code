import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { ANSWER_POINTS, ASSIGNMENT_POINTS, mentorScores } from "@/lib/mentor-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { MentorsList, type MentorRowData } from "./mentor-admin-row";
import { PendingMentorApplications } from "./pending-applications";
import { AppointMentorPicker } from "./appoint-mentor";

export const metadata: Metadata = { title: "ניהול מנטוריות" };
export const dynamic = "force-dynamic";

export default async function AdminMentorsPage() {
  const supabase = await createClient();
  // Past declines (mentor_declined_at) — the registry the owner asked for.
  // Errors (pre-migration column) fold to an empty list.
  const declinedPromise = supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, mentor_declined_at")
    .not("mentor_declined_at", "is", null)
    .order("mentor_declined_at", { ascending: false })
    .then((r) => r.data ?? []);

  const [{ data: mentors }, { data: candidates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, created_at, mentor_available")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name"),
    // ALL active juniors — the compact picker searches by name, so the old
    // first-50 cap (which silently hid everyone past נ׳) is gone.
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "junior")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const mentorIds = (mentors ?? []).map((m) => m.id);
  const scores = await mentorScores(mentorIds);

  // Per-mentor accompaniment history + bonus ledger + admin log + CV links.
  const admin = createAdminClient();
  const declined = await declinedPromise;
  const cvOwnerIds = mentorIds;
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

  // City on the row (the owner, 10/9: "עיר מגורים למנטורית כמו לשאר") -
  // the select answer resolved to its label.
  const cityOf = new Map<string, string>();
  {
    const { data: cityQ } = await admin
      .from("config_questions")
      .select("id, options")
      .eq("key", "city")
      .maybeSingle();
    if (cityQ && (mentors ?? []).length) {
      const labelOf = new Map(
        (Array.isArray(cityQ.options) ? (cityQ.options as unknown as { value: string; label: string }[]) : []).map(
          (o) => [o.value, o.label]
        )
      );
      const { data: cityAns } = await admin
        .from("profile_answers")
        .select("profile_id, value")
        .eq("question_id", cityQ.id)
        .in("profile_id", (mentors ?? []).map((m) => m.id));
      for (const a of cityAns ?? []) {
        if (typeof a.value === "string" && a.value) cityOf.set(a.profile_id, labelOf.get(a.value) ?? a.value);
      }
    }
  }

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
      city: cityOf.get(m.id) ?? null,
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

      <PendingMentorApplications
        heading="בקשות הצטרפות כמנטורית"
        sub="אישור שולח לה מייל ופותח לה את הקהילה — בלי מנוי ובלי תשלום."
      />

      {declined.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h3 className="font-display text-base font-bold mb-1">נדחו כמנטוריות ({declined.length})</h3>
          <p className="text-[12.5px] text-ink-500 mb-3">
            נשארו בקהילה כמשתתפות רגילות. הודעה אישית נוספת אפשר לשלוח מכרטיס &quot;מייל אישי&quot; בתיק
            החברה.
          </p>
          <div className="flex flex-col">
            {declined.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0">
                <Avatar size="sm" tone="pink" initials={d.avatar_initials || d.full_name.slice(0, 1)} />
                <Link
                  href={`/admin/members/${d.id}`}
                  className="flex-1 font-medium text-ink-900 hover:text-brand-purple hover:underline"
                >
                  {d.full_name}
                </Link>
                <span className="text-[12px] text-ink-500 whitespace-nowrap">
                  נדחתה ב־{d.mentor_declined_at ? new Date(d.mentor_declined_at).toLocaleDateString("he-IL") : "—"}
                </span>
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
        <h3 className="font-display text-base font-bold mb-1">מינוי חברה כמנטורית</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          חברה פעילה שאת רוצה להכתיר בעצמך — בלי שהיא הגישה בקשה.
        </p>
        <AppointMentorPicker
          candidates={(candidates ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
        />
      </div>
    </div>
  );
}
