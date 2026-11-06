"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui";
import type { OfficeMailRow } from "@/lib/office-mail";

const DMY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const ERRORS: Record<string, string> = {
  not_configured: "חשבון השירות של גוגל לא מוגדר בסביבה הזו.",
  not_authorized: "לחשבון השירות אין הרשאה לקרוא את התיבה (האצלת סמכויות ל-gmail.readonly).",
  forbidden: "רק מנהלות.",
};

/**
 * תיבת המיילים ממנה (the owner, 6.11): everything she sent to office@, as the cron
 * copied it (every four hours) - newest first, a click opens the text; ״לרענן״ runs
 * the sync now. `/admin/members/{id}#mail` (the link from the submission's card)
 * opens the box at once.
 */
export function MemberMailbox({ profileId, rows, syncedAt }: { profileId: string; rows: OfficeMailRow[]; syncedAt: string | null }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#mail") return;
    const t = setTimeout(() => {
      if (ref.current) ref.current.open = true;
      ref.current?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function refresh() {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch(`/api/admin/member-mail?id=${profileId}`, { method: "POST", cache: "no-store" });
      const j = (await r.json()) as { added?: number; linked?: number; error?: string };
      if (!r.ok) setNote(ERRORS[j.error ?? ""] ?? `הרענון נכשל (${j.error ?? r.status}).`);
      else {
        setNote(j.added ? `נוספו ${j.added} מיילים חדשים לתיבה.` : "אין מיילים חדשים.");
        router.refresh();
      }
    } catch {
      setNote("הרענון נכשל.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details ref={ref} id="mail" className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm scroll-mt-4" data-testid="member-mailbox" data-count={rows.length}>
      <summary className="cursor-pointer list-none flex items-center gap-2 flex-wrap font-display text-base font-bold [&::-webkit-details-marker]:hidden">
        <Mail size={16} className="text-brand-purple" /> תיבת המיילים ממנה
        <Badge variant={rows.length ? "purple" : "gray"}>{rows.length}</Badge>
        <span className="text-[12px] font-normal text-ink-500">{syncedAt ? `עודכן ${DMY.format(new Date(syncedAt))} · מתעדכן כל ארבע שעות` : "עוד לא סונכרן"}</span>
      </summary>
      <div className="mt-3 text-[13px]" data-testid="member-mailbox-body">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <button type="button" onClick={() => void refresh()} disabled={busy} className="text-[12.5px] font-semibold text-brand-purple hover:underline disabled:opacity-50" data-testid="member-mailbox-refresh">
            {busy ? "קוראת מהתיבה…" : "לרענן מהתיבה עכשיו"}
          </button>
          {note && <span className="text-[12.5px] text-ink-600" data-testid="member-mailbox-note">{note}</span>}
        </div>
        {rows.length === 0 && <p className="text-ink-500">לא נמצאו מיילים ממנה בתיבה.</p>}
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-ink-100">
            {rows.map((r) => (
              <li key={r.id} className="py-2" data-testid="member-mail-row">
                <button type="button" onClick={() => setOpened(opened === r.id ? null : r.id)} className="w-full text-start flex items-baseline gap-2 flex-wrap hover:text-brand-purple">
                  <span className="text-[12px] text-ink-500 tabular-nums">{DMY.format(new Date(r.date))}</span>
                  <b className="text-ink-900">{r.subject || "(בלי נושא)"}</b>
                  <span className="text-[12px] text-ink-500">{r.from.replace(/"/g, "")}</span>
                  {r.matchedBy === "name" && <span className="text-[11px] text-ink-400">זוהתה לפי השם</span>}
                </button>
                {opened !== r.id && <p className="text-[12.5px] text-ink-600 mt-0.5 line-clamp-2">{r.snippet}</p>}
                {opened === r.id && (
                  <div className="mt-1.5 rounded-[10px] bg-ink-50 px-3 py-2">
                    <p className="whitespace-pre-line break-words text-ink-800">{r.body || r.snippet}</p>
                    <a href={r.url} target="_blank" rel="noopener" className="mt-1 inline-block text-[12px] font-semibold text-brand-purple hover:underline">
                      לפתוח בתיבה ↗
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
