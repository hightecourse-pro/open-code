"use client";

import { useEffect, useState } from "react";

/**
 * A plain-text attachment (an AutoHotkey .ahk script, the owner 25/10) shown
 * in the page as code - read-only, nothing is executed, long files are cut
 * with a note (the download button has the whole file).
 */
export function TextAttachmentViewer({ url, fileName }: { url: string; fileName: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 200_000;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const t = await res.text();
        if (alive) setText(t);
      } catch {
        if (alive) setError("לא הצלחנו להציג את הקובץ - אפשר להוריד אותו בכפתור למעלה.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  if (error) return <div className="bg-white border border-ink-200 rounded-[18px] p-6 text-[14px] text-ink-700">{error}</div>;
  if (text === null) return <div className="bg-white border border-ink-200 rounded-[18px] p-6 text-[13px] text-ink-500">טוענת את {fileName}…</div>;
  const cut = text.length > LIMIT;
  return (
    <div className="bg-white border border-ink-200 rounded-[18px] overflow-hidden" data-testid="attachment-text">
      <pre dir="ltr" className="text-[12.5px] leading-relaxed font-mono text-ink-900 p-4 overflow-x-auto whitespace-pre max-h-[82dvh] overflow-y-auto">
        {cut ? text.slice(0, LIMIT) : text}
      </pre>
      {cut && <div className="px-4 py-2 text-[12px] text-ink-500 border-t border-ink-100">מוצג החלק הראשון של הקובץ - הקובץ המלא בהורדה.</div>}
    </div>
  );
}
