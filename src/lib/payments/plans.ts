import type { SubscriptionPlan } from "@/types/database";

export interface Pricing {
  monthlyAgorot: number;
  annualDiscountPct: number;
  minTermMonths: number;
}

export const DEFAULT_PRICING: Pricing = {
  monthlyAgorot: 3900,
  annualDiscountPct: 10,
  minTermMonths: 3,
};

export interface Plan {
  id: SubscriptionPlan;
  label: string;
  amountAgorot: number;
  periodMonths: number;
  note: string;
}

export function shekels(agorot: number): string {
  return (agorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

/** Derive the monthly + annual plans from the admin-set pricing. */
export function buildPlans(pricing: Pricing): Record<SubscriptionPlan, Plan> {
  const monthly = pricing.monthlyAgorot;
  const annual = Math.round(monthly * 12 * (1 - pricing.annualDiscountPct / 100));

  return {
    monthly: {
      id: "monthly",
      label: "מנוי חודשי",
      amountAgorot: monthly,
      periodMonths: 1,
      note: `${shekels(monthly)} ₪ לחודש · מינימום ${pricing.minTermMonths} חודשים`,
    },
    annual: {
      id: "annual",
      label: "מנוי שנתי",
      amountAgorot: annual,
      periodMonths: 12,
      note: `${shekels(annual)} ₪ לשנה · ${pricing.annualDiscountPct}% הנחה`,
    },
  };
}

export function planList(pricing: Pricing): Plan[] {
  const plans = buildPlans(pricing);
  return [plans.monthly, plans.annual];
}
