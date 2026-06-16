import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full font-body text-sm px-3.5 py-3 rounded-sm border bg-ink-0 text-ink-900 " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-ink-400 " +
  "focus:outline-none focus:border-brand-purple focus:shadow-[0_0_0_3px_rgba(224,65,141,0.15)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function controlBorder(error?: boolean) {
  return error ? "border-danger" : "border-ink-300";
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: React.ReactNode;
}

/** Label + control + error message wrapper. */
export function Field({ label, htmlFor, error, className, children, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-700">
          {label}
        </label>
      )}
      {children}
      {error && <span className="text-danger text-xs">{error}</span>}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return (
    <input ref={ref} className={cn(controlBase, controlBorder(error), className)} {...props} />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(controlBase, controlBorder(error), "resize-y min-h-24", className)}
      {...props}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, controlBorder(error), "appearance-none pe-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
      />
    </div>
  );
});

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

/** Custom checkbox — gradient box with white check when on. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, checked, ...props },
  ref
) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm cursor-pointer group", className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "w-[18px] h-[18px] rounded-[5px] border-[1.5px] border-ink-400 inline-flex items-center justify-center text-white",
            "transition-colors peer-checked:bg-brand-gradient peer-checked:border-transparent",
            "peer-focus-visible:shadow-[0_0_0_3px_rgba(224,65,141,0.15)]"
          )}
        >
          <Check size={12} strokeWidth={3} className="opacity-0 peer-checked:opacity-100" />
        </span>
      </span>
      {label}
    </label>
  );
});
