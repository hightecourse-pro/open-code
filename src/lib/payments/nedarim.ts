import type { Plan } from "./plans";
import type { SubscriptionPlan } from "@/types/database";

/**
 * Nedarim Plus (נדרים פלוס) adapter.
 *
 * Integration model: an embedded iframe drives the card form and communicates
 * with the parent window via postMessage; Nedarim also POSTs a server-side
 * "CallBack" with the final result, which is our source of truth.
 *
 * ⚠️ Field names below follow the documented Nedarim iframe protocol. Confirm
 * the exact keys against your Mosad account / Nedarim docs before going live.
 */

export const NEDARIM_IFRAME_URL = "https://www.matara.pro/nedarimplus/iframe/";

export function getNedarimConfig() {
  const mosadId = process.env.NEDARIM_MOSAD_ID;
  const apiValid = process.env.NEDARIM_API_VALID;
  if (!mosadId || !apiValid) return null;
  return { mosadId, apiValid };
}

export function isNedarimConfigured(): boolean {
  return getNedarimConfig() !== null;
}

export interface TransactionParty {
  profileId: string;
  fullName: string;
  email: string;
}

/**
 * The `Value` payload for the iframe's `FinishTransaction2` postMessage.
 * PaymentType 'HK' = הוראת קבע (recurring); Currency '1' = ILS.
 * We round-trip our identifiers via Param1 (profileId) and Param2 (plan).
 */
export function buildTransactionFields(
  plan: Plan,
  party: TransactionParty,
  callbackUrl: string
) {
  const cfg = getNedarimConfig();
  if (!cfg) throw new Error("Nedarim is not configured");

  return {
    Mosad: cfg.mosadId,
    ApiValid: cfg.apiValid,
    PaymentType: "HK", // recurring standing order
    Currency: "1", // ILS
    Amount: (plan.amountAgorot / 100).toFixed(2),
    Tashlumim: "1",
    FirstName: party.fullName,
    LastName: "",
    Mail: party.email,
    Comment: `מנוי ${plan.label} — קוד פתוח`,
    CallBack: callbackUrl,
    Param1: party.profileId,
    Param2: plan.id,
  };
}

export interface ParsedCallback {
  ok: boolean;
  profileId: string | null;
  plan: SubscriptionPlan | null;
  transactionId: string | null;
  amountAgorot: number | null;
}

/** Parse the server-to-server CallBack POST from Nedarim. */
export function parseNedarimCallback(params: Record<string, string>): ParsedCallback {
  const status = (params.Status ?? params.status ?? "").toLowerCase();
  const planRaw = params.Param2 ?? null;
  const plan: SubscriptionPlan | null =
    planRaw === "monthly" || planRaw === "annual" ? planRaw : null;
  const amount = params.Amount ? Math.round(parseFloat(params.Amount) * 100) : null;

  return {
    ok: status === "ok" || status === "success" || params.Status === "1",
    profileId: params.Param1 ?? null,
    plan,
    // Nedarim's iframe callback uses "ID" for the transaction id.
    transactionId: params.TransactionId ?? params.transactionId ?? params.ID ?? null,
    amountAgorot: Number.isFinite(amount) ? amount : null,
  };
}
