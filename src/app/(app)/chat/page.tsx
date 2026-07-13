import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar, Button } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { sendMessage } from "./actions";

export const metadata: Metadata = { title: "צ'אטים" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const me = await requireProfile();
  const { c: activeId } = await searchParams;
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, a_id, b_id, last_message_at")
    .order("last_message_at", { ascending: false });

  // Resolve the "other" participant for each conversation.
  const otherIds = [...new Set((conversations ?? []).map((c) => (c.a_id === me.id ? c.b_id : c.a_id)))];
  const { data: others } = otherIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_initials, role, status").in("id", otherIds)
    : { data: [] };
  const otherMap = new Map((others ?? []).map((o) => [o.id, o]));

  const active = (conversations ?? []).find((c) => c.id === activeId) ?? null;
  const activeOther = active ? otherMap.get(active.a_id === me.id ? active.b_id : active.a_id) : null;

  // A junior may only message an active mentor. Once a mentor is removed, the
  // thread stays readable but new messages are blocked. Mentors/staff can reply.
  const canSend =
    me.role !== "junior" ||
    (!!activeOther && activeOther.role === "mentor" && activeOther.status === "active");

  const { data: messages } = active
    ? await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", active.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-black text-ink-1000">צ&apos;אטים</h1>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-[480px]">
        {/* conversation list */}
        <div className="bg-white border border-ink-200 rounded-[18px] p-2 shadow-sm">
          {conversations && conversations.length > 0 ? (
            conversations.map((c) => {
              const other = otherMap.get(c.a_id === me.id ? c.b_id : c.a_id);
              return (
                <Link
                  key={c.id}
                  href={`/chat?c=${c.id}`}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-md transition-colors",
                    c.id === activeId ? "bg-tint-pink" : "hover:bg-ink-100"
                  )}
                >
                  <Avatar
                    size="sm"
                    tone={other?.role === "mentor" ? "gold" : "pink"}
                    initials={other?.avatar_initials || other?.full_name?.slice(0, 1) || "ק"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-ink-900 truncate">
                      {other?.full_name ?? "חברה"}
                    </div>
                    <div className="text-[11px] text-ink-500">{timeAgo(c.last_message_at)}</div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-ink-500 p-4 text-center">
              אין עדיין שיחות. אפשר להתחיל שיחה מעמוד המנטוריות 💬
            </p>
          )}
        </div>

        {/* thread */}
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm flex flex-col">
          {active && activeOther ? (
            <>
              <div className="flex items-center gap-2.5 p-3.5 border-b border-ink-100">
                <Avatar
                  size="sm"
                  tone={activeOther.role === "mentor" ? "gold" : "pink"}
                  initials={activeOther.avatar_initials || activeOther.full_name.slice(0, 1)}
                />
                <span className="font-display font-bold text-ink-1000">{activeOther.full_name}</span>
              </div>

              <div className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto bg-ink-50/40">
                {(messages ?? []).map((m) => {
                  const mine = m.sender_id === me.id;
                  return (
                    <div key={m.id} className={cn("flex flex-col max-w-[78%]", mine ? "self-end items-end" : "self-start items-start")}>
                      <div
                        className={cn(
                          "px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                          mine
                            ? "bg-brand-gradient text-white rounded-2xl rounded-br-md"
                            : "bg-white border border-ink-200 text-ink-900 rounded-2xl rounded-bl-md"
                        )}
                      >
                        {m.body}
                      </div>
                      <span className="text-[10.5px] text-ink-400 mt-0.5 px-1">{timeAgo(m.created_at)}</span>
                    </div>
                  );
                })}
                {(messages ?? []).length === 0 && (
                  <p className="text-sm text-ink-500 text-center my-auto">
                    התחילי את השיחה — תכתבי הודעה ראשונה 💜
                  </p>
                )}
              </div>

              {canSend ? (
                <form
                  action={sendMessage.bind(null, active.id)}
                  className="flex gap-2 p-3 border-t border-ink-100"
                >
                  <input
                    name="body"
                    autoComplete="off"
                    placeholder="כתבי הודעה…"
                    className="flex-1 px-3.5 py-2.5 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
                  />
                  <Button type="submit" size="sm">
                    שליחה
                  </Button>
                </form>
              ) : (
                <div className="p-3.5 border-t border-ink-100 text-[13px] text-ink-500 text-center bg-ink-50">
                  המנטורית כבר לא זמינה לשיחות חדשות. אפשר לפנות למנטורית אחרת מעמוד המנטוריות 💜
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-500 text-sm">
              בחרי שיחה כדי להתחיל
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
