"use client";

// The one place a member asks for access — and the one place every way it can
// go gets a sentence. She must never face a dead player: while we work she
// sees that we're working, and if Google refuses us she hears it plainly plus
// what happens next.
//
// Once she has it, the gate is gone for good: the server render puts
// `unlocked` at true from her `content_shares` row, so this costs her a single
// press per course/session, ever.

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { unlockContent } from "@/app/(app)/content/actions";
import type { AccessResult } from "@/lib/content-access";
import type { ContentOwner } from "@/types/database";

export interface ContentGateProps {
  ownerType: ContentOwner;
  ownerId: string;
  /** She already holds a live share — render the content, no gate at all. */
  unlocked: boolean;
  /** Button text. Defaults to "צפייה". */
  label?: string;
  /** "card" stands on its own (a course body); "inline" sits inside a row. */
  variant?: "card" | "inline";
  children: React.ReactNode;
}

export function ContentGate({
  ownerType,
  ownerId,
  unlocked,
  label,
  variant = "card",
  children,
}: ContentGateProps) {
  const [state, act, pending] = useActionState<AccessResult | null, FormData>(
    async () => unlockContent(ownerType, ownerId),
    null
  );
  // Success reveals the player in place — no navigation, no reload. Derived
  // from the action's own result, so there is no second source of truth.
  const revealed = state?.ok === true;

  // Google is usually quick, but when it isn't, an unexplained pause reads as
  // a broken button. After ~4 seconds we say what we're waiting for.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [pending]);

  if (unlocked || revealed) {
    return (
      <>
        {/* Drive's permission call returns before it has fully propagated, so
            an occasional first render can still show the sign-in screen. */}
        {revealed && !unlocked && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-[#1B7A4B] bg-tint-mint border border-[#A7E3C6] rounded-md px-3 py-2 mb-2">
            הגישה נפתחה — צפייה נעימה 💜
            <span className="text-ink-500 inline-flex items-center gap-1">
              <RefreshCw size={11} /> לא נטען? רענני את הדף
            </span>
          </p>
        )}
        {children}
      </>
    );
  }

  const notEntitled = state && !state.ok && state.reason === "not_entitled";

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        variant === "card"
          ? "bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm"
          : "items-start max-w-[280px]"
      )}
    >
      {/* setSlow resets in the submit event (not an effect), so the "still
          working" line never appears instantly on a second press. */}
      {!notEntitled && (
        <form action={act} onSubmit={() => setSlow(false)}>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-2 disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> פותחת לך את הגישה…
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> {label ?? "צפייה"}
              </>
            )}
          </button>
        </form>
      )}

      {pending && slow && (
        <p className="text-[12.5px] text-ink-500">עוד רגע — מסדרות את ההרשאות בדרייב 💜</p>
      )}

      {!pending && state && !state.ok && (
        <p className="text-[12.5px] text-ink-700">
          {state.reason === "not_entitled" ? (
            ownerType === "session" ? (
              <>
                ההקלטות נפתחות עם מנוי 💜{" "}
                <Link href="/join" className="text-brand-purple font-semibold hover:underline">
                  לפרטים
                </Link>
              </>
            ) : (
              "הקורס הזה לא פתוח לך כרגע."
            )
          ) : state.reason === "needs_google_email" ? (
            <>
              כדי לצפות צריך כתובת Google — אפשר להוסיף אותה{" "}
              <Link href="/profile" className="text-brand-purple font-semibold hover:underline">
                בפרופיל
              </Link>{" "}
              ואז לחזור לכאן 💜
            </>
          ) : (
            "ביקשנו לפתוח לך את הגישה. זה לוקח לנו רגע — נעדכן אותך ברגע שהיא מוכנה 💜"
          )}
        </p>
      )}

      {variant === "card" && !state && !pending && (
        <p className="text-[12.5px] text-ink-500">
          {ownerType === "session"
            ? "לוחצת, ואנחנו פותחות לך את ההקלטה בדרייב."
            : "לוחצת, ואנחנו פותחות לך את חומרי הקורס בדרייב."}
        </p>
      )}
    </div>
  );
}
