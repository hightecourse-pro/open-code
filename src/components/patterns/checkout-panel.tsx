"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shekels, type Plan } from "@/lib/payments/plans";
import { simulatePayment } from "@/app/join/actions";
import { NedarimCheckout } from "./nedarim-checkout";
import type { SubscriptionPlan } from "@/types/database";

export interface CheckoutPanelProps {
  /** Plans derived from the admin-set pricing (passed from the server). */
  plans: Plan[];
  configured: boolean;
  /** Server-built Nedarim transaction fields per plan (only when configured). */
  fieldsByPlan?: Record<SubscriptionPlan, Record<string, string>>;
}

export function CheckoutPanel({ plans, configured, fieldsByPlan }: CheckoutPanelProps) {
  const [plan, setPlan] = useState<SubscriptionPlan>(plans[0]?.id ?? "monthly");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    start(async () => {
      const res = await simulatePayment(plan);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {plans.map((p) => {
          const active = plan === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={cn(
                "text-right rounded-lg border p-4 transition-all",
                active
                  ? "border-[1.5px] border-brand-purple shadow-glow-purple bg-tint-purple/40"
                  : "border-ink-200 hover:border-brand-purple"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-ink-1000">{p.label}</span>
                {active && <Check size={16} className="text-brand-purple" />}
              </div>
              <div className="font-display font-black text-[22px] text-ink-1000 mt-1">
                <span dir="ltr">{shekels(p.amountAgorot)} ₪</span>
              </div>
              <div className="text-xs text-ink-500 mt-0.5">{p.note}</div>
            </button>
          );
        })}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {configured && fieldsByPlan ? (
        <NedarimCheckout fields={fieldsByPlan[plan]} />
      ) : (
        <>
          <Alert variant="info" title="מצב פיתוח">
            נדרים פלוס עדיין לא מחובר. הכפתור מדמה תשלום מוצלח כדי לבדוק את הזרימה.
          </Alert>
          <Button type="button" onClick={pay} disabled={pending} className="w-full" bracketed>
            {pending ? "רגע אחד…" : "הצטרפות וקבלת גישה"}
          </Button>
        </>
      )}
    </div>
  );
}
