import type { Metadata } from "next";
import { Sparkles, Trophy } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "האקתון" };

/**
 * The hackathon teaser (the owner, 2026-08-30): the menu item exists from day
 * one, the page promises what's cooking. Swap this for the real event page
 * when the collaborations close.
 */
export default async function HackathonPage() {
  await requireCommunityAccess();
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;האקתון/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2">
          <Trophy size={24} className="text-brand-purple" /> האקתון תחרותי
        </h1>
      </div>
      <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-[2px] shadow-glow-pink">
        <div className="bg-white rounded-[20px] p-8 text-center flex flex-col items-center gap-3">
          <Sparkles size={28} className="text-brand-pink-deep" />
          <h2 className="font-display text-[22px] font-black text-ink-1000">פרטים בקרוב ממש 💜</h2>
          <p className="t-body-sm text-ink-700 max-w-md">
            יש למה לחכות — מבשלים לך שת&quot;פים שווים עם התעשייה, והבמה תהיה שלך להוכיח
            לכולם את היכולות שלך :)
          </p>
        </div>
      </div>
    </div>
  );
}
