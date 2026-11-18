"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { H } from "../ai-course/theme";
import { PATHS } from "./config";
import { refreshHcAction } from "./actions";
import { fmtTime } from "./ui";

/*
  The client pieces of the Hightecourse management screens: the sign-in (the
  same Supabase auth as Open Code - an admin account gets past the server-side
  role check), the not-an-admin notice, the admin's name + sign-out, the
  navigation, and the ״רענון״ button that drops the sheet cache.
*/
const fieldCls = "w-full bg-white px-4 py-3 text-[16px] outline-none";
const fieldStyle = { border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink } as const;

export function HcLogin() {
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
    <div className="mx-auto mt-6 w-full max-w-md bg-white p-7 sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 14 }} data-testid="hc-login">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
            כניסה למערכת הניהול
          </h1>
          <span className="block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
          <p className="text-[14px]" style={{ color: H.muted }}>
            נכנסים עם אותם מייל וסיסמה של מנהלות קוד פתוח.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hc-admin-email" className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
            מייל
          </label>
          <input id="hc-admin-email" name="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={fieldCls} style={fieldStyle} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hc-admin-password" className="block text-[13.5px] font-bold" style={{ color: H.navy }}>
            סיסמה
          </label>
          <input id="hc-admin-password" name="password" type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={fieldCls} style={fieldStyle} />
        </div>
        {error && (
          <p className="text-[14px] font-bold" style={{ color: H.red }} role="alert" data-testid="hc-login-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.navy, borderRadius: 10 }} data-testid="hc-login-submit">
          {pending ? "רגע..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

function signOutAnd(refresh: () => void) {
  return async () => {
    try {
      await createClient().auth.signOut();
    } catch {
      /* the refresh shows whatever state we are in */
    }
    refresh();
  };
}

export function HcNotAdmin({ name }: { name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto mt-6 w-full max-w-md bg-white p-7 text-center sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 14 }} data-testid="hc-not-admin">
      <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
        המערכת הזו למנהלות בלבד
      </h1>
      <span className="mx-auto mt-2 block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: H.ink }}>
        {name ? `${name}, את` : "את"} מחוברת עם חשבון שאינו מנהלת בקוד פתוח. צאי והתחברי עם חשבון מנהלת.
      </p>
      <button type="button" onClick={() => start(signOutAnd(() => router.refresh()))} disabled={pending} className="mt-6 w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: H.navy, borderRadius: 10 }}>
        {pending ? "רגע..." : "יציאה והתחברות מחדש"}
      </button>
    </div>
  );
}

export function UserMenu({ name }: { name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 text-[13.5px]">
      <span className="font-bold" style={{ color: H.navy }} data-testid="hc-user">
        {name}
      </span>
      <button type="button" onClick={() => start(signOutAnd(() => router.push(PATHS.home)))} disabled={pending} className="font-medium underline underline-offset-2 disabled:opacity-50" style={{ color: H.muted }} data-testid="hc-signout">
        {pending ? "רגע..." : "יציאה"}
      </button>
    </div>
  );
}

const NAV = [
  { href: PATHS.home, label: "דשבורד", exact: true },
  { href: PATHS.participants, label: "משתתפות", exact: false },
  { href: "/hightecourse/sheets", label: "גליונות", exact: false },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-3" aria-label="ניווט" data-testid="hc-nav">
      {NAV.map((n) => {
        const active = n.exact ? path === n.href : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className="whitespace-nowrap px-3 py-2.5 text-[14.5px] font-bold" style={{ color: active ? H.navy : H.muted, borderBottom: `3px solid ${active ? H.navy : "transparent"}`, marginBottom: -3 }} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** ״נקרא מהגיליון ב-14:05 · רענון״ - the sheet is read again on the next render. */
export function Freshness({ fetchedAt }: { fetchedAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const refresh = () =>
    start(async () => {
      setFailed(false);
      const r = await refreshHcAction().catch(() => ({ ok: false }));
      if (!r.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: H.muted }} data-testid="hc-freshness">
      <span>
        נקרא מהגיליון ב-<span dir="ltr">{fmtTime.format(new Date(fetchedAt))}</span>
      </span>
      <button type="button" onClick={refresh} disabled={pending} className="px-3 py-1 text-[13px] font-bold disabled:opacity-60" style={{ border: `1.5px solid ${H.navy}`, color: H.navy, borderRadius: 999, background: H.white }} data-testid="hc-refresh">
        {pending ? "קוראת מהגיליון..." : "רענון מהגיליון"}
      </button>
      {failed && (
        <span className="font-bold" style={{ color: H.red }}>
          הרענון לא הצליח - נסי שוב.
        </span>
      )}
    </div>
  );
}
