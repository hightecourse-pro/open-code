"use client";

import { useState, useSyncExternalStore } from "react";
import { JudgeScreen } from "./judge-screen";

const KEY = "live-judge-token";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const readStored = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/* The judges' entrance (the owner, 26/10): one page for all the judges - name,
   challenge and the judges' code, then the scoring screen. The phone remembers
   the entrance, so a refresh goes straight back in. */
export function JudgeEntry({ challenges }: { challenges: { key: string; name: string }[] }) {
  // the phone remembers the entrance; undefined while the server renders, so hydration stays quiet
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const token = override !== undefined ? override : stored;
  const [name, setName] = useState("");
  const [challenge, setChallenge] = useState(challenges[0]?.key ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
    setOverride(null);
  };

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/hackathon/live/judge/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, challengeKey: challenge, code }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; token?: string; error?: string } | null;
      if (!r.ok || !j?.ok || !j.token) throw new Error(j?.error ?? "הכניסה נכשלה");
      try {
        localStorage.setItem(KEY, j.token);
      } catch {
        /* private mode - works for this page only */
      }
      setOverride(j.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (token === undefined) return null;
  if (token) return <JudgeScreen token={token} initial={null} onLeave={leave} />;

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center px-5 py-10 bg-[#f6f4fa]">
      <form onSubmit={enter} className="w-full max-w-md bg-white border border-ink-200 rounded-2xl shadow-md p-7 flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" className="h-16 w-auto self-center" />
        <h1 className="font-display text-xl font-bold text-ink-1000 text-center">שיפוט הגמר</h1>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
          השם שלך
          <input className="border border-ink-200 rounded-md px-3 py-2.5 text-base font-normal bg-ink-50" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} placeholder="שם מלא" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
          האתגר שאת שופטת
          <select className="border border-ink-200 rounded-md px-3 py-2.5 text-base font-normal bg-ink-50" value={challenge} onChange={(e) => setChallenge(e.target.value)}>
            {challenges.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-700">
          קוד השופטות
          <input className="border border-ink-200 rounded-md px-3 py-2.5 text-base font-normal bg-ink-50 tracking-widest" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required placeholder="הקוד מהמארגנת" />
        </label>
        {error ? <div className="rounded-md bg-danger-bg text-danger px-3 py-2 text-sm">{error}</div> : null}
        <button type="submit" disabled={busy} className="rounded-md px-4 py-3 bg-brand-gradient text-white font-bold text-base disabled:opacity-50">
          {busy ? "רגע…" : "כניסה לשיפוט"}
        </button>
      </form>
    </main>
  );
}
