"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isNedarimConfigured } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import type { SubscriptionPlan } from "@/types/database";

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
  redirect("/feed");
}
