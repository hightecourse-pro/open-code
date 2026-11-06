"use client";
// A few of the participants' sentences, moving on their own (the owner, 5/11: ״תוסיף עוד כמה משמעותיים שיזוזו
// בקרוסלה״) - verbatim from the booklet's data. One sentence at a time, every few seconds; arrows and dots;
// the motion pauses while the pointer or the focus is on it. Each sentence carries the way to its project.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHALLENGE_INFO, SHOWCASE2_PATH as BASE, type ChallengeKey } from "@/lib/hackathon-showcase";

export interface QuoteItem {
  k8: string;
  challenge: ChallengeKey;
  name: string;
  quote: string;
}

const EVERY_MS = 7000;

export function QuoteCarousel({ items }: { items: QuoteItem[] }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (held || n < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), EVERY_MS);
    return () => window.clearInterval(t);
  }, [held, n]);
  if (!n) return null;
  const q = items[i % n];
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <figure
      className="m-0 px-7 py-7 sm:px-9 sm:py-8 rounded-[12px] bg-[#F7F5FB] border border-[#E3DDEE] flex flex-col gap-4"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      data-testid="sh-quotes"
      data-index={i % n}
      aria-roledescription="קרוסלה"
      aria-label="משפטים של המשתתפות"
    >
      <blockquote key={q.k8 + q.name} className="m-0 min-h-[96px] text-[20px] sm:text-[22px] leading-relaxed font-medium text-[#1B1530]" data-testid="sh-quote-text">
        ״{q.quote}״
      </blockquote>
      <figcaption className="text-[15px] text-[#4E4862] flex items-center justify-between gap-4 flex-wrap">
        <span className="flex items-center gap-4 flex-wrap">
          <span>
            <span className="font-bold text-[#1B1530]">{q.name}</span>, {CHALLENGE_INFO[q.challenge].short}
          </span>
          <Link href={`${BASE}/${q.k8}`} className="inline-flex items-center gap-1 text-[15px] font-bold text-[#4A4EA3] hover:text-[#1B1530]" data-testid="sh-project-link" data-k8={q.k8}>
            לפרויקט ←
          </Link>
        </span>
        {n > 1 && (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => go(1)} aria-label="המשפט הבא" className="w-9 h-9 rounded-full border border-[#D9D3E6] bg-white text-[#1B1530] hover:border-[#1B1530] cursor-pointer" data-testid="sh-quote-next">
              →
            </button>
            <span className="flex items-center gap-1.5" aria-hidden>
              {items.map((it, j) => (
                <button key={it.k8 + it.name} type="button" onClick={() => setI(j)} tabIndex={-1} className={`w-2 h-2 rounded-full cursor-pointer ${j === i % n ? "bg-[#1B1530]" : "bg-[#D9D3E6]"}`} data-testid="sh-quote-dot" />
              ))}
            </span>
            <button type="button" onClick={() => go(-1)} aria-label="המשפט הקודם" className="w-9 h-9 rounded-full border border-[#D9D3E6] bg-white text-[#1B1530] hover:border-[#1B1530] cursor-pointer" data-testid="sh-quote-prev">
              ←
            </button>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
