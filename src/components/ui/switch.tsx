import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
}

/** Toggle switch — gradient track when on. Used for admin visibility toggles. */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, checked, ...props },
  ref
) {
  return (
    <label className={cn("inline-flex items-center gap-2.5 cursor-pointer text-sm", className)}>
      <span className="relative inline-flex">
        <input ref={ref} type="checkbox" checked={checked} className="peer sr-only" {...props} />
        <span
          className={cn(
            "w-11 h-6 rounded-full bg-ink-300 transition-colors duration-[220ms]",
            "peer-checked:bg-brand-gradient peer-focus-visible:shadow-[0_0_0_3px_rgba(224,65,141,0.15)]"
          )}
        />
        <span
          className={cn(
            "absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow-sm",
            "transition-transform duration-[220ms] ease-spring",
            // App is RTL: knob starts at the right, slides left when on.
            "peer-checked:-translate-x-5"
          )}
        />
      </span>
      {label}
    </label>
  );
});
