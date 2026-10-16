"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import type { Reflection } from "@/lib/hackathon-submission";
import { saveReflection, type SubmitState } from "./actions";

const TA = "w-full rounded-[10px] border border-ink-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed focus:border-brand-purple outline-none";

/** The three personal questions - hers alone; a partner answers her own on her own page. */
export function ReflectionForm({ mine, isPair, partnerName, partnerReflected }: { mine: Reflection | null; isPair: boolean; partnerName: string | null; partnerReflected: boolean }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(saveReflection, {});
  return (
    <form action={action} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
      <div>
        <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// את"}</div>
        <h2 className="font-display text-[18px] font-black text-ink-1000">מה זה עשה לך</h2>
        <p className="text-[12.5px] text-ink-500 mt-0.5">
          {isPair ? (
            <>
              השאלות האלה אישיות - כל אחת עונה בעצמה, בדף שלה.{" "}
              {partnerName && (partnerReflected ? <b className="text-success">{partnerName} כבר ענתה ✓</b> : <>{partnerName} עדיין לא ענתה.</>)}
            </>
          ) : (
            "בכנות, במילים שלך. זה החלק שאנחנו הכי אוהבות לקרוא."
          )}
        </p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">מה תרם לך הפרויקט?</span>
        <textarea name="contributed" rows={3} maxLength={3000} className={TA} defaultValue={mine?.contributed ?? ""} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">מה למדת על עצמך במהלך בניית הפרויקט?</span>
        <textarea name="learned" rows={3} maxLength={3000} className={TA} defaultValue={mine?.learned ?? ""} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">ממה הכי נהנית?</span>
        <textarea name="enjoyed" rows={3} maxLength={3000} className={TA} defaultValue={mine?.enjoyed ?? ""} />
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending}>
          {pending ? "שומרת…" : "שמירה"}
        </Button>
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.ok && <span className="text-[13px] font-bold text-success">{state.info}</span>}
      </div>
    </form>
  );
}
