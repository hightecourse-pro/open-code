"use client";

import { useMemo, useState } from "react";
import { MessageCirclePlus, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { startConversation } from "@/app/(app)/chat/actions";

export interface NewChatMember {
  id: string;
  full_name: string;
  specialization: string | null;
  avatar_initials: string | null;
}

/**
 * Start a conversation without leaving the chat screen. Until now the only
 * door was a member's profile in the directory — from here it is: button,
 * type a name, pick her, and the existing find-or-create action opens the
 * thread (an existing conversation is reused, never duplicated).
 */
export function NewChatButton({ members }: { members: NewChatMember[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members.slice(0, 8);
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(needle) ||
          (m.specialization ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [members, q]);

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
            {visible.map((m) => (
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
            {visible.length === 0 && (
              <p className="text-[12.5px] text-ink-500 px-2 py-3 text-center">
                לא מצאנו — נסי שם אחר 🙂
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
