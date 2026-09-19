"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A floating side preview for a CV file (the owner, 18/9: "תצוגה מקדימה
 * לטפסי קורות חיים בכל מקום — מהצד, צף על המסך"). The file opens in an
 * iframe drawer over the current screen, so nobody leaves the page she is
 * working on. PDFs render inline; a Word file cannot, so the drawer says so
 * and offers the download instead.
 */
export function CvPreviewButton({
  url,
  fileName,
  label = "תצוגה מקדימה",
  title,
  className,
  compact = false,
}: {
  /** A signed URL or an app route that redirects to one. */
  url: string;
  /** Used to tell PDFs from Word files and as the drawer title. */
  fileName?: string | null;
  label?: string;
  /** Drawer heading — e.g. the member's name. */
  title?: string;
  className?: string;
  /** Icon-only trigger for tight rows. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isWord = /\.(docx?|rtf|odt)$/i.test(fileName ?? "");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap cursor-pointer",
          compact
            ? "text-ink-500 hover:text-brand-purple"
            : "text-[12.5px] font-semibold text-brand-purple border border-brand-purple/40 rounded-md px-2.5 py-1.5 hover:bg-tint-purple",
          className
        )}
      >
        <Eye size={compact ? 17 : 13} />
        {!compact && label}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70]" dir="rtl" role="dialog" aria-modal="true" aria-label="תצוגה מקדימה של קורות חיים">
            {/* Click outside closes — the preview floats over the screen. */}
            <button
              type="button"
              aria-label="סגירה"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink-1000/30 cursor-default"
            />
            <aside className="absolute top-0 bottom-0 start-0 w-[min(760px,94vw)] bg-white shadow-2xl flex flex-col border-e border-ink-200 animate-[cv-drawer_.25s_ease]">
              <style>{`@keyframes cv-drawer { from { translate: -24px 0; opacity: .4 } to { translate: 0 0; opacity: 1 } }`}</style>
              <header className="flex items-center gap-2 px-4 py-3 border-b border-ink-200">
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-ink-1000 truncate">
                    {title ?? "קורות חיים"}
                  </div>
                  {fileName && (
                    <div className="text-[11.5px] text-ink-500 truncate" dir="ltr">
                      {fileName}
                    </div>
                  )}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline"
                  title="פתיחה בכרטיסייה חדשה"
                >
                  <ExternalLink size={13} /> כרטיסייה חדשה
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="סגירה"
                  className="w-8 h-8 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </header>
              {isWord ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
                  <p className="text-sm text-ink-700 max-w-sm">
                    זה קובץ Word — הדפדפן לא מציג אותו בתצוגה מקדימה. אפשר להוריד ולפתוח אותו במחשב.
                  </p>
                  <a
                    href={url}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-2"
                  >
                    <Download size={14} /> הורדת הקובץ
                  </a>
                </div>
              ) : (
                <iframe src={url} title="תצוגה מקדימה של קורות חיים" className="flex-1 w-full bg-ink-100" />
              )}
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
