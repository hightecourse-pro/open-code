"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";

/** A button that runs a (server) action after a confirmation dialog. */
export function ConfirmActionButton({
  action,
  message,
  title,
  className,
  children,
}: {
  action: () => Promise<void> | void;
  message: string;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      onClick={() => {
        if (window.confirm(message)) start(() => void action());
      }}
      className={cn("disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}
