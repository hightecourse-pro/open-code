"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { MediaIsland, iframeHtml, videoHtml } from "@/components/patterns/media-island";

/**
 * A team's demo video. On the judge's desk it plays at once; in a long list
 * (the owner's full board - sixty projects) it waits for a click, so sixty
 * YouTube/Drive players do not load together.
 */
export function LazyVideo({ embedUrl, inlineUrl, lazy = false }: { embedUrl: string | null; inlineUrl: string | null; lazy?: boolean }) {
  const [open, setOpen] = useState(!lazy);
  // A Drive embed needs the judge's Google account to have access; the direct
  // player through our domain is always there as a fallback.
  const [direct, setDirect] = useState(false);
  if (!embedUrl && !inlineUrl) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full aspect-video max-h-[240px] rounded-[14px] border border-ink-200 bg-ink-900 text-white flex items-center justify-center gap-2 font-bold hover:bg-ink-800"
        data-testid="judge-video-open"
      >
        <Play size={18} /> הצגת הסרטון
      </button>
    );
  }
  if (embedUrl && !(direct && inlineUrl)) {
    return (
      <div className="flex flex-col gap-1">
        {/* an island: NetFree injects its bar around the player; React must not reconcile in there (26/10) */}
        <MediaIsland html={iframeHtml(embedUrl, "הסרטון של הצוות", "w-full aspect-video max-h-[60vh] rounded-[14px] border border-ink-200 bg-black")} />
        {inlineUrl && (
          <button type="button" onClick={() => setDirect(true)} className="self-start text-[11.5px] text-ink-500 hover:text-brand-purple hover:underline" data-testid="video-direct">
            הסרטון לא נטען? לנגן הישיר
          </button>
        )}
      </div>
    );
  }
  return <MediaIsland html={videoHtml(inlineUrl ?? "", "w-full max-h-[60vh] rounded-[14px] border border-ink-200 bg-black")} />;
}
