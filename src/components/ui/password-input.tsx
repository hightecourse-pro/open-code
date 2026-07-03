"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./form";

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pe-10", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "הסתרת סיסמה" : "הצגת סיסמה"}
        className="absolute inset-y-0 end-3 flex items-center text-ink-400 hover:text-ink-700"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
