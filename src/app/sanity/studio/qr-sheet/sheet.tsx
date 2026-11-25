"use client";

import { useEffect, useState } from "react";
import { loadQr, qrSvg } from "@/lib/sanity/qr";

/* The cards: the circle's number big, its code, its address small (to type if a camera fails). The codes are drawn
   in the browser (the generator is a browser global); the addresses carry this site's origin. */
export function QrSheet({ eventName, cards, autoprint }: { eventName: string; cards: { circle: number; path: string }[]; autoprint: boolean }) {
  const [svgs, setSvgs] = useState<Record<number, string>>({});
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    let alive = true;
    loadQr()
      .then((lib) => {
        if (!alive) return;
        const o = location.origin;
        const out: Record<number, string> = {};
        for (const c of cards) out[c.circle] = qrSvg(lib, o + c.path);
        setOrigin(o);
        setSvgs(out);
        if (autoprint) setTimeout(() => window.print(), 900);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cards, autoprint]);
  const pages: { circle: number; path: string }[][] = [];
  for (let i = 0; i < cards.length; i += 6) pages.push(cards.slice(i, i + 6));
  const host = origin.replace(/^https?:\/\//, "");
  return (
    <div className="qr-sheet" dir="rtl" data-testid="qr-sheet">
      <div className="screen-only">
        <button type="button" onClick={() => window.print()} data-testid="qr-sheet-print">
          הדפסה / שמירה כ-PDF
        </button>
        <span>בחלון ההדפסה: יעד ← ״שמירה כ-PDF״. {cards.length} כרטיסים, {pages.length} עמודים.</span>
      </div>
      {pages.map((page, p) => (
        <section className="page" key={p}>
          {p === 0 && (
            <div className="intro">
              <div className="title">המסע לאי השפיות · {eventName} · כתובות {cards.length} הטאבלטים</div>
              <ol>
                <li>בטאבלט: אפליקציית המצלמה ← מכוונים לקוד של המעגל ← לוחצים על הקישור שקופץ. הוא נפתח בכרום (אם נפתח דפדפן אחר: הגדרות ← אפליקציות ← אפליקציות ברירת מחדל ← דפדפן ← Chrome, וסורקים שוב).</li>
                <li>בכרום: תפריט ⋮ ← ״הוספה למסך הבית״ / ״התקנת אפליקציה״ ← ״התקנה״. סוגרים את כרום ופותחים מהאייקון שנוצר.</li>
                <li>בודקים שהמסך אומר ״מעגל N · ברוכים הבאים״ עם המספר שעל הכרטיס. גוזרים את הכרטיס ומדביקים על גב הטאבלט: טאבלט חלופי סורק אותו וממשיך את המשחק של אותו מעגל.</li>
              </ol>
            </div>
          )}
          <div className="grid">
            {page.map((c) => (
              <div className="card" key={c.circle} data-testid={`qr-card-${c.circle}`}>
                <div className="num">
                  מעגל <b>{c.circle}</b>
                </div>
                <div className="qr" dangerouslySetInnerHTML={{ __html: svgs[c.circle] ?? "" }} />
                <div className="url">
                  {host}
                  {c.path}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
