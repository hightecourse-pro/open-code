"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { setPortalListed } from "@/app/(app)/profile/actions";

/**
 * Whether her profile appears in the employer portal. On by default — it's how
 * companies find her — but always hers to switch off.
 */
export function PortalVisibility({ listed }: { listed: boolean }) {
  const [on, setOn] = useState(listed);
  const [pending, start] = useTransition();

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {on ? (
          <Eye size={17} className="text-brand-purple" />
        ) : (
          <EyeOff size={17} className="text-ink-400" />
        )}
        <h2 className="font-display text-lg font-bold text-ink-1000">הפרופיל שלך מול מעסיקים</h2>
      </div>

      <p className="t-body-sm text-ink-700">
        חברות שעובדות איתנו מקבלות גישה לפורטל מועמדות ורואות שם את הפרופיל המקצועי שלך — במקום
        לקבל קורות חיים במייל. <b>פרטים אישיים (ת״ז, טלפון וכתובת) לעולם לא מוצגים שם.</b>
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          start(() => void setPortalListed(next));
        }}
        className={cn(
          "self-start inline-flex items-center gap-2 text-[13.5px] font-semibold px-4 py-2 rounded-md border transition-colors disabled:opacity-60",
          on
            ? "bg-tint-mint border-[#A7E3C6] text-[#1B7A4B]"
            : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple"
        )}
      >
        {on ? (
          <>
            <Eye size={15} /> הפרופיל שלי מוצג למעסיקים
          </>
        ) : (
          <>
            <EyeOff size={15} /> הפרופיל שלי מוסתר
          </>
        )}
      </button>
      <span className="text-[12.5px] text-ink-500">
        {on ? "לחיצה תסתיר אותך מהפורטל." : "לחיצה תחזיר אותך לפורטל — ותגדיל את הסיכוי שיפנו אלייך."}
      </span>
    </div>
  );
}
