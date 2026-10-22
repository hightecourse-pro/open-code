"use client";

import { useEffect, useState } from "react";

/**
 * mammoth emits plain structural HTML (p, headings, lists, tables, strong/em,
 * links, inline images as data URIs). Belt and braces: nothing executable
 * survives on its way into the page.
 */
function harmless(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
}

/** A Word (.docx) attachment rendered in the page - nothing to download (מלכי ארנסט, 20/10). */
export function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const arrayBuffer = await res.arrayBuffer();
        const mammoth = await import("mammoth");
        const out = await mammoth.convertToHtml({ arrayBuffer });
        if (alive) setHtml(harmless(out.value));
      } catch {
        if (alive) setError("לא הצלחנו להציג את הקובץ כאן - אפשר להוריד אותו בכפתור למעלה.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  if (error) {
    return (
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 text-[14px] text-ink-700" data-testid="docx-error">
        {error}
      </div>
    );
  }
  if (html === null) {
    return (
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 text-[14px] text-ink-500" data-testid="docx-loading">
        טוענת את המסמך…
      </div>
    );
  }
  return (
    <article
      dir="auto"
      className="bg-white border border-ink-200 rounded-[18px] p-6 md:p-8 text-[15px] leading-7 text-ink-900 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:mt-3 [&_h3]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_table]:border-collapse [&_table]:my-3 [&_td]:border [&_td]:border-ink-200 [&_td]:p-1.5 [&_th]:border [&_th]:border-ink-200 [&_th]:p-1.5 [&_img]:max-w-full [&_a]:text-brand-purple [&_a]:underline"
      data-testid="docx-html"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
