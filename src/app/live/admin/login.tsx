"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/*
  The door of the standalone control panel: the same community sign-in
  (email + password), admin role required - checked on the server page.
*/
const field = "w-full border border-ink-200 rounded-md px-3 py-2.5 text-[15px] bg-ink-50 focus:outline-2 focus:outline-brand-purple";

export function LiveAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
        if (err) {
          setError("הפרטים לא מסתדרים לנו - נסי שוב.");
          return;
        }
        router.refresh();
      } catch {
        setError("החיבור נקטע לרגע - נסי שוב.");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md bg-white border border-ink-200 rounded-xl p-7 sm:p-9 mt-6" data-testid="live-admin-login">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-1000">כניסה ללוח הבקרה</h2>
          <p className="text-sm text-ink-500 mt-1">אותם מייל וסיסמה של קוד פתוח, לחשבון מנהלת.</p>
        </div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-700">
          מייל
          <input type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-700">
          סיסמה
          <input type="password" dir="ltr" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        {error ? (
          <p role="alert" className="rounded-md bg-danger-bg text-danger px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="rounded-md px-4 py-3 text-[15px] font-bold bg-brand-gradient text-white disabled:opacity-50">
          {pending ? "רגע..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

/** Signed in to the community, but not as an admin. */
export function NotAdmin({ name }: { name: string }) {
  return (
    <div className="mx-auto w-full max-w-md bg-white border border-ink-200 rounded-xl p-7 text-center mt-6" data-testid="live-admin-not-admin">
      <h2 className="font-display text-xl font-bold text-ink-1000">הדף הזה למנהלות בלבד</h2>
      <p className="text-sm text-ink-700 mt-3">{name ? `${name}, את` : "את"} מחוברת עם חשבון שאינו מנהלת.</p>
      <SignOut name={name} label="יציאה והתחברות מחדש" />
    </div>
  );
}

export function SignOut({ name, label = "יציאה" }: { name?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await createClient().auth.signOut();
          } catch {
            /* the refresh shows whatever state we are in */
          }
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] border border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100 disabled:opacity-50 mt-0"
      title={name || undefined}
    >
      {pending ? "רגע..." : label}
    </button>
  );
}
