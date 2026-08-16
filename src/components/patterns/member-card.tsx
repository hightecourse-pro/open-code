import Link from "next/link";
import { Lock, MapPin, MessageCircle } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { startConversation } from "@/app/(app)/chat/actions";
import type { UserRole } from "@/types/database";

/**
 * One member as the rest of the community sees her — exactly the columns of
 * the `members_directory` view. No status, no tier: a member must never be
 * able to tell who pays.
 */
export interface DirectoryMember {
  id: string;
  full_name: string;
  first_name: string | null;
  avatar_initials: string | null;
  specialization: string | null;
  region: string | null;
  role: UserRole;
  bio: string | null;
  created_at: string;
}

/** Her avatar letters, falling back to the first letter of her name. */
export function memberInitials(member: DirectoryMember): string {
  return member.avatar_initials || member.full_name.slice(0, 1) || "ק";
}

/** How we address her in a button: first name if we have one. */
export function memberFirstName(member: DirectoryMember): string {
  return member.first_name || member.full_name.split(" ")[0] || "חברה";
}

const CHAT_BUTTON_CLASS =
  "w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2.5 rounded-md transition-colors";

/**
 * The way into a private chat with her. Reuses the community's one mechanism:
 * `startConversation` finds or creates the 1:1 conversation and redirects to
 * /chat?c=<id>. Writing is part of the paid membership, so a free member sees
 * the invitation to join instead of a dead button.
 */
export function MemberChatAction({
  member,
  canChat,
  className,
}: {
  member: DirectoryMember;
  canChat: boolean;
  className?: string;
}) {
  if (!canChat) {
    return (
      <Link
        href="/join"
        className={cn(
          CHAT_BUTTON_CLASS,
          "bg-ink-50 text-ink-500 border border-ink-200 hover:border-brand-purple hover:text-brand-purple",
          className
        )}
      >
        <Lock size={14} /> התכתבות נפתחת עם מנוי
      </Link>
    );
  }

  return (
    <form action={startConversation.bind(null, member.id)} className={cn("w-full", className)}>
      <button
        type="submit"
        className={cn(
          CHAT_BUTTON_CLASS,
          "bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple"
        )}
      >
        <MessageCircle size={15} /> התכתבי איתה
      </button>
    </form>
  );
}

/** Her specialization and region, when she filled them in. */
export function MemberMeta({ member }: { member: DirectoryMember }) {
  if (!member.specialization && !member.region) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {member.specialization && <Badge variant="purple">{member.specialization}</Badge>}
      {member.region && (
        <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-500">
          <MapPin size={13} className="shrink-0" />
          {member.region}
        </span>
      )}
    </div>
  );
}

/** A member's card in the directory. Her name opens her full page. */
export function MemberCard({ member, canChat }: { member: DirectoryMember; canChat: boolean }) {
  const isMentor = member.role === "mentor";

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          size="lg"
          tone={isMentor ? "gold" : "pink"}
          crown={isMentor}
          initials={memberInitials(member)}
        />
        <div className="min-w-0 flex flex-col gap-1.5">
          <Link
            href={`/members/${member.id}`}
            className="font-display font-bold text-ink-1000 hover:text-brand-purple transition-colors truncate"
          >
            {member.full_name}
          </Link>
          {isMentor && <Badge variant="mentor">👑 מנטורית</Badge>}
          <MemberMeta member={member} />
        </div>
      </div>

      {member.bio && (
        <p className="text-[13.5px] text-ink-700 leading-relaxed line-clamp-2">{member.bio}</p>
      )}

      <MemberChatAction member={member} canChat={canChat} className="mt-auto" />
    </div>
  );
}
