"use client";

import { openCollapsible } from "./collapsible-section";

/**
 * "לרשימה המלאה" from the top of the courses page (the owner, 2026-08-30):
 * with an active course the catalogue folds far below — this opens the fold
 * and brings her there in one click.
 */
export function JumpToCatalogue({
  storageKey,
  targetId,
  className,
  children,
}: {
  storageKey: string;
  targetId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        openCollapsible(storageKey);
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </button>
  );
}
