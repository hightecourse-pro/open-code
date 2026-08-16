import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import {
  MemberChatAction,
  MemberMeta,
  memberInitials,
  type DirectoryMember,
} from "@/components/patterns/member-card";

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
            {isMentor && <Badge variant="mentor">👑 מנטורית</Badge>}
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
