import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { isProductionEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { sendResendEmail } from "@/lib/email/resend";
import { getNedarimConfig } from "@/lib/payments/nedarim";
import { appendRows, readSheet, sheetTabs, SheetsError, writeCell, writeRowAt } from "@/lib/google-sheets";
import { conferenceConfirmationEmail, conferenceTeamEmail, type MailOrder } from "@/lib/conference-mail";
import {
  CONFERENCE_GROUPE,
  CONFERENCE_KEY,
  CONFERENCE_PARAM2,
  PRICE,
  SHEET_COLUMNS,
  STATUS_LABEL,
  normalizeContact,
  normalizeParticipant,
  nis,
  orderTotal,
  sheetPaymentLabel,
  unitPrice,
  validateContact,
  validateParticipant,
  type OrderInput,
  type OrderStatus,
  type PaymentMethod,
  type SheetColumn,
} from "@/lib/conference-shared";
import type { Database } from "@/types/database";

/**
 * Hightecourse 2026, the third day - the server side of the public
 * registration (the owner, 17/11): the order and its participants in the
 * database, the rows in her Google Sheet (״רישום ליום השלישי״), the mails, and
 * the Nedarim payment (our own account's iframe, a one-time charge) with its
 * callback. The pure parts live in conference-shared.ts.
 */
export const DEFAULT_SHEET_ID = "1BxESshcVp_jroYkNvVzLfGWMBFRPqzsYJFCERh4DZ1c";

/** The owner's sheet by default; staging points CONFERENCE_SHEET_ID at a test copy. */
export function conferenceSheetId(): string {
  return process.env.CONFERENCE_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
}
export function conferenceSheetTab(): string | null {
  return process.env.CONFERENCE_SHEET_TAB?.trim() || null;
}
export function sheetUrlOf(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
/** Who hears about every registration (office@ by default - it is read inside the admin). */
export function conferenceNotifyEmail(): string {
  return process.env.CONFERENCE_NOTIFY_EMAIL?.trim() || "office@opencode.org.il";
}

export type OrderRow = Database["public"]["Tables"]["conference_orders"]["Row"];
export type ParticipantRow = Database["public"]["Tables"]["conference_participants"]["Row"];
export interface OrderWithParticipants extends OrderRow {
  participants: ParticipantRow[];
}

/** "HC-7K3F9Q" - read over the phone, planted in the Nedarim payment comment. */
export function newShortCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (const b of crypto.getRandomValues(new Uint8Array(6))) out += alphabet[b % alphabet.length];
  return `HC-${out}`;
}
export function newPayToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const SHORT_CODE_RE = /HC-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/;
const TOKEN_RE = /^[0-9a-f]{32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadOrder(where: { id?: string; token?: string }): Promise<OrderWithParticipants | null> {
  const admin = createAdminClient();
  let q = admin.from("conference_orders").select("*").eq("event_key", CONFERENCE_KEY);
  if (where.id) {
    if (!UUID_RE.test(where.id)) return null;
    q = q.eq("id", where.id);
  } else if (where.token) {
    if (!TOKEN_RE.test(where.token)) return null;
    q = q.eq("pay_token", where.token);
  } else return null;
  const { data: order } = await q.maybeSingle();
  if (!order) return null;
  const { data: parts } = await admin.from("conference_participants").select("*").eq("order_id", order.id).order("seq", { ascending: true });
  return { ...(order as OrderRow), participants: (parts ?? []) as ParticipantRow[] };
}

// ------------------------------------------------------------ the order
export type CreateOrderResult = { ok: true; id: string; token: string; status: OrderStatus; paymentMethod: PaymentMethod } | { ok: false; error: string };

const SAVE_ERROR = "לא הצלחנו לשמור את ההרשמה. נסי שוב בעוד רגע, או כתבי לנו ל-office@hightecourse.com.";

/** The public form's submit: validate again, store the order and its participants, and for a bank transfer finish on the spot. */
export async function createConferenceOrder(raw: OrderInput): Promise<CreateOrderResult> {
  if (raw.website) return { ok: true, id: "", token: newPayToken(), status: "awaiting_transfer", paymentMethod: "transfer" };
  const kind = raw.kind === "group" ? "group" : raw.kind === "single" ? "single" : null;
  const method = raw.paymentMethod === "credit" ? "credit" : raw.paymentMethod === "transfer" ? "transfer" : null;
  if (!kind || !method) return { ok: false, error: "בחרי סוג הרשמה ואופן תשלום." };
  const list = Array.isArray(raw.participants) ? raw.participants : [];
  if (kind === "single" && list.length !== 1) return { ok: false, error: "הרשמת משתתפת יחידה היא למשתתפת אחת." };
  if (kind === "group" && (list.length < 1 || list.length > 60)) return { ok: false, error: "קבוצה היא בין משתתפת אחת ל-60." };
  const contact = kind === "group" ? normalizeContact(raw.contact ?? { company: "", contactName: "", contactEmail: "", invoiceName: "", companyId: "" }) : null;
  if (contact) {
    const ce = validateContact(contact);
    const first = Object.values(ce)[0];
    if (first) return { ok: false, error: `חסר בפרטי הקבוצה: ${first}.` };
  }
  const participants = list.map((p) => normalizeParticipant(p, contact ? contact.company : undefined));
  for (let i = 0; i < participants.length; i++) {
    const pe = validateParticipant(participants[i], { needsCompany: kind === "single" });
    const first = Object.values(pe)[0];
    if (first) return { ok: false, error: `${participants.length > 1 ? `משתתפת ${i + 1}: ` : ""}חסר ${first}.` };
  }
  const ids = new Set<string>();
  for (const p of participants) {
    if (ids.has(p.nationalId)) return { ok: false, error: `תעודת הזהות ${p.nationalId} מופיעה פעמיים.` };
    ids.add(p.nationalId);
  }
  const note = (raw.note ?? "").trim().slice(0, 500) || null;

  const count = participants.length;
  const unit = unitPrice(kind, count);
  const amount = orderTotal(kind, count);
  const admin = createAdminClient();
  const shortCode = newShortCode();
  const token = newPayToken();
  const status: OrderStatus = method === "credit" ? "pending" : "awaiting_transfer";
  const { data: order, error } = await admin
    .from("conference_orders")
    .insert({
      event_key: CONFERENCE_KEY,
      short_code: shortCode,
      pay_token: token,
      kind,
      company: contact?.company ?? participants[0].company ?? null,
      contact_name: contact?.contactName ?? null,
      contact_email: contact?.contactEmail ?? null,
      invoice_name: contact?.invoiceName ?? null,
      company_id: contact?.companyId ?? null,
      payment_method: method,
      note,
      participant_count: count,
      unit_price_nis: unit,
      amount_nis: amount,
      status,
    })
    .select("id")
    .single();
  if (error || !order) return { ok: false, error: SAVE_ERROR };
  const { error: pErr } = await admin.from("conference_participants").insert(
    participants.map((p, i) => ({
      order_id: order.id,
      seq: i + 1,
      national_id: p.nationalId,
      first_name: p.firstName,
      last_name: p.lastName,
      personal_email: p.personalEmail,
      work_email: p.workEmail || null,
      phone: p.phone,
      role_title: p.roleTitle || null,
      department: p.department || null,
      company: p.company || null,
    }))
  );
  if (pErr) {
    await admin.from("conference_orders").delete().eq("id", order.id);
    return { ok: false, error: SAVE_ERROR };
  }

  // A bank transfer is complete as a registration right now: the sheet, her
  // confirmation ("the invoice follows by mail"), the team. Credit waits for
  // the charge.
  if (method === "transfer") {
    const full = await loadOrder({ id: order.id });
    if (full) await completeRegistration(full, "registered");
  }
  return { ok: true, id: order.id, token, status, paymentMethod: method };
}

/** Everything a finished registration triggers - each step on its own, none blocks the others. */
async function completeRegistration(order: OrderWithParticipants, event: "registered" | "paid" | "reported") {
  await syncOrderToSheet(order.id);
  await sendConferenceConfirmationOnce(order);
  await notifyTeam(order, event);
}

// ------------------------------------------------------------ payment
/**
 * The iframe fields for a one-time charge on OUR Nedarim account (PaymentType
 * "Ragil"): the order id rides in Param1 and the event in Param2 so the
 * callback can find the order; the short code sits in the comment so a human
 * can match it in the Nedarim report too.
 */
export function buildConferencePaymentFields(order: OrderWithParticipants, origin: string): Record<string, string> | null {
  const cfg = getNedarimConfig();
  if (!cfg) return null;
  const p1 = order.participants[0];
  const payerName = order.kind === "group" ? (order.contact_name ?? order.company ?? "") : `${p1?.first_name ?? ""} ${p1?.last_name ?? ""}`.trim();
  const payerEmail = order.kind === "group" ? (order.contact_email ?? p1?.personal_email ?? "") : (p1?.personal_email ?? "");
  return {
    Mosad: cfg.mosadId,
    ApiValid: cfg.apiValid,
    PaymentType: "Ragil",
    Currency: "1",
    Amount: order.amount_nis.toFixed(2),
    Tashlumim: "1",
    FirstName: payerName,
    LastName: "",
    Mail: payerEmail,
    Phone: p1?.phone ?? "",
    Zeout: order.kind === "single" ? (p1?.national_id ?? "") : "",
    Street: "",
    Adresse: "",
    City: "",
    Groupe: CONFERENCE_GROUPE,
    Category: CONFERENCE_GROUPE,
    Comment: `${CONFERENCE_GROUPE} · ${order.short_code} · ${order.participant_count} משתתפות`,
    CallBack: `${origin.replace(/\/$/, "")}/api/webhooks/payments`,
    Param1: order.id,
    Param2: CONFERENCE_PARAM2,
  };
}

/** Is this Nedarim callback a conference charge? Param2 names the event; the report's category is the fallback. */
export function isConferenceCallback(params: Record<string, string>): boolean {
  if ((params.Param2 ?? "").trim() === CONFERENCE_PARAM2) return true;
  const groupe = (params.Groupe ?? params.Category ?? "").trim();
  return !!groupe && groupe === CONFERENCE_GROUPE;
}

function who(o: OrderWithParticipants): string {
  const p1 = o.participants[0];
  return o.kind === "group" ? `${o.company ?? ""} (${o.participant_count} משתתפות)` : `${p1?.first_name ?? ""} ${p1?.last_name ?? ""}`.trim();
}

/** A charge found its order (the callback, or the admin by hand): paid ✓, the sheet, her confirmation, the team. */
export async function markConferenceOrderPaid(
  order: OrderWithParticipants,
  pay: { transactionId: string | null; amountAgorot: number | null; by: "callback" | "manual" }
): Promise<"paid" | "paid_again"> {
  const admin = createAdminClient();
  const already = order.status === "paid";
  const now = new Date().toISOString();
  await admin
    .from("conference_orders")
    .update({
      status: "paid",
      paid_at: already ? order.paid_at : now,
      updated_at: now,
      ...(already && order.nedarim_transaction_id ? {} : { nedarim_transaction_id: pay.transactionId, payment_amount_agorot: pay.amountAgorot }),
    })
    .eq("id", order.id);
  const fresh = (await loadOrder({ id: order.id })) ?? { ...order, status: "paid" as const };
  await syncOrderToSheet(fresh.id);
  await updateSheetPaymentCells(fresh);
  await sendConferenceConfirmationOnce(fresh);
  if (!already) {
    await notifyTeam(fresh, "paid");
    const expected = order.amount_nis * 100;
    const mismatch = pay.amountAgorot != null && pay.amountAgorot !== expected;
    await raiseAlert({
      kind: "conference_paid",
      severity: mismatch ? "warning" : "info",
      title: `שולם לכנס הייטקורס: ${who(order)} · ${nis((pay.amountAgorot ?? expected) / 100)} ₪`,
      body: `${order.kind === "group" ? `איש קשר ${order.contact_name ?? ""} · ${order.contact_email ?? ""}` : `${order.participants[0]?.personal_email ?? ""} · ${order.participants[0]?.phone ?? ""}`} · מספר הרשמה ${order.short_code} · ${pay.by === "manual" ? "סומן ידנית במסך הנרשמות" : `אסמכתא נדרים ${pay.transactionId ?? "-"}`}.${
        mismatch ? ` שימי לב: הסכום שנגבה (${nis((pay.amountAgorot ?? 0) / 100)} ₪) שונה מהסכום להרשמה (${nis(order.amount_nis)} ₪).` : ""
      }`,
      context: { orderId: order.id, transactionId: pay.transactionId, amountAgorot: pay.amountAgorot },
      dedupeKey: `conference-paid:${order.id}`,
    });
  }
  return already ? "paid_again" : "paid";
}

/** The payment iframe told the browser the charge went through - before the callback did. */
export async function reportConferencePaymentFromBrowser(token: string): Promise<OrderStatus | null> {
  const order = await loadOrder({ token });
  if (!order) return null;
  if (order.status !== "pending") return order.status as OrderStatus;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: moved } = await admin
    .from("conference_orders")
    .update({ status: "paid_reported", payment_reported_at: now, updated_at: now })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!moved?.length) return ((await loadOrder({ id: order.id }))?.status as OrderStatus | undefined) ?? "paid_reported";
  const fresh = (await loadOrder({ id: order.id })) ?? { ...order, status: "paid_reported" as const };
  await completeRegistration(fresh, "reported");
  await raiseAlert({
    kind: "conference_payment_reported",
    severity: "info",
    title: `חזרה מדף התשלום לכנס הייטקורס: ${who(order)} (${order.short_code})`,
    body: `דף התשלום דיווח הצלחה על ${nis(order.amount_nis)} ₪, הקולבק של נדרים עוד לא דיווח. אם לא יגיע תוך כמה דקות - לאמת מול נדרים ולסמן ״שולם ✓״ במסך הנרשמות.`,
    dedupeKey: `conference-reported:${order.id}`,
  });
  return "paid_reported";
}

