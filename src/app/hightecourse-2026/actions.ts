"use server";

import { createConferenceOrder, loadOrder, reportConferencePaymentFromBrowser } from "@/lib/conference";
import type { OrderInput, OrderStatus } from "@/lib/conference-shared";

/** The public form's submit (single or group) - validated again on the server. */
export async function submitConferenceOrder(input: OrderInput) {
  return createConferenceOrder(input);
}

/** The payment page polls this after the iframe reports success, until the callback marks the order paid. */
export async function conferenceOrderStatus(token: string): Promise<OrderStatus | null> {
  const o = await loadOrder({ token });
  return o ? (o.status as OrderStatus) : null;
}

/** The iframe said the charge went through - the order moves to "לאימות" until Nedarim's callback confirms. */
export async function reportConferencePaid(token: string): Promise<OrderStatus | null> {
  return reportConferencePaymentFromBrowser(token);
}
