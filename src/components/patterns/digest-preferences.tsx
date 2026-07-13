"use client";

import { useState, useTransition } from "react";
import { Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setDigestFrequency } from "@/app/(app)/profile/actions";

const OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "daily", label: "כל יום", desc: "סיכום יומי קצר של מה שחדש בקהילה" },
  { value: "unread", label: "רק כשיש חדש", desc: "מייל רק כשמחכות לך הודעות חדשות בצ'אט" },
  { value: "off", label: "בלי מיילים", desc: "לא לקבל את המייל היומי" },
];

export function DigestPreferences({ current }: { current: string }) {
  const [value, setValue] = useState(current || "daily");
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  function choose(v: string) {
    setValue(v);
    setSaved(false);
    start(() => {
      void setDigestFrequency(v);
      setSaved(true);
    });
  }

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={18} className="text-brand-purple" />
        <h2 className="font-display text-lg font-bold text-ink-1000">העדפות מייל</h2>
        {saved && <span className="text-[12px] text-[#1B7A4B] flex items-center gap-1 ms-auto"><Check size={13} /> נשמר</span>}
      </div>
      <p className="t-body-sm text-ink-500 mb-4">מתי לשלוח לך את המייל היומי של הקהילה?</p>
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              className={cn(
                "text-start rounded-[12px] border p-3.5 transition-all flex items-start gap-3",
                active ? "border-brand-purple bg-tint-purple" : "border-ink-200 hover:border-brand-purple"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                  active ? "border-brand-purple" : "border-ink-300"
                )}
              >
                {active && <span className="w-2 h-2 rounded-full bg-brand-purple" />}
              </span>
              <span>
                <span className="font-display font-bold text-[14.5px] text-ink-1000 block">{o.label}</span>
                <span className="text-[12.5px] text-ink-500">{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
