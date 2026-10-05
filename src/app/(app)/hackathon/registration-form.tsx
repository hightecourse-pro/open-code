"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { cancelHackathonRegistration, registerForHackathon } from "./actions";

export interface ChallengeOption {
  key: string;
  short: string;
  org: string | null;
}

/**
 * Pick a challenge, alone or with one more subscriber (the owner, 5/10).
 * Re-submitting replaces the previous choice.
 */
export function RegistrationForm({
  challenges,
  candidates,
  current,
  preselect,
}: {
  challenges: ChallengeOption[];
  candidates: { id: string; name: string }[];
  current: { challengeKey: string; partner: { id: string; name: string } | null } | null;
  preselect?: string;
}) {
  const [key, setKey] = useState<string>(current?.challengeKey ?? preselect ?? challenges[0]?.key ?? "");
  const [mode, setMode] = useState<"solo" | "pair">(current?.partner ? "pair" : "solo");
  const [partnerId, setPartnerId] = useState<string>(current?.partner?.id ?? "");
  const [query, setQuery] = useState(current?.partner?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // "Contains" autocomplete (the owner, 5/10): every typed word must appear
  // somewhere in the name - any order, any position; brackets and quotes in
  // names (maiden names) do not get in the way.
  const norm = (s: string) => s.toLowerCase().replace(/[\[\]()"'״׳]/g, " ").replace(/\s+/g, " ").trim();
  const matches = useMemo(() => {
    const words = norm(query).split(" ").filter(Boolean);
    if (!words.length) return [];
    return candidates.filter((c) => {
      const n = norm(c.name);
      return words.every((w) => n.includes(w));
    }).slice(0, 10);
  }, [query, candidates]);
  const chosen = candidates.find((c) => c.id === partnerId) ?? null;
  const showList = mode === "pair" && !chosen && matches.length > 0;

  function submit() {
    setError(null);
    setDone(null);
    if (!key) return setError("בחרי אתגר.");
    if (mode === "pair" && !partnerId) return setError("בחרי את החברה שאיתה את נרשמת, או עברי ל״לבד״.");
    start(async () => {
      const r = await registerForHackathon({ challengeKey: key, partnerId: mode === "pair" ? partnerId : null });
      if (r.error) return setError(r.error);
      const c = challenges.find((x) => x.key === key);
      setDone(`נרשמת לאתגר ״${c?.short ?? key}״${mode === "pair" && chosen ? ` יחד עם ${chosen.name}` : ""} ✓`);
    });
  }

  function cancel() {
    if (!confirm("לבטל את ההרשמה להאקתון?")) return;
    setError(null);
    start(async () => {
      const r = await cancelHackathonRegistration();
      if (r.error) return setError(r.error);
      setDone("ההרשמה בוטלה. אפשר להירשם שוב בכל רגע.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {current && !done && (
        <Alert variant="info">
          את רשומה לאתגר ״{challenges.find((c) => c.key === current.challengeKey)?.short ?? current.challengeKey}״
          {current.partner ? ` יחד עם ${current.partner.name}` : " (לבד)"}. אפשר להחליף למטה בכל רגע.
        </Alert>
      )}
      {done && <Alert variant="success">{done}</Alert>}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display font-bold text-[14.5px] text-ink-1000 mb-1">איזה אתגר?</legend>
        {challenges.map((c) => (
          <label
            key={c.key}
            className={cn(
              "flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-2.5 cursor-pointer transition-colors",
              key === c.key ? "border-brand-purple bg-tint-purple/40" : "border-ink-200 bg-white hover:bg-ink-50"
            )}
          >
            <input type="radio" name="challenge" value={c.key} checked={key === c.key} onChange={() => setKey(c.key)} className="accent-brand-purple" />
            <span className="flex-1 min-w-0">
              <span className="block font-display font-bold text-[14.5px]">{c.short}</span>
              {c.org && <span className="block text-[12px] text-ink-500">{c.org}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display font-bold text-[14.5px] text-ink-1000 mb-1">לבד או כזוג?</legend>
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              ["solo", "לבד 💪"],
              ["pair", "כזוג חברות 👯‍♀️"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13.5px] font-bold border-2 transition-colors",
                mode === m ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "pair" && (
          <div className="relative mt-1">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPartnerId("");
              }}
              placeholder="שם החברה (מנויה פעילה)"
              className="w-full rounded-[12px] border border-ink-200 px-3 py-2 text-[14px] focus:border-brand-purple outline-none"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
            />
            {chosen && <div className="text-[12.5px] text-green-800 mt-1">נבחרה: {chosen.name} ✓</div>}
            {showList && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-ink-200 rounded-[12px] shadow-md overflow-hidden max-h-64 overflow-y-auto">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full text-start px-3 py-2 text-[13.5px] hover:bg-tint-purple/40"
                      onClick={() => {
                        setPartnerId(m.id);
                        setQuery(m.name);
                      }}
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!chosen && query.trim() && matches.length === 0 && <div className="text-[12.5px] text-ink-500 mt-1">לא נמצאה מנויה פעילה בשם הזה - אפשר לחפש לפי חלק מהשם.</div>}
            {!chosen && !query.trim() && <div className="text-[12px] text-ink-500 mt-1">הקלידי חלק מהשם הפרטי או המשפחה - הרשימה מסננת תוך כדי.</div>}
            <p className="text-[12px] text-ink-500 mt-1.5">שתיכן תירשמנה לאותו אתגר. אם היא כבר רשומה לאתגר אחר, ההרשמה שלה תתעדכן.</p>
          </div>
        )}
      </fieldset>

      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "שומר…" : current ? "עדכון ההרשמה ✓" : "הרשמה לאתגר ✓"}
        </Button>
        {current && (
          <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={pending}>
            ביטול ההרשמה
          </Button>
        )}
      </div>
    </div>
  );
}
