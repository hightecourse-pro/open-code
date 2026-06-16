import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICING, type Pricing } from "./plans";
import type { Database } from "@/types/database";

function merge(value: unknown): Pricing {
  const v = (value ?? {}) as Partial<Pricing>;
  return {
    monthlyAgorot: Number(v.monthlyAgorot) || DEFAULT_PRICING.monthlyAgorot,
    annualDiscountPct: Number.isFinite(Number(v.annualDiscountPct))
      ? Number(v.annualDiscountPct)
      : DEFAULT_PRICING.annualDiscountPct,
    minTermMonths: Number(v.minTermMonths) || DEFAULT_PRICING.minTermMonths,
  };
}

async function read(supabase: SupabaseClient<Database>): Promise<Pricing> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "pricing")
    .maybeSingle();
  return merge(data?.value);
}

/** Read pricing in a request scope (Server Component / route handler). */
export async function getPricing(): Promise<Pricing> {
  const supabase = await createClient();
  return read(supabase);
}

/** Read pricing with the service role (webhook / background activation). */
export async function getPricingAdmin(): Promise<Pricing> {
  return read(createAdminClient());
}
