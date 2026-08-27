import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Lock, HeartHandshake, Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { Avatar, Badge, Button } from "@/components/ui";
import { MentorRequestForm } from "@/components/patterns/mentor-request-form";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { mentorReasonLabel } from "@/lib/mentor-requests";
import { startConversation } from "../chat/actions";
import { acceptMentorAssignment, declineMentorAssignment } from "./actions";

export const metadata: Metadata = { title: "המנטוריות שלי" };
export const dynamic = "force-dynamic";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * The MENTOR's side of this screen: assignments made to her. A pending one
 * is an invitation — she accepts (the member only then sees her) or passes.
 */
async function MentorAssignments({ mentorId }: { mentorId: string }) {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("mentor_requests")
    .select("id, profile_id, reason, note, kind, created_at, mentor_accepted_at")
    .eq("assigned_mentor_id", mentorId)
    .order("created_at", { ascending: false });
  const memberIds = [...new Set((rows ?? []).map((r) => r.profile_id))];
  const { data: members } = memberIds.length
    ? await admin.from("profiles").select("id, full_name, avatar_initials").in("id", memberIds)
    : { data: [] };
  const memberOf = new Map((members ?? []).map((m) => [m.id, m]));
  const pending = (rows ?? []).filter((r) => !r.mentor_accepted_at);
  const active = (rows ?? []).filter((r) => !!r.mentor_accepted_at);
  const purpose = (r: { kind: string; reason: string }) =>
    r.kind === "employment" ? "ליווי בחודשי עבודה ראשונים" : mentorReasonLabel(r.reason);

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div className="border-2 border-[#E5A93C] bg-tint-warm/50 rounded-[18px] p-5 flex flex-col gap-3">
          <h2 className="font-display text-[17px] font-black text-ink-1000">
            שיבוצים שמחכים לאישור שלך ({pending.length}) 👑
          </h2>
          {pending.map((r) => {
            const m = memberOf.get(r.profile_id);
            return (
              <div key={r.id} className="bg-white border border-ink-200 rounded-md p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Avatar size="sm" initials={m?.avatar_initials || m?.full_name?.slice(0, 1) || "ק"} />
                  <span className="font-display font-bold text-ink-1000">{m?.full_name ?? "חברת קהילה"}</span>
                  <Badge variant="purple">{purpose(r)}</Badge>
                  <span className="text-[12px] text-ink-400 tabular-nums">שובץ {DATE_HE.format(new Date(r.created_at))}</span>
                </div>
                {r.note && <p className="text-[13.5px] text-ink-700">במילים שלה: &quot;{r.note}&quot;</p>}
                <p className="text-[12.5px] text-ink-500">
                  היא תראה אותך ותקבל מייל רק אחרי שתאשרי — עד אז שום דבר לא קורה.
                </p>
                <div className="flex items-center gap-2">
                  <form action={acceptMentorAssignment.bind(null, r.id)}>
                    <Button type="submit" size="sm">
                      אני מקבלת את הליווי 💜
                    </Button>
                  </form>
                  <form action={declineMentorAssignment.bind(null, r.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      לא מתאים לי כרגע
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h2 className="font-display text-base font-bold text-ink-1000 flex items-center gap-2 mb-2">
          <HeartHandshake size={17} className="text-brand-pink-deep" /> הליוויים שלי ({active.length})
        </h2>
        {active.length > 0 ? (
          <div className="flex flex-col">
            {active.map((r) => {
              const m = memberOf.get(r.profile_id);
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
                  <Avatar size="xs" initials={m?.avatar_initials || m?.full_name?.slice(0, 1) || "ק"} />
                  <span className="font-medium text-ink-900">{m?.full_name ?? "חברת קהילה"}</span>
                  <Badge variant="purple">{purpose(r)}</Badge>
                  <span className="text-[12px] text-ink-400 tabular-nums">
                    מאז {r.mentor_accepted_at ? DATE_HE.format(new Date(r.mentor_accepted_at)) : ""}
                  </span>
                  <form action={startConversation.bind(null, r.profile_id)} className="ms-auto">
                    <button type="submit" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-purple hover:underline">
                      <MessageCircle size={14} /> לצ&apos;אט איתה
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">עוד לא אישרת ליוויים. כשנשבץ אלייך מנטית — היא תופיע כאן 💜</p>
        )}
      </div>
    </div>
  );
}

export default async function MentorPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  // A mentor sees HER side of the story on this screen.
  if (profile.role === "mentor" || profile.role === "admin") {
    const { data: anyAssignment } = await createAdminClient()
      .from("mentor_requests")
      .select("id")
      .eq("assigned_mentor_id", profile.id)
      .limit(1);
    if (profile.role === "mentor" || (anyAssignment?.length ?? 0) > 0) {
      return (
        <div className="flex flex-col gap-5">
          <div>
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מנטורית/&gt;</span>
            <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הליוויים שלי 👑</h1>
            <p className="t-body-sm text-ink-700">
              השיבוצים שלך: מה מחכה לאישור, ואת מי את מלווה עכשיו.
            </p>
          </div>
          <MentorAssignments mentorId={profile.id} />
        </div>
      );
    }
  }

  // Mentoring is a match we make, not a directory she browses. Only an
  // assignment the mentor ACCEPTED is visible to the member — until then the
  // request simply reads "בטיפול".
  const [{ data: generalRequests }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("mentor_requests")
      .select("id, status, assigned_mentor_id, mentor_accepted_at, created_at")
      .eq("profile_id", profile.id)
      .eq("kind", "general")
      .order("created_at", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "mentor_pool_notice").maybeSingle(),
  ]);
  const poolNotice = (settingsRow?.value as { on?: boolean } | null)?.on === true;

  const accepted = (generalRequests ?? []).filter(
    (r) => r.assigned_mentor_id && r.mentor_accepted_at
  );
  // Waiting = an open request OR an assignment the mentor hasn't accepted yet.
  const waiting = (generalRequests ?? []).some(
    (r) => r.status === "open" || (r.assigned_mentor_id && !r.mentor_accepted_at)
  );

  const assignedIds = [
    ...new Set(accepted.map((a) => a.assigned_mentor_id).filter((id): id is string => !!id)),
  ];
  // members_directory, never `profiles`: the view carries no status or tier
  // and a free member may read it.
  const { data: mentorRows } = assignedIds.length
    ? await supabase
        .from("members_directory")
        .select("id, full_name, avatar_initials, specialization, bio")
        .in("id", assignedIds)
    : { data: [] };
  const mentors = mentorRows ?? [];
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

      {/* The honest heads-up while the mentor pool is still being built —
          togglable from הגדרות in the admin. */}
      {poolNotice && !hasMentor && (
        <div className="flex items-start gap-2.5 bg-tint-purple/60 border border-[#DDC9EC] rounded-md p-3.5 px-4 text-[13.5px] text-ink-900">
          <Hourglass size={17} className="text-brand-purple shrink-0 mt-0.5" />
          <span>
            אנחנו עדיין בונות את מאגר המנטוריות שלנו 💜 אפשר כבר לשלוח בקשה — רק דעי שהמענה עשוי
            לקחת קצת יותר זמן מהרגיל. מבטיחות לחזור אלייך ברגע שיש התאמה!
          </span>
        </div>
      )}

      {/* No mentor matched yet → she can ask us to connect her with one. */}
      {!hasMentor &&
        (subscriber ? (
          <MentorRequestForm pendingRequest={waiting} />
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
            {waiting
              ? "הבקשה שלך אצלנו — אנחנו מחפשות לך את המנטורית המתאימה, ונעדכן אותך ברגע שהיא מאשרת 💜"
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
