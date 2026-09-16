import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getCoordinator } from "@/lib/coordinators";
import {
  loadCoordinatorMessages,
  markCoordinatorMessagesRead,
} from "@/lib/coordinator-data";
import { CoordinatorChatThread } from "./chat-thread";

export const metadata: Metadata = { title: "צ'אט עם הצוות" };
export const dynamic = "force-dynamic";

/** Her line to the team — open any time (the owner, 16/9). */
export default async function CoordinatorChatPage() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const messages = await loadCoordinatorMessages(me.id);
  // She is looking at the thread — the team's replies count as read.
  await markCoordinatorMessagesRead(me.id, "coordinator");

  return (
    <section className="bg-white border border-ink-200 rounded-[16px] p-5 shadow-sm flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
          <MessageCircle size={18} className="text-brand-purple" /> צ&apos;אט עם צוות קוד פתוח
        </h2>
        <p className="text-[12px] text-ink-500">
          אפשר לכתוב לנו כאן בכל עת — שאלות, עדכונים והמלצות. אנחנו עונות בהקדם 💜
        </p>
      </div>
      <CoordinatorChatThread messages={messages} />
    </section>
  );
}
