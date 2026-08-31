"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { sendWhatsAppReply } from "./actions";

export interface WaContactRow {
  id: string;
  waId: string;
  name: string;
  isMember: boolean;
  lastMessageAt: string | null;
  windowLeftMs: number;
}

export interface WaMessageRow {
  id: string;
  direction: "in" | "out";
  body: string;
  status: string;
  error: string | null;
  created_at: string;
}

const TIME_IL = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** ~hours left in Meta's reply window, as a human chip. */
function windowChip(ms: number): { label: string; open: boolean } {
  if (ms <= 0) return { label: "חלון המענה סגור", open: false };
  const h = Math.floor(ms / 3_600_000);
  return { label: h >= 1 ? `עוד ${h} שע׳ לחלון המענה` : "פחות משעה לחלון המענה", open: true };
}

const STATUS_HE: Record<string, string> = {
  sent: "נשלח",
  delivered: "נמסר",
  read: "נקרא ✓✓",
  failed: "נכשל",
};

export function WaInbox({
  contacts,
  activeId,
  messages,
  canSend,
}: {
  contacts: WaContactRow[];
  activeId: string | null;
  messages: WaMessageRow[];
  canSend: boolean;
}) {
  const active = contacts.find((c) => c.id === activeId) ?? null;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, activeId]);

  const win = active ? windowChip(active.windowLeftMs) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 min-h-[480px]">
      {/* conversation list */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-ink-100 text-[12.5px] font-semibold text-ink-500">
          שיחות ({contacts.length})
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 && (
            <p className="text-[13px] text-ink-500 p-4 text-center">
              אין עדיין שיחות — ברגע שמישהי תכתוב למספר, היא תופיע כאן 💜
            </p>
          )}
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={`/admin/whatsapp?c=${c.id}`}
              className={cn(
                "block px-3.5 py-2.5 border-b border-ink-50 hover:bg-ink-50 transition-colors",
                c.id === activeId && "bg-tint-purple/40"
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[13.5px] text-ink-900 truncate flex-1">{c.name}</span>
                {c.isMember && (
                  <span className="text-[10px] font-bold bg-tint-purple text-brand-purple px-1.5 py-0.5 rounded-full shrink-0">
                    חברת קהילה
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between mt-0.5">
                <span className="font-mono text-[11px] text-ink-400" dir="ltr">
                  +{c.waId}
                </span>
                {c.lastMessageAt && (
                  <span className="text-[11px] text-ink-400">{TIME_IL.format(new Date(c.lastMessageAt))}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* thread */}
      <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-ink-500 text-sm p-6 text-center">
            בחרי שיחה מהרשימה — או חכי שמישהי תכתוב למספר הקהילה 💜
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-ink-100 flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-ink-1000">{active.name}</span>
              <span className="font-mono text-[11.5px] text-ink-400" dir="ltr">
                +{active.waId}
              </span>
              {win && (
                <span
                  className={cn(
                    "ms-auto text-[11px] font-bold px-2 py-0.5 rounded-full",
                    win.open ? "bg-tint-mint text-[#0E6B4A]" : "bg-ink-100 text-ink-500"
                  )}
                >
                  {win.label}
                </span>
              )}
            </div>

            <div ref={listRef} className="flex-1 min-h-0 max-h-[440px] overflow-y-auto p-4 flex flex-col gap-1.5 bg-ink-50/40">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex flex-col max-w-[75%]", m.direction === "out" ? "self-end items-end" : "self-start items-start")}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap rounded-2xl",
                      m.direction === "out"
                        ? "bg-[#DCF8C6] text-ink-900 rounded-br-md"
                        : "bg-white border border-ink-200 text-ink-900 rounded-bl-md"
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="text-[10.5px] text-ink-400 mt-0.5 px-1">
                    {TIME_IL.format(new Date(m.created_at))}
                    {m.direction === "out" && ` · ${STATUS_HE[m.status] ?? m.status}`}
                    {m.status === "failed" && m.error && ` — ${m.error}`}
                  </span>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-ink-500 text-center my-auto">אין הודעות בשיחה הזו</p>
              )}
            </div>

            {error && (
              <div role="alert" className="px-4 py-2 border-t border-ink-100 text-[12.5px] text-[#A8254B] bg-danger-bg">
                {error}
              </div>
            )}

            {canSend && win?.open ? (
              <form
                className="border-t border-ink-100 p-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = inputRef.current?.value.trim() ?? "";
                  if (!body || pending) return;
                  setError(null);
                  const fd = new FormData();
                  fd.set("body", body);
                  startTransition(async () => {
                    const res = await sendWhatsAppReply(active.id, fd);
                    if (!res.ok) setError(res.error ?? "השליחה נכשלה");
                    else if (inputRef.current) inputRef.current.value = "";
                  });
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={2}
                  placeholder="כתבי תשובה…"
                  className="flex-1 resize-none border border-ink-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-purple"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="font-display font-semibold text-[13.5px] px-5 py-2.5 rounded-md bg-brand-gradient text-white disabled:opacity-60"
                >
                  {pending ? "שולח…" : "שליחה"}
                </button>
              </form>
            ) : (
              <div className="border-t border-ink-100 p-3.5 text-[13px] text-ink-500 text-center bg-ink-50">
                {!canSend
                  ? "שליחה תיפתח כשהחיבור למטא יושלם — ההודעות הנכנסות כבר נשמרות."
                  : "חלון ה-24 שעות של מטא נסגר — מענה חופשי אפשרי רק תוך יממה מההודעה האחרונה שלה. פתיחת שיחה יזומה (בתבנית) תגיע בשלב הבא."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
