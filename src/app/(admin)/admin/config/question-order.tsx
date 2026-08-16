"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveQuestion } from "./actions";

/**
 * Up/down arrows for a question's position. The order decides where the
 * question sits inside its wizard step for the member — and the order a hiring
 * client reads her answers in — so it's worth being able to set it by hand.
 */
export function QuestionOrder({
  id,
  index,
  total,
}: {
  id: string;
  index: number;
  total: number;
}) {
  const [pending, start] = useTransition();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const btn = (disabled: boolean) =>
    cn(
      "p-1 rounded-md border border-ink-200 text-ink-500 transition-colors",
      disabled ? "opacity-30" : "hover:border-brand-purple hover:text-brand-purple cursor-pointer"
    );

  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        aria-label="העלאת השאלה למעלה"
        disabled={pending || isFirst}
        onClick={() => start(() => void moveQuestion(id, "up"))}
        className={btn(pending || isFirst)}
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        aria-label="הורדת השאלה למטה"
        disabled={pending || isLast}
        onClick={() => start(() => void moveQuestion(id, "down"))}
        className={btn(pending || isLast)}
      >
        <ChevronDown size={13} />
      </button>
    </span>
  );
}
