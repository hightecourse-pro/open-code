import type React from "react";

/**
 * Keep password/passkey browser extensions OUT of a field: their injected
 * widgets corrupt React's DOM mid-render (the chat "שיחה חדשה" crash, the
 * job-questions silent failures - 14/9). Spread into any Input that is not
 * a login field. The attributes are the vendors' own opt-out hints.
 */
export const NO_PM_PROPS = {
  autoComplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;
