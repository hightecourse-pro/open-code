"use client";

import { useTransition } from "react";
import { PRESENCE_HOURS } from "@/lib/arena-shared";
import { setPresence } from "./actions";

const UNTIL = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/** "אני כאן עכשיו" (the owner, 16/10): an hour of presence - random picks prefer her, participants see the count. */
export function PresenceToggle({ present, until }: { present: boolean; until: string | null }) {
  const [pending, start] = useTransition();
  return present ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setPresence(false).then(() => undefined))}
      className="rounded-full bg-white text-success px-3 py-1 font-bold hover:bg-tint-mint"
      title="ללחוץ כדי לצאת"
    >
      🟢 את כאן{until ? ` עד ${UNTIL.format(new Date(until))}` : ""} · לצאת
    </button>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setPresence(true).then(() => undefined))}
      className="rounded-full bg-white/20 border border-white/40 px-3 py-1 font-bold hover:bg-white/30"
    >
      {pending ? "…" : `אני כאן ל-${PRESENCE_HOURS === 1 ? "שעה" : `${PRESENCE_HOURS} שעות`} הקרובה 🟢`}
    </button>
  );
}
