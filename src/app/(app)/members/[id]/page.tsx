import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Briefcase, Cpu, HandHeart, Pencil, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { mentorScores } from "@/lib/mentor-score";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import { Avatar, Badge } from "@/components/ui";
import {
  MemberChatAction,
  MemberMeta,
  memberInitials,
  type DirectoryMember,
} from "@/components/patterns/member-card";

/**
 * A mentor's public card is deliberately richer than a member's — workplace,
 * years, technologies, what she offers. These come from her MENTOR-scope
 * questionnaire answers, read with the service role: the profile the owner
 * decided every member may see. Junior answers never pass through here.
 */
async function mentorSpotlight(profileId: string) {
  const admin = createAdminClient();
  const { data: qs } = await admin
    .from("config_questions")
    .select("id, key")
    .in("key", ["mentor_workplace", "mentor_years", "mentor_tech", "mentor_contribution"]);
  const byKey = new Map((qs ?? []).map((q) => [q.key, q.id]));
  const ids = [...byKey.values()];
  const { data: answers } = ids.length
    ? await admin
        .from("profile_answers")
        .select("question_id, value")
        .eq("profile_id", profileId)
        .in("question_id", ids)
    : { data: [] };
  const byId = new Map((answers ?? []).map((a) => [a.question_id, a.value]));
  const val = (key: string) => byId.get(byKey.get(key) ?? "");

  const taxonomies = await getTaxonomyOptions();
  const techLabels = new Map((taxonomies.tech ?? []).map((o) => [o.value, o.label]));
  const contribution = new Map([
    ["answers", "מענה לשאלות מקצועיות"],
    ["mental", "ליווי מנטלי והתנהלות בעבודה חדשה"],
    ["hackathon", "ליווי פרויקט בהאקתון"],
  ]);

  const rawTech = val("mentor_tech");
  const rawContrib = val("mentor_contribution");
  return {
    workplace: typeof val("mentor_workplace") === "string" ? (val("mentor_workplace") as string) : null,
    years: typeof val("mentor_years") === "number" ? (val("mentor_years") as number) : null,
    tech: Array.isArray(rawTech) ? (rawTech as string[]).map((v) => techLabels.get(v) ?? v) : [],
    contribution: Array.isArray(rawContrib)
      ? (rawContrib as string[]).map((v) => contribution.get(v) ?? v)
      : [],
  };
}

/** "אוגוסט 2025" — how long she's been part of this. */
const MONTH_YEAR = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * One member from the directory view. Never `profiles` — this page must not be
 * able to reveal whether she's paying.
 */
async function loadMember(id: string): Promise<DirectoryMember | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members_directory")
    .select("id, full_name, first_name, avatar_initials, specialization, region, role, bio, created_at")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = await loadMember(id);
  return { title: member?.full_name ?? "משתתפת" };
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireCommunityAccess();
  const member = await loadMember(id);
  if (!member) notFound();

  const isMentor = member.role === "mentor";
  const isMe = member.id === me.id;

  const [spotlight, score] = isMentor
    ? await Promise.all([
        mentorSpotlight(member.id),
        mentorScores([member.id]).then((m) => m.get(member.id) ?? null),
      ])
    : [null, null];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/members"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לכל המשתתפות
      </Link>

      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Avatar
            size="xl"
            tone={isMentor ? "gold" : "pink"}
            crown={isMentor}
            initials={memberInitials(member)}
          />
          <div className="min-w-0 flex flex-col gap-2">
            <h1 className="font-display text-[26px] font-black text-ink-1000 leading-tight">
              {member.full_name}
            </h1>
            <span className="flex items-center gap-2 flex-wrap">
              {isMentor && <Badge variant="mentor">👑 מנטורית</Badge>}
              {isMentor && score && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8C5E0E] bg-tint-warm border border-[#F8D98C] rounded-full px-2.5 py-0.5">
                  <Star size={11} fill="currentColor" /> {score.score} נק&#39;
                </span>
              )}
            </span>
            <MemberMeta member={member} />
            <span className="text-[12.5px] text-ink-400">
              בקהילה מאז {MONTH_YEAR.format(new Date(member.created_at))}
            </span>
          </div>
        </div>

        {member.bio && (
          <p className="text-[14.5px] text-ink-700 leading-relaxed whitespace-pre-wrap">
            {member.bio}
          </p>
        )}

        {isMentor && spotlight && (
          <div className="border border-[#EAD9A8] bg-tint-warm/50 rounded-md p-4 flex flex-col gap-2.5">
            <div className="font-display font-bold text-[14.5px] text-ink-1000">קצת על המנטורית</div>
            {spotlight.workplace && (
              <div className="flex items-center gap-2 text-[13.5px] text-ink-800">
                <Briefcase size={14} className="text-[#8C5E0E] shrink-0" />
                עובדת ב<b>{spotlight.workplace}</b>
                {spotlight.years != null && <> · {spotlight.years} שנות ניסיון</>}
              </div>
            )}
            {!spotlight.workplace && spotlight.years != null && (
              <div className="flex items-center gap-2 text-[13.5px] text-ink-800">
                <Briefcase size={14} className="text-[#8C5E0E] shrink-0" />
                {spotlight.years} שנות ניסיון בתעשייה
              </div>
            )}
            {spotlight.tech.length > 0 && (
              <div className="flex items-start gap-2 text-[13.5px] text-ink-800">
                <Cpu size={14} className="text-[#8C5E0E] shrink-0 mt-1" />
                <span className="flex flex-wrap gap-1.5">
                  {spotlight.tech.map((t) => (
                    <span key={t} className="bg-white border border-[#EAD9A8] rounded-full px-2.5 py-0.5 text-[12px]">
                      {t}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {spotlight.contribution.length > 0 && (
              <div className="flex items-start gap-2 text-[13.5px] text-ink-800">
                <HandHeart size={14} className="text-[#8C5E0E] shrink-0 mt-0.5" />
                <span>{spotlight.contribution.join(" · ")}</span>
              </div>
            )}
            {score && (
              <div className="text-[12px] text-ink-500">
                ⭐ {score.answers} תשובות בפורום · {score.assignments} ליוויים אישיים
              </div>
            )}
          </div>
        )}

        <div className="sm:max-w-[280px]">
          {isMe ? (
            <Link
              href="/profile"
              className="w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2.5 rounded-md bg-ink-50 text-ink-700 border border-ink-200 hover:border-brand-purple hover:text-brand-purple transition-colors"
            >
              <Pencil size={14} /> זה את — לעריכת הפרופיל שלך
            </Link>
          ) : (
            <MemberChatAction member={member} canChat={isSubscriber(me)} />
          )}
        </div>
      </div>
    </div>
  );
}
