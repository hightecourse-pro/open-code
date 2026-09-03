"use client";

import { Input } from "@/components/ui";
import type { ComponentProps } from "react";

// Zero-width chars, bidi marks (RLM/LRM and friends), BOM, NBSP, whitespace —
// everything an email address can never legally contain.
const INVISIBLES = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00a0\s]/g;

/**
 * An email field that survives real-world pasting. Emails copied out of
 * WhatsApp/mail apps arrive wrapped in invisible direction marks — the
 * browser's native validation then rejects a value that LOOKS perfectly fine
 * ("A part followed by '@' should not contain…", ברוריה, 3/9) and she cannot
 * log in. Strip the invisibles the moment they land in the field.
 */
export function EmailInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      type="email"
      dir="ltr"
      onInput={(e) => {
        const el = e.currentTarget;
        const cleaned = el.value.replace(INVISIBLES, "");
        if (cleaned !== el.value) el.value = cleaned;
      }}
    />
  );
}
