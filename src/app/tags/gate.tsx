"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { H } from "@/app/ai-course/theme";

/*
  The door of /tags: the entry code the admin set (the sheet holds names and
  ID numbers - not for anyone who guesses the address). Right code = a cookie
  for a month on this computer; a signed-in admin never sees this.
*/
export function TagsGate() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const r = await fetch("/api/tags/enter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
        const j = (await r.json()) as { ok: boolean; error?: string };
        if (!j.ok) {
          setError(j.error || "הקוד לא נכון - נסי שוב.");
          return;
        }
        router.refresh();
      } catch {
        setError("החיבור נקטע לרגע - נסי שוב.");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md bg-white p-7 sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="tags-gate">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
            מערכת הדפסת תגים
          </h1>
          <span className="block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
          <p className="text-[14px]" style={{ color: H.muted }}>
            הזיני את קוד הכניסה שקיבלת.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tags-code" className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
            קוד כניסה
          </label>
          <input
            id="tags-code"
            name="code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-white px-4 py-3 text-[18px] tracking-widest outline-none"
            style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
            data-testid="tags-code"
          />
        </div>
        {error && (
          <p role="alert" className="px-4 py-3 text-[14.5px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }} data-testid="tags-gate-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.navy, borderRadius: 10 }} data-testid="tags-enter">
          {pending ? "רגע..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}
