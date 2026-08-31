"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ExternalLink, Play, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { driveEmbedUrl } from "@/lib/drive";
import { logContentOpen } from "@/app/(app)/content/actions";

export interface WatchLink {
  id: string;
  url: string;
}

/**
 * Watching a session recording, inline or out (the owner, 30/8): a fixed
 * "צפייה" button (the link's TITLE never leaks onto it) that opens an
 * embedded player right in the row, with an external Drive link beside it.
 * The FIRST gate press is what grants her Drive permission, and Google can
 * take a few seconds to propagate it to the player — so the note tells that
 * truth and a רענון button remounts the iframe (the owner, 30/8: "הפתיחה
 * בעצם יוצרת שיתוף… זה יקרה לכולם").
 */
export function SessionWatch({ sessionId, links }: { sessionId: string; links: WatchLink[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [, start] = useTransition();

  const log = (linkId: string, source: "open" | "embed") =>
    start(() =>
      void logContentOpen({ ownerType: "session", ownerId: sessionId, linkId, source })
    );

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap gap-2">
        {links.map((l, i) => {
          const open = openId === l.id;
          return (
            <span key={l.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : l.id);
                  if (!open) log(l.id, "embed");
                }}
                aria-expanded={open}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-md px-3.5 py-2 cursor-pointer",
                  open
                    ? "bg-white text-brand-purple border-[1.5px] border-brand-purple"
                    : "text-white bg-brand-gradient"
                )}
              >
                <Play size={13} fill="currentColor" />
                {links.length > 1 ? `צפייה ${i + 1}` : "צפייה"}
                <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
              </button>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => log(l.id, "open")}
                title="פתיחה בדרייב"
                className="text-ink-400 hover:text-brand-purple p-1.5"
              >
                <ExternalLink size={14} />
              </a>
            </span>
          );
        })}
      </div>

      {openId &&
        (() => {
          const link = links.find((l) => l.id === openId);
          const embed = link ? driveEmbedUrl(link.url) : null;
          return (
            <div className="w-full">
              {embed ? (
                <iframe
                  key={reloadKey}
                  src={embed}
                  title="הקלטת הסשן"
                  allow="autoplay"
                  allowFullScreen
                  className="w-full aspect-video rounded-[12px] border border-ink-200 bg-ink-1000/5"
                />
              ) : (
                <p className="text-[12.5px] text-ink-500">
                  את הסרטון הזה אפשר לפתוח רק בדרייב —{" "}
                  <a href={link?.url} target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">
                    לצפייה שם
                  </a>
                  .
                </p>
              )}
              <p className="text-[11.5px] text-ink-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  בפתיחה הראשונה נפתחת לך גישה בדרייב — אם הנגן מבקש הרשאה, חכי כמה שניות
                  ולחצי רענון. עדיין לא נטען, או שמופיעה חסימה (למשל של נטפרי)? פתחי בדרייב עם האייקון שלמעלה — זה אותו סרטון בדיוק 💜
                </span>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline cursor-pointer"
                >
                  <RotateCw size={11} /> רענון
                </button>
              </p>
            </div>
          );
        })()}
    </div>
  );
}
