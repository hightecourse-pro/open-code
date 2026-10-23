"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * A team's demo video. On the judge's desk it plays at once; in a long list
 * (the owner's full board - sixty projects) it waits for a click, so sixty
 * YouTube/Drive players do not load together.
 */
export function LazyVideo({ embedUrl, inlineUrl, lazy = false }: { embedUrl: string | null; inlineUrl: string | null; lazy?: boolean }) {
  const [open, setOpen] = useState(!lazy);
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
  return embedUrl ? (
    <iframe src={embedUrl} title="הסרטון של הצוות" allow="autoplay; fullscreen" allowFullScreen className="w-full aspect-video max-h-[60vh] rounded-[14px] border border-ink-200 bg-black" />
  ) : (
    <video src={inlineUrl ?? undefined} controls preload="metadata" className="w-full max-h-[60vh] rounded-[14px] border border-ink-200 bg-black" />
  );
}
