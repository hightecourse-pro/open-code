"use client";

import { useEffect, useState } from "react";
import { MessageCirclePlus, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import {
  searchChatMembers,
  startConversation,
  type ChatMemberHit,
} from "@/app/(app)/chat/actions";

/**
 * Start a conversation without leaving the chat screen: button, type a name,
 * pick her — the existing find-or-create action opens the thread. Members are
 * looked up on the SERVER per keystroke (debounced) instead of shipping the
 * whole community directory to the browser on every chat render.
 */
export function NewChatButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ChatMemberHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchChatMembers(q);
        if (alive) setHits(rows);
      } catch {
        // A rejected server action (typically a tab from before a deploy whose
        // action ids no longer exist) must NOT reach the error boundary — a
        // refresh fixes it, so say that instead of crashing the page.
        if (alive) setStale(true);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple hover:underline cursor-pointer"
      >
        {open ? <X size={15} /> : <MessageCirclePlus size={15} />}
        {open ? "סגירה" : "שיחה חדשה"}
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-2 start-0 w-[290px] bg-white border border-ink-200 rounded-[14px] shadow-lg p-2.5 flex flex-col gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="עם מי לדבר? חפשי לפי שם או תחום…"
            className="w-full text-[13px] border border-ink-300 rounded-md px-3 py-2 outline-none focus:border-brand-purple"
          />
          <div className="flex flex-col max-h-64 overflow-y-auto">
            {hits.map((m) => (
              <form key={m.id} action={startConversation.bind(null, m.id)}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-tint-purple/50 transition-colors text-start cursor-pointer"
                >
                  <Avatar
                    size="sm"
                    initials={m.avatar_initials || m.full_name.slice(0, 1)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-ink-900 truncate">
                      {m.full_name}
                    </span>
                    <span className="block text-[11.5px] text-ink-500 truncate">
                      {m.specialization ?? "חברת קהילה"}
                    </span>
                  </span>
                </button>
              </form>
            ))}
            {stale && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-[12.5px] font-semibold text-brand-purple px-2 py-3 text-center cursor-pointer hover:underline"
              >
                העמוד התעדכן מאז שנפתח — לחצי לרענון ונמשיך משם 💜
              </button>
            )}
            {!stale && !loading && hits.length === 0 && (
              <p className="text-[12.5px] text-ink-500 px-2 py-3 text-center">
                לא מצאנו — נסי שם אחר 🙂
              </p>
            )}
            {loading && hits.length === 0 && (
              <p className="text-[12.5px] text-ink-400 px-2 py-3 text-center">מחפשת…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
