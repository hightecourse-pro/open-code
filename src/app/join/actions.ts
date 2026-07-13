"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isNedarimConfigured } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import type { SubscriptionPlan } from "@/types/database";

/** Has the Nedarim CallBack activated the current member yet? (polled post-payment) */
export async function checkMembershipActive(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  return data?.status === "active";
}

/**
 * DEV ONLY: simulate a successful payment so the full signup → pay → active
 * flow is testable before Nedarim credentials exist. Disabled once Nedarim is
 * configured — in production the real server CallBack activates the member.
 */
export async function simulatePayment(plan: SubscriptionPlan): Promise<{ error?: string }> {
  if (isNedarimConfigured()) {
    return { error: "סימולציה זמינה רק בסביבת פיתוח (לפני חיבור נדרים פלוס)." };
  }
  const user = await getUser();
  if (!user) redirect("/login");

  await activateSubscription({ profileId: user.id, plan });
  redirect("/forum");
}
