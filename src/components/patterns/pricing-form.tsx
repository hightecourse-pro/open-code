"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { updatePricing, type PricingState } from "@/app/(admin)/admin/actions";
import type { Pricing } from "@/lib/payments/plans";

export function PricingForm({ pricing }: { pricing: Pricing }) {
  const [state, action, pending] = useActionState<PricingState, FormData>(updatePricing, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המחיר עודכן ✓ החברות יראו אותו מיד.</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="דמי מנוי חודשיים (₪)" htmlFor="p-monthly">
          <Input
            id="p-monthly"
            name="monthly"
            type="number"
            min={1}
            step={1}
            dir="ltr"
            defaultValue={pricing.monthlyAgorot / 100}
          />
        </Field>
        <Field label="הנחה שנתית (%)" htmlFor="p-discount">
          <Input
            id="p-discount"
            name="discount"
            type="number"
            min={0}
            max={100}
            step={1}
            dir="ltr"
            defaultValue={pricing.annualDiscountPct}
          />
        </Field>
        <Field label="מינימום חודשים" htmlFor="p-minterm">
          <Input
            id="p-minterm"
            name="minTerm"
            type="number"
            min={1}
            step={1}
            dir="ltr"
            defaultValue={pricing.minTermMonths}
          />
        </Field>
      </div>

      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "שומר…" : "שמירת מחיר"}
      </Button>
    </form>
  );
}
