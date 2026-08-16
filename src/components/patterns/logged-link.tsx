"use client";

// An outbound link that writes down that she went through it. Nothing is
// awaited on her behalf — the navigation happens exactly as it would without
// the logging, and a failed log is invisible to her.

import { useTransition } from "react";
import { logContentOpen } from "@/app/(app)/content/actions";
import type { OpenSource } from "@/lib/content-log";
import type { ContentOwner } from "@/types/database";

export interface LoggedLinkProps {
  href: string;
  ownerType: ContentOwner;
  ownerId: string;
  linkId?: string | null;
  source?: OpenSource;
  className?: string;
  title?: string;
  /** Off-site Drive links open in a new tab; in-app ones stay put. */
  newTab?: boolean;
  children: React.ReactNode;
}

export function LoggedLink({
  href,
  ownerType,
  ownerId,
  linkId,
  source = "open",
  className,
  title,
  newTab = true,
  children,
}: LoggedLinkProps) {
  const [, start] = useTransition();
  return (
    <a
      href={href}
      title={title}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={className}
      onClick={() =>
        start(() => void logContentOpen({ ownerType, ownerId, linkId: linkId ?? null, source }))
      }
    >
      {children}
    </a>
  );
}
