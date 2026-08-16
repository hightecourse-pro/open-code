import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import { MentorRequestForm } from "@/components/patterns/mentor-request-form";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { startConversation } from "../chat/actions";

export const metadata: Metadata = { title: "המנטוריות שלי" };

export default async function MentorPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  // Mentoring is a match we make, not a directory she browses: the only
  // mentors on this page are the ones an admin assigned to her
  // (mentor_requests.assigned_mentor_id). Backward-safe: before the
  // mentor_requests migration runs this returns nothing and she sees the
  // honest "not matched yet" state.
  // kind='general' only: an employment accompaniment is a different promise —
  // /profile presents it on its own — and counting it here would tell a woman
  // who was given a placement companion that she already has a mentor,
  // hiding the form she needs to ask for one.
  const [{ data: assignments }, { data: openRequest }] = await Promise.all([
    supabase
      .from("mentor_requests")
      .select("assigned_mentor_id, created_at")
      .eq("profile_id", profile.id)
      .eq("kind", "general")
      .not("assigned_mentor_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("mentor_requests")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "open")
      .maybeSingle(),
  ]);

  const assignedIds = [
    ...new Set((assignments ?? []).map((a) => a.assigned_mentor_id).filter((id): id is string => !!id)),
  ];

  // members_directory, never `profiles`: the view carries no status or tier
  // (rule: nobody can tell who pays) and a free member may read it, so she
  // still sees who her mentor is even before she subscribes.
  const { data: mentorRows } = assignedIds.length
    ? await supabase
        .from("members_directory")
        .select("id, full_name, avatar_initials, specialization, bio")
        .in("id", assignedIds)
    : { data: [] };
  const mentors = mentorRows ?? [];

  // What she can actually see decides the page: an assignment to a mentor who
  // has since left the community must not lock her out of asking for another.
  const hasMentor = mentors.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המנטוריות שלי 👑</h1>
        <p className="t-body-sm text-ink-700">
          {hasMentor
            ? "המנטוריות ששובצו לך אישית. אפשר לכתוב להן ישירות — הן כאן בשבילך."
            : "כאן תמצאי את המנטורית ששובצה לך אישית — נשים מנוסות שמלוות בדיוק בשלב הזה."}
        </p>
      </div>

      {/* No mentor matched yet → she can ask us to connect her with one. */}
      {!hasMentor &&
        (subscriber ? (
          <MentorRequestForm pendingRequest={!!openRequest} />
        ) : (
          <UpgradeCard
            title="ליווי אישי של מנטורית נפתח עם מנוי"
            body="עם מנוי נחבר אותך למנטורית אישית — אישה מנוסה שכבר עברה את הדרך הזו, ותוכלי להתכתב איתה ישירות."
          />
        ))}

      {hasMentor ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mentors.map((m) => (
            <div key={m.id} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar size="lg" tone="gold" crown initials={m.avatar_initials || m.full_name.slice(0, 1)} />
                <div>
                  <div className="font-display font-bold text-ink-1000">{m.full_name}</div>
                  {m.specialization && <Badge variant="purple">{m.specialization}</Badge>}
                </div>
              </div>
              {m.bio && <p className="text-[13.5px] text-ink-700 leading-relaxed line-clamp-3">{m.bio}</p>}
              {subscriber ? (
                <form action={startConversation.bind(null, m.id)} className="mt-auto">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2.5 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple transition-colors"
                  >
                    <MessageCircle size={15} /> שלחי הודעה
                  </button>
                </form>
              ) : (
                <Link
                  href="/join"
                  className="mt-auto w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2.5 rounded-md bg-ink-50 text-ink-500 border border-ink-200 hover:border-brand-purple hover:text-brand-purple transition-colors"
                >
                  <Lock size={14} /> התכתבות נפתחת עם מנוי
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700 flex flex-col gap-2">
          <p>
            {assignedIds.length > 0
              ? "המנטורית ששובצה לך לא זמינה כאן כרגע. שלחי לנו בקשה ונחבר אותך לאחת אחרת 💜"
              : "עוד לא שובצה לך מנטורית. כשנחבר אותך לאחת, היא תופיע כאן ותוכלי לכתוב לה ישירות 💜"}
          </p>
          <p className="text-[13.5px] text-ink-500">
            בינתיים{" "}
            <Link href="/members" className="font-semibold text-brand-purple hover:underline">
              המשתתפות שלנו
            </Link>{" "}
            כאן — אפשר להכיר ולהתכתב עם כל אחת מהן.
          </p>
        </div>
      )}
    </div>
  );
}
