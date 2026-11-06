"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Mail } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { OfficeMailRow } from "@/lib/office-mail";

const DMY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const ERRORS: Record<string, string> = {
  not_configured: "חשבון השירות של גוגל לא מוגדר בסביבה הזו.",
  not_authorized: "לחשבון השירות אין הרשאה לתיבה (האצלת סמכויות).",
  scope: "כדי לסמן כנקרא ולענות מכאן צריך להוסיף ב-Admin console להאצלת הסמכויות את ההרשאה https://www.googleapis.com/auth/gmail.modify",
  staging_allowlist: "בסטייג׳ אפשר לענות רק לכתובות שברשימת ההיתר.",
  not_found: "המייל לא נמצא בתיבה.",
  empty: "אין טקסט לשלוח.",
  forbidden: "רק מנהלות.",
};

type Action = { action: "sync" } | { action: "read"; id: string } | { action: "reply"; id: string; text: string };

/**
 * תיבת המיילים ממנה (the owner, 6.11): everything she sent to office@, as the cron
 * copied it (every four hours) - newest first; unread ones marked; a click opens the
 * text and marks it read (here and in the mailbox); our answers in the thread show under
 * it, and ״להשיב״ sends one from office@. `/admin/members/{id}#mail` opens the box at once.
 */
