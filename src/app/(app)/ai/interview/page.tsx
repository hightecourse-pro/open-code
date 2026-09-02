import type { Metadata } from "next";
import { Mic, Sparkles } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";

// Gemini rides a model-chain with retries — a stormy run outlives the platform
// default window. Server actions inherit the page segment they POST from.
export const maxDuration = 300;

export const metadata: Metadata = { title: "סימולטור ראיונות" };

/**
 * Temporarily offline (the owner, 2026-08-29): the simulator shows a warm
 * "coming soon" instead of the setup. The whole flow stays in the codebase —
 * bringing it back is deleting this early return.
 */
export default async function InterviewPage() {
  await requireCommunityAccess();
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;כלי AI/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2">
          <Mic size={24} className="text-brand-purple" /> סימולטור ראיונות
        </h1>
      </div>
      <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-[2px] shadow-glow-pink">
        <div className="bg-white rounded-[20px] p-8 text-center flex flex-col items-center gap-3">
          <Sparkles size={28} className="text-brand-pink-deep" />
          <h2 className="font-display text-[22px] font-black text-ink-1000">בקרוב 💜</h2>
          <p className="t-body-sm text-ink-700 max-w-md">
            אנחנו משדרגות את סימולטור הראיונות כדי שיהיה מדויק ומחזק עוד יותר. הוא יחזור
            אלייך ממש בקרוב — מבטיחות שיהיה שווה את ההמתנה.
          </p>
        </div>
      </div>
    </div>
  );
}
