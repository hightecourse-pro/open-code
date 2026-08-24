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
/** The only window allowed to exchange postMessages with the checkout. */
export const NEDARIM_ORIGIN = "https://www.matara.pro";

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
  /** Nedarim requires a phone on every transaction ("נא לציין מספר טלפון"). */
  phone: string;
  /** תעודת זהות — reported to Nedarim (מספר זהות on the receipt). */
  idNumber: string;
  /** Street + house number, when she already answered the questionnaire. */
  street: string;
  city: string;
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
    // For a standing order, Tashlumim is the NUMBER OF CHARGES — "1" made
    // every order a single-payment one (the owner saw exactly that in the
    // Nedarim console: "תשלום אחד ולא ללא הגבלה"). Empty = unlimited, which
    // is what a monthly membership is.
    Tashlumim: "",
    FirstName: party.fullName,
    LastName: "",
    Mail: party.email,
    Phone: party.phone,
    Zeout: party.idNumber,
    // Nedarim's docs vary between Street/Adresse — send both, extras are ignored.
    Street: party.street,
    Adresse: party.street,
    City: party.city,
    // The report's קטגוריה — the owner's fixed wording; the plan itself rides
    // in Param2 (and the amount). Comment stays empty, like her reference.
    Groupe: "דמי מנוי - קהילת קוד פתוח",
    Category: "דמי מנוי - קהילת קוד פתוח",
    Comment: "",
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
  const statusRaw = params.Status ?? params.status;
  const status = (statusRaw ?? "").toLowerCase();
  const planRaw = params.Param2 ?? null;
  const plan: SubscriptionPlan | null =
    planRaw === "monthly" || planRaw === "annual" ? planRaw : null;
  const amount = params.Amount ? Math.round(parseFloat(params.Amount) * 100) : null;

  const txId = params.TransactionId ?? params.transactionId ?? params.ID ?? null;
  // הקמת הוראת קבע events carry KevaId instead of a transaction id — observed
  // live 2026-08-24. Prefixed so a keva row can never collide with a charge.
  const kevaId = params.KevaId?.trim() || null;

  return {
    // The account-level webhooks (עדכוני עסקאות / הקמת הוראת קבע) fire on
    // SUCCESS only and carry NO Status field at all — its absence on a call
    // that names a transaction or keva IS the success signal (observed live).
    // Refusals arrive on the separate declines webhook WITH status fields,
    // and anything carrying a non-ok status stays not-ok.
    ok:
      status === "ok" ||
      status === "success" ||
      params.Status === "1" ||
      (statusRaw === undefined && !!(txId ?? kevaId)),
    profileId: params.Param1 ?? null,
    plan,
    transactionId: txId ?? (kevaId ? `keva-${kevaId}` : null),
    amountAgorot: Number.isFinite(amount) ? amount : null,
  };
}
