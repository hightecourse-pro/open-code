import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  /** Right-aligned text under the label (e.g. "72%" or "שיעור 4 מתוך 12"). */
  label?: React.ReactNode;
  /** Trailing value text (defaults to "{value}%"). */
  valueLabel?: React.ReactNode;
}

/** Linear gradient progress bar with an optional label row. */
export function ProgressBar({
  className,
  value,
  label,
  valueLabel,
  ...props
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {(label != null || valueLabel != null) && (
        <div className="text-xs text-ink-700 flex justify-between">
          <span>{label}</span>
          <span>{valueLabel ?? `${pct}%`}</span>
        </div>
      )}
      <div
        className="h-2 bg-ink-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  /** 0–100. */
  value: number;
  /** Pixel size of the ring. */
  size?: number;
  /** Center text override (defaults to "{value}%"). */
  centerLabel?: string;
  className?: string;
}

let ringIdSeq = 0;

/** Circular gradient ring — used for CV score and the AI-thinking indicator. */
export function ProgressRing({ value, size = 88, centerLabel, className }: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  // Stable gradient id per instance to avoid collisions when multiple rings render.
  const gradId = React.useMemo(() => `ocRing${ringIdSeq++}`, []);
  return (
    <svg
      viewBox="0 0 36 36"
      style={{ width: size, height: size }}
      className={className}
      role="img"
      aria-label={`${pct}%`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E0418D" />
          <stop offset="50%" stopColor="#913F80" />
          <stop offset="100%" stopColor="#464CA0" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E2EC" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeDasharray={`${pct} 100`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text
        x="18"
        y="20"
        textAnchor="middle"
        fontWeight="700"
        fontSize="9"
        fill="#1F1E3F"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {centerLabel ?? `${pct}%`}
      </text>
    </svg>
  );
}
