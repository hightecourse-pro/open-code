import { isValidIsraeliId } from "@/lib/validators";

/**
 * Hightecourse 2026, the third day - the public registration (the owner,
 * 17/11). Constants, prices and the pure validators, shared by the public
 * pages (client), the server actions and the admin. No server imports here.
 */
export const CONFERENCE_KEY = "hightecourse-2026-day3";
/** Param2 of the Nedarim transaction and the קטגוריה on its report - how the callback is told apart. */
export const CONFERENCE_PARAM2 = CONFERENCE_KEY;
export const CONFERENCE_GROUPE = "הייטקורס 2026 - יום חמישי";
export const CONFERENCE_TITLE = "הייטקורס 2026";
export const CONFERENCE_SUBTITLE = "כשחדשנות פוגשת אווירה";

export const DAY = {
  label: "יום חמישי",
  date: "26.11.2026",
  dateSlash: "26/11/2026",
  hebrew: "ט״ז בכסלו תשפ״ז",
  /** Doors open (the program's 08:00), Israel time. */
  startIso: "2026-11-26T08:00:00+02:00",
  endIso: "2026-11-26T17:00:00+02:00",
} as const;

/** The owner's prices (17/11): a single participant 650; a group of more than 3 - 500 each. */
export const PRICE = { single: 650, group: 500, groupMin: 4 } as const;

export const PATHS = {
  landing: "/hightecourse-2026",
  register: "/hightecourse-2026/register",
  pay: "/hightecourse-2026/pay",
  done: "/hightecourse-2026/done",
  admin: "/admin/hightecourse",
} as const;

export const CONTACT_EMAIL = "office@hightecourse.com";

export type OrderKind = "single" | "group";
export type PaymentMethod = "credit" | "transfer";
export type OrderStatus = "pending" | "paid_reported" | "paid" | "awaiting_transfer" | "canceled";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  credit: "כרטיס אשראי",
  transfer: "העברה בנקאית מול חשבונית",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "באשראי - לא שולם עדיין",
  paid_reported: "חזרה מדף התשלום - לאימות",
  paid: "שולם ✓",
  awaiting_transfer: "העברה בנקאית - ממתינה לתשלום",
  canceled: "בוטל",
};

/** What the sheet's ״אופן תשלום״ cell says for an order in this state. */
export function sheetPaymentLabel(method: PaymentMethod, status: OrderStatus): string {
  if (status === "canceled") return "בוטל";
  if (method === "credit") return status === "paid" ? "אשראי - שולם" : status === "paid_reported" ? "אשראי - לאימות" : "אשראי - לא שולם";
  return status === "paid" ? "העברה בנקאית - שולם" : "העברה בנקאית - החשבונית תישלח במייל";
}

export function unitPrice(kind: OrderKind, count: number): number {
  return kind === "group" && count >= PRICE.groupMin ? PRICE.group : PRICE.single;
}

export function orderTotal(kind: OrderKind, count: number): number {
  return unitPrice(kind, count) * Math.max(1, count);
}

export const nis = (n: number) => new Intl.NumberFormat("he-IL").format(n);

export interface ParticipantInput {
  nationalId: string;
  firstName: string;
  lastName: string;
  personalEmail: string;
  workEmail: string;
  phone: string;
  roleTitle: string;
  department: string;
  /** Asked only for a single participant; a group's rows take the order's company. */
  company: string;
}

export interface ContactInput {
  company: string;
  contactName: string;
  contactEmail: string;
  invoiceName: string;
  companyId: string;
}

export interface OrderInput {
  kind: OrderKind;
  paymentMethod: PaymentMethod;
  note: string;
  participants: ParticipantInput[];
  contact?: ContactInput;
  /** Honeypot - real people leave it empty. */
  website?: string;
}

export const emptyParticipant = (): ParticipantInput => ({
  nationalId: "",
  firstName: "",
  lastName: "",
  personalEmail: "",
  workEmail: "",
  phone: "",
  roleTitle: "",
  department: "",
  company: "",
});