export type ConferencePaymentOutcome =
  | "conference_paid"
  | "conference_paid_again"
  | "conference_duplicate"
  | "conference_unverified_noted"
  | "conference_refund_noted"
  | "conference_unknown_order"
  | "conference_forwarded_to_staging";

/**
 * A Nedarim callback for the conference (Param2 = the event). Verified callers
 * (Nedarim's address or the shared secret) mark the order paid; an unverified
 * one only moves it to "לאימות" for the admin.
 */
export async function recordConferencePayment(
  params: Record<string, string>,
  tx: { transactionId: string; amountAgorot: number | null },
  opts: { verified: boolean }
): Promise<ConferencePaymentOutcome> {
  const byId = UUID_RE.test(params.Param1 ?? "") ? await loadOrder({ id: params.Param1 }) : null;
  let order = byId;
  if (!order) {
    const code = `${params.Comments ?? ""} ${params.Comment ?? ""}`.toUpperCase().match(SHORT_CODE_RE)?.[0];
    if (code) {
      const { data } = await createAdminClient().from("conference_orders").select("id").eq("short_code", code).maybeSingle();
      if (data) order = await loadOrder({ id: data.id });
    }
  }
  if (!order) {
    // One Nedarim account, one callback URL (production): a staging test's
    // charge lands here with an order id production never saw - hand it over once.
    const fwdUrl = process.env.STAGING_WEBHOOK_URL;
    const fwdKey = process.env.STAGING_FORWARD_KEY;
    if (isProductionEnv() && fwdUrl && fwdKey && opts.verified) {
      try {
        const res = await fetch(`${fwdUrl}?key=${encodeURIComponent(fwdKey)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (res.ok && data?.ok) return "conference_forwarded_to_staging";
      } catch {
        /* fall through to the alert */
      }
    }
    await raiseAlert({
      kind: "conference_payment_unmatched",
      severity: "warning",
      title: `תשלום לכנס הייטקורס בלי הרשמה תואמת: ${params.ClientName ?? params.Mail ?? "ללא שם"} · ${nis((tx.amountAgorot ?? 0) / 100)} ₪`,
      body: `הגיע מנדרים עם קטגוריית הכנס אבל בלי הרשמה שמתאימה (Param1 ${params.Param1 ?? "-"}). אסמכתא ${tx.transactionId}. לבדוק במסך הנרשמות ולסמן ידנית.`,
      context: { params },
      dedupeKey: `conference-unmatched:${tx.transactionId}`,
    });
    return "conference_unknown_order";
  }
  if (tx.amountAgorot !== null && tx.amountAgorot < 0) {
    await raiseAlert({
      kind: "conference_refund",
      severity: "warning",
      title: `זיכוי על הרשמה לכנס הייטקורס: ${who(order)} · ${nis(tx.amountAgorot / 100)} ₪`,
      body: `נדרים דיווחו על זיכוי להרשמה ${order.short_code}. ההרשמה לא שונתה - לבטל אותה במסך הנרשמות אם זה מה שקרה.`,
      context: { params, orderId: order.id },
      dedupeKey: `conference-refund:${tx.transactionId}`,
    });
    return "conference_refund_noted";
  }
  if (!opts.verified) {
    if (order.status === "paid") return "conference_duplicate";
    await reportConferencePaymentFromBrowser(order.pay_token);
    return "conference_unverified_noted";
  }
  if (order.status === "paid" && order.nedarim_transaction_id === tx.transactionId) return "conference_duplicate";
  const r = await markConferenceOrderPaid(order, { transactionId: tx.transactionId, amountAgorot: tx.amountAgorot, by: "callback" });
  return r === "paid" ? "conference_paid" : "conference_paid_again";
}

// ------------------------------------------------------------ the sheet
/** ״26.11.2026״ / ״14:05״ in Israel time. */
function israelStamp(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("day")}.${get("month")}.${get("year")}`, time: `${get("hour")}:${get("minute")}` };
}

async function resolveTab(sheetId: string): Promise<string> {
  const fixed = conferenceSheetTab();
  if (fixed) return fixed;
  const tabs = await sheetTabs(sheetId);
  if (!tabs.length) throw new SheetsError("no tabs", 400, "no_tab");
  return tabs[0];
}

/** Row 1 holds the owner's headers; a column she does not have yet is added at the end. */
async function headerIndex(sheetId: string, tab: string, rows: string[][]): Promise<{ header: string[]; idx: Map<SheetColumn, number> }> {
  const header = rows[0] ? rows[0].map((h) => h.trim()) : [];
  const idx = new Map<SheetColumn, number>();
  let changed = false;
  for (const col of SHEET_COLUMNS) {
    let i = header.indexOf(col);
    if (i < 0) {
      header.push(col);
      i = header.length - 1;
      changed = true;
    }
    idx.set(col, i);
  }
  if (changed) await writeRowAt(sheetId, tab, 1, header);
  return { header, idx };
}

function participantRow(o: OrderWithParticipants, p: ParticipantRow, serial: number, width: number, idx: Map<SheetColumn, number>): (string | number)[] {
  const row: (string | number)[] = new Array(width).fill("");
  const set = (col: SheetColumn, v: string | number) => {
    const i = idx.get(col);
    if (i !== undefined) row[i] = v;
  };
  const stamp = israelStamp(o.created_at);
  set("מס", serial);
  set("ת.ז.", p.national_id);
  set("שם פרטי", p.first_name);
  set("שם משפחה", p.last_name);
  set("מייל פרטי", p.personal_email);
  set("מייל עבודה", p.work_email ?? "");
  set("נייד", p.phone);
  set("תפקיד", p.role_title ?? "");
  set("משרד", p.department ?? "");
  set("חברה", (o.kind === "group" ? o.company : p.company) ?? "");
  set("אופן תשלום", sheetPaymentLabel(o.payment_method as PaymentMethod, o.status as OrderStatus));
  set("הערה", o.note ?? "");
  set("איש קשר", o.kind === "group" ? (o.contact_name ?? "") : "");
  set("מייל איש קשר", o.kind === "group" ? (o.contact_email ?? "") : "");
  set("חשבונית על שם", o.kind === "group" ? (o.invoice_name ?? "") : "");
  set("ח.פ.", o.kind === "group" ? (o.company_id ?? "") : "");
  set("תאריך רישום", stamp.date);
  set("שעת רישום", stamp.time);
  set("סכום לתשלום", o.unit_price_nis);
  return row;
}

/**
 * Appends the order's participants to the sheet, once. The claim is atomic
 * (the browser report and the callback can both arrive); a failed append
 * releases it and leaves the reason on the order for the admin's retry.
 */
export async function syncOrderToSheet(orderId: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("conference_orders")
    .update({ sheet_synced_at: new Date().toISOString(), sheet_error: null })
    .eq("id", orderId)
    .is("sheet_synced_at", null)
    .select("id");
  if (!claimed?.length) return { ok: true, skipped: true };
  const order = await loadOrder({ id: orderId });
  if (!order) return { ok: false, error: "order_not_found" };
  try {
    const sheetId = conferenceSheetId();
    const tab = await resolveTab(sheetId);
    const rows = await readSheet(sheetId, tab);
    const { header, idx } = await headerIndex(sheetId, tab, rows);
    const existing = Math.max(0, rows.length - 1);
    const values = order.participants.map((p, i) => participantRow(order, p, existing + i + 1, header.length, idx));
    const { startRow } = await appendRows(sheetId, tab, values);
    if (startRow) {
      for (let i = 0; i < order.participants.length; i++) {
        await admin.from("conference_participants").update({ sheet_row: startRow + i }).eq("id", order.participants[i].id);
      }
    }
    return { ok: true };
  } catch (e) {
    const msg = (e instanceof SheetsError ? `${e.hint}: ${e.message}` : e instanceof Error ? e.message : String(e)).slice(0, 500);
    await admin.from("conference_orders").update({ sheet_synced_at: null, sheet_error: msg }).eq("id", orderId);
    await raiseAlert({
      kind: "conference_sheet_failed",
      severity: "warning",
      title: `הרשמה לכנס הייטקורס לא נכתבה לגיליון: ${who(order)}`,
      body: `ההרשמה (${order.short_code}) שמורה אצלנו, אבל הכתיבה ל-Google Sheets נכשלה: ${msg}. במסך הנרשמות יש ״לכתוב לגיליון שוב״.`,
      context: { orderId, error: msg },
      dedupeKey: `conference-sheet:${orderId}`,
    });
    return { ok: false, error: msg };
  }
}

/** A later status change (paid, canceled) is written back into the rows' ״אופן תשלום״ cells. Best-effort. */
export async function updateSheetPaymentCells(order: OrderWithParticipants): Promise<void> {
  const rowsToTouch = order.participants.filter((p) => p.sheet_row);
  if (!rowsToTouch.length) return;
  try {
    const sheetId = conferenceSheetId();
    const tab = await resolveTab(sheetId);
    const rows = await readSheet(sheetId, tab);
    const col = (rows[0] ?? []).map((h) => h.trim()).indexOf("אופן תשלום");
    if (col < 0) return;
    const label = sheetPaymentLabel(order.payment_method as PaymentMethod, order.status as OrderStatus);
    for (const p of rowsToTouch) await writeCell(sheetId, tab, p.sheet_row as number, col, label);
  } catch {
    /* the sheet is a copy; the database is the record */
  }
}

// ------------------------------------------------------------ mail
export function toMailOrder(o: OrderWithParticipants): MailOrder {
  return {
    kind: o.kind as "single" | "group",
    shortCode: o.short_code,
    paymentMethod: o.payment_method as PaymentMethod,
    paid: o.status === "paid",
    amountNis: o.amount_nis,
    unitPriceNis: o.unit_price_nis,
    participantCount: o.participant_count,
    company: o.company,
    contactName: o.contact_name,
    contactEmail: o.contact_email,
    invoiceName: o.invoice_name,
    companyId: o.company_id,
    note: o.note,
    participants: o.participants.map((p) => ({ firstName: p.first_name, lastName: p.last_name, personalEmail: p.personal_email, phone: p.phone, roleTitle: p.role_title, department: p.department, company: p.company })),
    payToken: o.pay_token,
  };
}

/** Her confirmation goes out exactly once - whichever path gets there first. */
export async function sendConferenceConfirmationOnce(order: OrderWithParticipants): Promise<boolean> {
  const to = order.kind === "group" ? order.contact_email : order.participants[0]?.personal_email;
  if (!to) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("conference_orders")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("confirmation_email_sent_at", null)
    .select("id");
  if (!data?.length) return false;
  try {
    const mail = conferenceConfirmationEmail(toMailOrder(order));
    await sendResendEmail({ to, subject: mail.subject, html: mail.html, essential: true, fromName: "הייטקורס" });
  } catch {
    /* best-effort */
  }
  return true;
}

async function notifyTeam(order: OrderWithParticipants, event: "registered" | "paid" | "reported"): Promise<void> {
  try {
    const mail = conferenceTeamEmail(toMailOrder(order), event);
    await sendEmail({ to: conferenceNotifyEmail(), subject: mail.subject, html: mail.html });
  } catch {
    /* best-effort */
  }
  if (event === "registered") {
    try {
      await raiseAlert({
        kind: "conference_registration",
        severity: "info",
        title: `הרשמה ליום חמישי של הייטקורס: ${who(order)} · ${nis(order.amount_nis)} ₪`,
        body: `${order.kind === "group" ? `איש קשר ${order.contact_name ?? ""} · ${order.contact_email ?? ""} · חשבונית על שם ${order.invoice_name ?? ""}` : `${order.participants[0]?.personal_email ?? ""} · ${order.participants[0]?.phone ?? ""}`} · ${STATUS_LABEL[order.status as OrderStatus]} · מספר הרשמה ${order.short_code}.${order.payment_method === "transfer" ? " לשלוח לה חשבונית במייל." : ""}`,
        dedupeKey: `conference-registration:${order.id}`,
      });
    } catch {
      /* best-effort */
    }
  }
}

/** The admin's summary numbers. */
export function priceNote(): string {
  return `משתתפת יחידה ${PRICE.single} ₪ · קבוצה של ${PRICE.groupMin} ומעלה ${PRICE.group} ₪ למשתתפת`;
}
