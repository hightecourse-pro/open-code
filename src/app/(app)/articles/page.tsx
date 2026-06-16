import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "מאמרים מקצועיים" };

export default function ArticlesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מאמרים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מאמרים מקצועיים</h1>
      </div>
      <div className="bg-white border border-ink-200 rounded-[18px] p-10 shadow-sm flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-tint-purple flex items-center justify-center text-brand-purple">
          <BookOpen size={26} />
        </div>
        <p className="t-body text-ink-700 max-w-sm">
          ספריית המאמרים בדרך — תוכן מקצועי שכתבו חברות הקהילה והמנטוריות. בקרוב כאן 💜
        </p>
      </div>
    </div>
  );
}
