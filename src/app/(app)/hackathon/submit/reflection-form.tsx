"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import type { Reflection } from "@/lib/hackathon-submission";
import { saveReflection, type SubmitState } from "./actions";

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
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">מה תרם לך הפרויקט?</span>
        <RichTextEditor id="contributed" name="contributed" defaultValue={mine?.contributed} compact />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">מה למדת על עצמך במהלך בניית הפרויקט?</span>
        <RichTextEditor id="learned" name="learned" defaultValue={mine?.learned} compact />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-800">ממה הכי נהנית?</span>
        <RichTextEditor id="enjoyed" name="enjoyed" defaultValue={mine?.enjoyed} compact />
      </div>
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
