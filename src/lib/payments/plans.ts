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
/**
 * How the commitment reads to a member. With no minimum term there is nothing
 * to name, and "מינימום 0 חודשים" would be worse than saying nothing — so the
 * reassuring half of the sentence is what she sees instead.
 */
export function termNote(minTermMonths: number): string {
  return minTermMonths > 0 ? `מינימום ${minTermMonths} חודשים` : "אפשר לבטל בכל עת";
}

export function buildPlans(pricing: Pricing): Record<SubscriptionPlan, Plan> {
  const monthly = pricing.monthlyAgorot;
  const annual = Math.round(monthly * 12 * (1 - pricing.annualDiscountPct / 100));

  return {
    monthly: {
      id: "monthly",
      label: "מנוי חודשי",
      amountAgorot: monthly,
      periodMonths: 1,
      note: `${shekels(monthly)} ₪ לחודש · ${termNote(pricing.minTermMonths)}`,
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

/**
 * What we actually sell. The annual plan is no longer offered — asking a
 * junior for a year up front is the wrong ask — but buildPlans still knows it
 * so an older annual subscription keeps renewing and its callbacks keep
 * resolving to a real price.
 */
export function planList(pricing: Pricing): Plan[] {
  return [buildPlans(pricing).monthly];
}