export const emptyContact = (): ContactInput => ({ company: "", contactName: "", contactEmail: "", invoiceName: "", companyId: "" });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const clean = (s: string) => (s ?? "").trim().replace(/\s+/g, " ");
export const normEmail = (s: string) => clean(s).toLowerCase();
export const digits = (s: string) => (s ?? "").replace(/\D/g, "");

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validateParticipant(p: ParticipantInput, opts: { needsCompany: boolean }): FieldErrors<ParticipantInput> {
  const e: FieldErrors<ParticipantInput> = {};
  const id = digits(p.nationalId);
  if (!id) e.nationalId = "מספר תעודת זהות";
  else if (!isValidIsraeliId(id)) e.nationalId = "מספר תעודת הזהות לא תקין";
  if (clean(p.firstName).length < 2 || clean(p.firstName).length > 40) e.firstName = "שם פרטי";
  if (clean(p.lastName).length < 2 || clean(p.lastName).length > 40) e.lastName = "שם משפחה";
  if (!EMAIL_RE.test(normEmail(p.personalEmail))) e.personalEmail = "כתובת מייל תקינה";
  if (clean(p.workEmail) && !EMAIL_RE.test(normEmail(p.workEmail))) e.workEmail = "כתובת המייל לא נראית תקינה";
  const ph = digits(p.phone);
  if (!/^0\d{8,9}$/.test(ph)) e.phone = "מספר נייד תקין (למשל 052-1234567)";
  if (!clean(p.roleTitle) || clean(p.roleTitle).length > 80) e.roleTitle = "תפקיד";
  if (!clean(p.department) || clean(p.department).length > 80) e.department = "משרד";
  if (opts.needsCompany && (!clean(p.company) || clean(p.company).length > 80)) e.company = "חברה";
  return e;
}

export function validateContact(c: ContactInput): FieldErrors<ContactInput> {
  const e: FieldErrors<ContactInput> = {};
  if (!clean(c.company) || clean(c.company).length > 80) e.company = "שם החברה";
  if (clean(c.contactName).length < 2 || clean(c.contactName).length > 60) e.contactName = "שם איש הקשר";
  if (!EMAIL_RE.test(normEmail(c.contactEmail))) e.contactEmail = "כתובת מייל תקינה של איש הקשר";
  if (!clean(c.invoiceName) || clean(c.invoiceName).length > 100) e.invoiceName = "על שם מי להוציא את החשבונית";
  const cid = digits(c.companyId);
  if (cid.length < 5 || cid.length > 12) e.companyId = "מספר ח.פ. (ספרות)";
  return e;
}

export function normalizeParticipant(p: ParticipantInput, company?: string): ParticipantInput {
  return {
    nationalId: digits(p.nationalId),
    firstName: clean(p.firstName),
    lastName: clean(p.lastName),
    personalEmail: normEmail(p.personalEmail),
    workEmail: normEmail(p.workEmail),
    phone: digits(p.phone),
    roleTitle: clean(p.roleTitle),
    department: clean(p.department),
    company: company !== undefined ? clean(company) : clean(p.company),
  };
}

export function normalizeContact(c: ContactInput): ContactInput {
  return { company: clean(c.company), contactName: clean(c.contactName), contactEmail: normEmail(c.contactEmail), invoiceName: clean(c.invoiceName), companyId: digits(c.companyId) };
}

/** The Google Sheet's columns, in the owner's order and wording (17/11). */
export const SHEET_COLUMNS = [
  "מס",
  "ת.ז.",
  "שם פרטי",
  "שם משפחה",
  "מייל פרטי",
  "מייל עבודה",
  "נייד",
  "תפקיד",
  "משרד",
  "חברה",
  "אופן תשלום",
  "הערה",
  "איש קשר",
  "מייל איש קשר",
  "חשבונית על שם",
  "ח.פ.",
  "תאריך רישום",
  "שעת רישום",
  "סכום לתשלום",
] as const;
export type SheetColumn = (typeof SHEET_COLUMNS)[number];