export function MemberMailbox({ profileId, rows, syncedAt }: { profileId: string; rows: OfficeMailRow[]; syncedAt: string | null }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [opened, setOpened] = useState<string | null>(null);
  const [readHere, setReadHere] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const unread = rows.filter((r) => r.unread && !readHere.has(r.id)).length;

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#mail") return;
    const t = setTimeout(() => {
      if (ref.current) ref.current.open = true;
      ref.current?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function call(a: Action): Promise<{ ok: boolean; error?: string; added?: number; inMailbox?: boolean }> {
    try {
      const r = await fetch(`/api/admin/member-mail?id=${profileId}`, { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
      const j = (await r.json()) as { error?: string; added?: number; inMailbox?: boolean };
      return { ok: r.ok, ...j };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  async function refresh() {
    setBusy("sync");
    setNote(null);
    const j = await call({ action: "sync" });
    setNote(!j.ok ? (ERRORS[j.error ?? ""] ?? `הרענון נכשל (${j.error}).`) : j.added ? `נוספו ${j.added} מיילים חדשים לתיבה.` : "אין מיילים חדשים.");
    if (j.ok) router.refresh();
    setBusy(null);
  }

  async function open(r: OfficeMailRow) {
    if (opened === r.id) {
      setOpened(null);
      return;
    }
    setOpened(r.id);
    if (r.unread && !readHere.has(r.id)) {
      setReadHere((s) => new Set(s).add(r.id));
      const j = await call({ action: "read", id: r.id });
      if (j.ok && j.inMailbox === false) setNote(ERRORS.scope);
    }
  }

  async function reply(r: OfficeMailRow) {
    const text = (drafts[r.id] ?? "").trim();
    if (text.length < 2) return;
    setBusy(r.id);
    setNote(null);
    const j = await call({ action: "reply", id: r.id, text });
    if (!j.ok) setNote(ERRORS[j.error ?? ""] ?? `השליחה נכשלה (${j.error}).`);
    else {
      setNote("התשובה נשלחה מ-office@ ותופיע מתחת למייל.");
      setDrafts((d) => ({ ...d, [r.id]: "" }));
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <details ref={ref} id="mail" className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm scroll-mt-4" data-testid="member-mailbox" data-count={rows.length} data-unread={unread}>
      <summary className="cursor-pointer list-none flex items-center gap-2 flex-wrap font-display text-base font-bold [&::-webkit-details-marker]:hidden">
        <Mail size={16} className="text-brand-purple" /> תיבת המיילים ממנה
        <Badge variant={rows.length ? "purple" : "gray"}>{rows.length}</Badge>
        {unread > 0 && (
          <Badge variant="pink" data-testid="member-mailbox-unread">
            {unread} לא נקראו
          </Badge>
        )}
        <span className="text-[12px] font-normal text-ink-500">{syncedAt ? `עודכן ${DMY.format(new Date(syncedAt))} · מתעדכן כל ארבע שעות` : "עוד לא סונכרן"}</span>
      </summary>
      <div className="mt-3 text-[13px]" data-testid="member-mailbox-body">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <button type="button" onClick={() => void refresh()} disabled={busy === "sync"} className="text-[12.5px] font-semibold text-brand-purple hover:underline disabled:opacity-50" data-testid="member-mailbox-refresh">
            {busy === "sync" ? "קוראת מהתיבה…" : "לרענן מהתיבה עכשיו"}
          </button>
          {note && (
            <span className="text-[12.5px] text-ink-600" data-testid="member-mailbox-note">
              {note}
            </span>
          )}
        </div>
        {rows.length === 0 && <p className="text-ink-500">לא נמצאו מיילים ממנה בתיבה.</p>}
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-ink-100">
            {rows.map((r) => {
              const isUnread = r.unread && !readHere.has(r.id);
              return (
                <li key={r.id} className="py-2" data-testid="member-mail-row" data-unread={isUnread ? "1" : "0"} data-replies={r.replies.length}>
                  <button type="button" onClick={() => void open(r)} className="w-full text-start flex items-baseline gap-2 flex-wrap hover:text-brand-purple">
                    {isUnread && <span className="inline-block h-2 w-2 rounded-full bg-brand-pink-deep" aria-label="לא נקרא" />}
                    <span className="text-[12px] text-ink-500 tabular-nums">{DMY.format(new Date(r.date))}</span>
                    <b className={isUnread ? "text-ink-1000" : "text-ink-800 font-semibold"}>{r.subject || "(בלי נושא)"}</b>
                    <span className="text-[12px] text-ink-500">{r.from.replace(/"/g, "")}</span>
                    {r.matchedBy === "name" && <span className="text-[11px] text-ink-400">זוהתה לפי השם</span>}
                    {r.replies.length > 0 && (
                      <span className="text-[11.5px] text-success inline-flex items-center gap-0.5">
                        <CornerDownLeft size={11} /> נענה
                      </span>
                    )}
                  </button>
                  {opened !== r.id && <p className="text-[12.5px] text-ink-600 mt-0.5 line-clamp-2">{r.snippet}</p>}
                  {opened === r.id && (
                    <div className="mt-1.5 flex flex-col gap-2">
                      <div className="rounded-[10px] bg-ink-50 px-3 py-2">
                        <p className="whitespace-pre-line break-words text-ink-800">{r.body || r.snippet}</p>
                        <a href={r.url} target="_blank" rel="noopener" className="mt-1 inline-block text-[12px] font-semibold text-brand-purple hover:underline">
                          לפתוח בתיבה ↗
                        </a>
                      </div>
                      {r.replies.map((x) => (
                        <div key={x.id} className="ms-4 rounded-[10px] border border-success/30 bg-success/5 px-3 py-2" data-testid="member-mail-reply">
                          <div className="text-[11.5px] text-ink-500 mb-0.5">
                            התשובה שלנו · {DMY.format(new Date(x.date))}
                            {x.viaApp ? " · מהמערכת" : " · מהתיבה"}
                          </div>
                          <p className="whitespace-pre-line break-words text-ink-800">{x.body}</p>
                        </div>
                      ))}
                      <div className="ms-4 flex flex-col gap-1.5" data-testid="member-mail-reply-form">
                        <textarea
                          rows={3}
                          value={drafts[r.id] ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                          placeholder={`להשיב ל${r.from.replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || "ה"} מ-office@`}
                          className="rounded-md border border-ink-300 px-3 py-2 text-[13px]"
                        />
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" disabled={busy === r.id || (drafts[r.id] ?? "").trim().length < 2} onClick={() => void reply(r)} data-testid="member-mail-send">
                            {busy === r.id ? "שולחת…" : "להשיב"}
                          </Button>
                          <span className="text-[11.5px] text-ink-500">נשלח בשרשור של המייל שלה, עם השם שלך בחתימה.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
