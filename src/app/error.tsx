"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * The in-app error boundary. Without it, any server exception showed Next's
 * built-in screen: plain LTR English, no brand, no way forward — the worst
 * possible moment to stop speaking Hebrew to her.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Browser extensions (password managers, translate) rewrite the DOM and
  // React then crashes on reconciliation — a TRANSIENT crash that a plain
  // re-render fixes (the owner, 6/9: "לא קורה תמיד"). Auto-heal once: retry
  // silently, and only show the sad screen if it crashes again within 15s.
  const [healing, setHealing] = useState(true);
  useEffect(() => {
    console.error("[app-error]", error.digest ?? "", error.message);
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("oc-error-heal") ?? 0);
    } catch {
      /* private mode */
    }
    const now = Date.now();
    if (now - last > 15_000) {
      try {
        sessionStorage.setItem("oc-error-heal", String(now));
      } catch {
        /* private mode */
      }
      reset();
      return;
    }
    // Deferred: the sad screen appears only when the retry already failed.
    const t = setTimeout(() => setHealing(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (healing) return null;

  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-ink-200 rounded-[22px] p-8 text-center shadow-md">
        <div className="h-1 w-16 mx-auto rounded-full bg-brand-gradient mb-5" />
        <h1 className="font-display text-[22px] font-black text-ink-1000">משהו השתבש רגע 🙈</h1>
        <p className="t-body-sm text-ink-500 mt-2 mb-6">
          לא את — אנחנו. אפשר לנסות שוב, ואם זה חוזר על עצמו נשמח שתכתבי לנו.
        </p>
        <Button onClick={reset} bracketed>
          לנסות שוב
        </Button>
        {error.digest && (
          <p className="text-[11px] text-ink-400 mt-4 font-mono" dir="ltr">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
