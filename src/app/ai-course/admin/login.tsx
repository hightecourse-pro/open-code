"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { H } from "../theme";

/*
  Hightecourse-styled sign-in for the quiz admin. Same Supabase auth as
  קוד פתוח - the owner signs in with the exact same email and password, and
  only an admin account gets past the server-side role check on the page.
*/
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError("הפרטים לא מסתדרים לנו - נסי שוב.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-md bg-white p-7 sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
            כניסת מנהלת
          </h1>
          <span className="block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
          <p className="text-[14px]" style={{ color: H.muted }}>
            נכנסים עם אותם שם משתמש וסיסמה של קוד פתוח.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
            מייל
          </label>
          <input
            name="email"
            type="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-white px-4 py-3 text-[16px] outline-none"
            style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
            סיסמה
          </label>
          <input
            name="password"
            type="password"
            dir="ltr"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-white px-4 py-3 text-[16px] outline-none"
            style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
          />
        </div>
        {error && (
          <p role="alert" className="px-4 py-3 text-[14.5px] font-medium" style={{ background: "#FBEAE8", color: H.red, borderRadius: 10 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: H.navy, borderRadius: 10 }}
        >
          {pending ? "נכנסות..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}
