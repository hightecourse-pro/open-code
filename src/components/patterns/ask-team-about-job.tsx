"use client";

import { MessageCircle } from "lucide-react";

/**
 * "יש לך שאלה על המשרה?" on the apply screen — opens the floating
 * request-to-the-team widget with the job already in the subject, so the
 * question lands in פניות לצוות (the owner, 2026-08-30), not in a chat.
 */
export function AskTeamAboutJob({ jobTitle }: { jobTitle: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("oc:open-request", { detail: { subject: `שאלה על המשרה: ${jobTitle}` } })
        )
      }
      className="inline-flex items-center gap-1.5 mt-1 text-[13px] font-semibold text-brand-purple hover:underline cursor-pointer"
    >
      <MessageCircle size={13} /> יש לך שאלה על המשרה? שלחי לצוות
    </button>
  );
}
