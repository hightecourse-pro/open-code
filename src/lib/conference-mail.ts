import { getSiteUrl } from "@/lib/site";
import { CONFERENCE_SUBTITLE, CONFERENCE_TITLE, CONTACT_EMAIL, DAY, PATHS, PAYMENT_LABEL, PRICE, nis, type OrderKind, type PaymentMethod } from "@/lib/conference-shared";
import { NAMES, SCHEDULE } from "@/app/hightecourse-2026/content";

/*
  Hightecourse-branded mail for the conference registration (17/11) - navy and
  yellow with the Hightecourse logo, not the community's purple shell. Inline
  styles only (mail clients).
*/
const H = { navy: "#004878", yellow: "#F8C800", bg: "#F6F8FA", ink: "#1C2B3A", body: "#3B4C5E", muted: "#5E7183", line: "#D9E2EC" };

function site(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl();
}

export function escapeHtml(text: string): string {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ConferenceMailContent {
  heading: string;
  /** Paragraphs - already-safe HTML. */
  lines: string[];
  ctaText?: string;
  ctaUrl?: string;
  footnote?: string;
}

export function renderConferenceEmail(c: ConferenceMailContent): string {
  const logo = `${site()}/ai-course/hightecourse.png`;
  const paragraphs = c.lines.map((t) => `<p style="font-size:15px; line-height:1.75; color:${H.body}; margin:0 0 14px;">${t}</p>`).join("");
  const cta =
    c.ctaText && c.ctaUrl
      ? `<a href="${c.ctaUrl}" style="display:inline-block; background:${H.navy}; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; padding:13px 30px; border-radius:999px; margin:6px 0 4px;">${c.ctaText}</a>`
      : "";
  const footnote = c.footnote ? `<p style="font-size:13px; color:${H.muted}; margin:20px 0 0;">${c.footnote}</p>` : "";
  return `<div dir="rtl" style="font-family: Arial, 'Segoe UI', Helvetica, sans-serif; background:${H.bg}; padding:32px 16px; color:${H.ink};">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid ${H.line};">
    <div style="padding:22px 24px 14px; text-align:center; background:#ffffff;">
      <img src="${logo}" alt="הייטקורס - לחשוב בגדול" width="190" style="display:inline-block; width:190px; height:auto; border:0;" />
    </div>
    <div style="height:4px; background:${H.yellow};"></div>
    <div style="padding:26px 26px 28px;">
      <h1 style="font-size:21px; margin:0 0 16px; color:${H.navy};">${c.heading}</h1>
      ${paragraphs}
      ${cta}
      ${footnote}
    </div>
  </div>
  <div style="text-align:center; color:${H.muted}; font-size:12px; margin-top:18px;">
    ${CONFERENCE_TITLE} · ${CONFERENCE_SUBTITLE} · ${DAY.label} ${DAY.date}
    <div style="margin-top:6px;">שאלות? <a href="mailto:${CONTACT_EMAIL}" style="color:${H.muted};">${CONTACT_EMAIL}</a></div>
    <div style="margin-top:10px;">לא מעוניינת לקבל מאיתנו מיילים? <a href="{{UNSUB_URL}}" style="color:${H.muted}; text-decoration:underline;">הסרה</a></div>
  </div>
</div>`;
}

export interface MailOrder {
  kind: OrderKind;
  shortCode: string;
  paymentMethod: PaymentMethod;
  paid: boolean;
  amountNis: number;
  unitPriceNis: number;
  participantCount: number;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  invoiceName: string | null;
  companyId: string | null;
  note: string | null;
  participants: { firstName: string; lastName: string; personalEmail: string; phone: string; roleTitle: string | null; department: string | null; company: string | null }[];
  payToken: string;
}

function participantsList(o: MailOrder): string {
  const items = o.participants
    .map((p) => `<li>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}${p.roleTitle ? ` · ${escapeHtml(p.roleTitle)}` : ""}${p.department ? ` · ${escapeHtml(p.department)}` : ""}</li>`)
    .join("");
  return `<ul style="margin:0 0 14px; padding-inline-start:18px; color:${H.body}; font-size:15px; line-height:1.75;">${items}</ul>`;
}

const NAME_RE = new RegExp(NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

/** The speakers' names in navy, as on the page. */
function withNames(text: string): string {
  return escapeHtml(text).replace(NAME_RE, (m) => `<b style="color:${H.navy};">${m}</b>`);
}

function paymentCell(o: MailOrder): string {
  if (o.paymentMethod === "transfer") return "העברה בנקאית מול חשבונית";
  return o.paid ? "כרטיס אשראי - התשלום התקבל. הקבלה נשלחת בנפרד ממערכת הסליקה (נדרים פלוס)." : "כרטיס אשראי - נקלט בדף התשלום ומאומת בדקות הקרובות.";
}

function detailRow(label: string, value: string, last = false): string {
  const line = last ? "" : " border-bottom:1px solid #ffffff;";
  return `<tr><td style="padding:11px 16px; font-size:13px; font-weight:700; color:${H.muted}; width:104px; vertical-align:top; white-space:nowrap;${line}">${label}</td><td style="padding:11px 12px 11px 16px; font-size:15px; line-height:1.6; color:${H.ink}; vertical-align:top;${line}">${value}</td></tr>`;
}

/**
 * To the registrant (single) or the group's contact - the Hightecourse look:
 * the logo, a navy band with the headline and the date, a pale-blue details
 * card (who, how much, how it is paid, the registration number), the day's
 * program with the speakers' names, one button. Tables and inline styles only.
 */
export function conferenceConfirmationEmail(o: MailOrder): { subject: string; html: string } {
  const group = o.kind === "group";
  const first = group ? (o.contactName ?? "").split(/\s+/)[0] : (o.participants[0]?.firstName ?? "");
  const base = site();
  const logo = `${base}/ai-course/hightecourse.png`;
  const hi = first ? `${escapeHtml(first)}, ` : "";
  const heading = group ? `${hi}הקבוצה רשומה ליום חמישי!` : `${hi}נרשמת ליום חמישי!`;
  const intro = group
    ? `ההרשמה הקבוצתית של <b>${escapeHtml(o.company ?? "")}</b> ליום השלישי של הייטקורס 2026 התקבלה - שמרנו ${o.participantCount} מקומות.`
    : "ההרשמה שלך ליום השלישי של הייטקורס 2026 התקבלה - שמרנו לך מקום.";
  const who = o.participants
    .map(
      (p, i) =>
        `${group ? `${i + 1}. ` : ""}<b>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</b>${p.roleTitle ? ` · ${escapeHtml(p.roleTitle)}` : ""}${p.department ? ` · ${escapeHtml(p.department)}` : ""}${!group && p.company ? ` · ${escapeHtml(p.company)}` : ""}`
    )
    .join("<br>");
  const priceNote =
    o.unitPriceNis < PRICE.single
      ? ` <span style="color:${H.muted}; font-size:13px;">(${o.participantCount} × ${nis(o.unitPriceNis)} ₪ - מחיר קבוצה, במקום ${nis(PRICE.single)} ₪)</span>`
      : o.participantCount > 1
        ? ` <span style="color:${H.muted}; font-size:13px;">(${o.participantCount} × ${nis(o.unitPriceNis)} ₪)</span>`
        : "";
  const rows = [
    detailRow(group ? "המשתתפות" : "משתתפת", who),
    ...(group ? [detailRow("חשבונית על שם", `${escapeHtml(o.invoiceName ?? "")}${o.companyId ? ` · ח.פ. <span dir="ltr">${escapeHtml(o.companyId)}</span>` : ""}`)] : []),
    detailRow("סכום לתשלום", `<b style="font-size:17px; color:${H.navy};">${nis(o.amountNis)} ₪</b>${priceNote}`),
    detailRow("אופן התשלום", paymentCell(o)),
    detailRow("מספר ההרשמה", `<b dir="ltr" style="letter-spacing:.04em;">${o.shortCode}</b>`, true),
  ].join("");
  const transferNote =
    o.paymentMethod === "transfer"
      ? `<div style="margin-top:14px; background:#FFF4C2; border-right:4px solid ${H.yellow}; border-radius:10px; padding:12px 14px; font-size:14px; line-height:1.65; color:${H.ink};"><b>שימי לב:</b> החשבונית לתשלום תישלח אלייך במייל בנפרד, והתשלום מתבצע מולה. המקום שמור מרגע ההרשמה.</div>`
      : "";
  const program = SCHEDULE.map(
    (s) =>
      `<tr><td style="padding:6px 0 6px 10px; font-size:14px; font-weight:800; color:${H.navy}; width:48px; vertical-align:top; white-space:nowrap;" dir="ltr">${s.time}</td><td style="padding:6px 0; font-size:14px; line-height:1.55; color:${H.ink}; vertical-align:top;"><b>${escapeHtml(s.title)}</b>${s.sub ? ` <span style="color:${H.muted};">${withNames(s.sub)}</span>` : ""}</td></tr>`
  ).join("");
  const html = `<div dir="rtl" style="font-family: Arial, 'Segoe UI', Helvetica, sans-serif; background:#E6EFF7; padding:32px 12px; color:${H.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid ${H.line};">
    <tr><td style="padding:22px 24px 16px; text-align:center;"><img src="${logo}" alt="הייטקורס - לחשוב בגדול" width="190" style="display:inline-block; width:190px; height:auto; border:0;" /></td></tr>
    <tr><td style="background:${H.navy}; padding:26px 24px 28px; text-align:center;">
      <div style="font-size:13px; font-weight:700; color:${H.yellow}; margin-bottom:8px;">היום השלישי של הייטקורס 2026</div>
      <div style="font-size:30px; line-height:1.15; font-weight:900; color:#ffffff;">כשחדשנות פוגשת <span style="color:${H.yellow};">אווירה</span></div>
      <div style="display:inline-block; margin-top:16px; background:${H.yellow}; color:${H.navy}; font-weight:800; font-size:15px; padding:9px 20px; border-radius:999px;">${DAY.label} &nbsp;|&nbsp; <span dir="ltr">${DAY.date}</span> &nbsp;|&nbsp; ${DAY.hebrew}</div>
      <div style="margin-top:12px; font-size:13px; color:#C9D9E6;">התכנסות ובופה בוקר מ-08:00 · סיום ב-17:00</div>
    </td></tr>
    <tr><td style="padding:28px 26px 6px;">
      <h1 style="font-size:23px; margin:0 0 10px; color:${H.navy};">${heading}</h1>
      <p style="font-size:15.5px; line-height:1.7; color:${H.body}; margin:0 0 18px;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E6EFF7; border-radius:16px; overflow:hidden;">${rows}</table>
      ${transferNote}
    </td></tr>
    <tr><td style="padding:22px 26px 4px;">
      <div style="font-size:16px; font-weight:800; color:${H.navy}; margin:0 0 8px;">מה מחכה לך ביום חמישי</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${program}</table>
    </td></tr>
    <tr><td style="padding:20px 26px 30px; text-align:center;">
      <a href="${base}${PATHS.landing}#schedule" style="display:inline-block; background:${H.navy}; color:#ffffff; text-decoration:none; font-weight:800; font-size:15px; padding:13px 34px; border-radius:999px;">לתוכנית המלאה</a>
      <p style="font-size:13px; color:${H.muted}; margin:16px 0 0;">נתראה ביום חמישי. פרטים נוספים יישלחו לקראת הכנס.</p>
    </td></tr>
  </table>
  <div style="text-align:center; color:${H.muted}; font-size:12px; margin-top:18px;">
    ${CONFERENCE_TITLE} · ${CONFERENCE_SUBTITLE} · ${DAY.label} ${DAY.date}
    <div style="margin-top:6px;">שאלות? <a href="mailto:${CONTACT_EMAIL}" style="color:${H.muted};">${CONTACT_EMAIL}</a></div>
    <div style="margin-top:10px;">לא מעוניינת לקבל מאיתנו מיילים? <a href="{{UNSUB_URL}}" style="color:${H.muted}; text-decoration:underline;">הסרה</a></div>
  </div>
</div>`;
  return { subject: `${hi}ההרשמה ליום חמישי של הייטקורס 2026 התקבלה`, html };
}

/** To the team: a new registration (or a payment on one), with everything the sheet got. */
export function conferenceTeamEmail(o: MailOrder, event: "registered" | "paid" | "reported"): { subject: string; html: string } {
  const who = o.kind === "group" ? `${o.company ?? ""} (${o.participantCount} משתתפות, איש קשר ${o.contactName ?? ""})` : `${o.participants[0]?.firstName ?? ""} ${o.participants[0]?.lastName ?? ""}`;
  const head = event === "paid" ? "שולם: " : event === "reported" ? "חזרה מדף התשלום: " : "";
  const lines = [
    `<b>${escapeHtml(who)}</b> - ${o.kind === "group" ? "הרשמה קבוצתית" : "משתתפת יחידה"} ליום חמישי של הייטקורס 2026, ${PAYMENT_LABEL[o.paymentMethod]}.`,
    `סכום: <b>${nis(o.amountNis)} ₪</b> (${o.participantCount} × ${nis(o.unitPriceNis)} ₪) · מספר הרשמה <b dir="ltr">${o.shortCode}</b>.`,
    o.kind === "group"
      ? `איש קשר: ${escapeHtml(o.contactName ?? "")} · ${escapeHtml(o.contactEmail ?? "")} · חשבונית על שם ${escapeHtml(o.invoiceName ?? "")} · ח.פ. ${escapeHtml(o.companyId ?? "")}`
      : `${escapeHtml(o.participants[0]?.personalEmail ?? "")} · ${escapeHtml(o.participants[0]?.phone ?? "")} · ${escapeHtml(o.participants[0]?.company ?? "")}`,
    participantsList(o),
    o.note ? `הערה: ${escapeHtml(o.note)}` : "",
    o.paymentMethod === "transfer" ? "<b>לשלוח לה חשבונית במייל</b> - זה מה שהובטח לה בטופס." : event === "paid" ? "התשלום אומת בקולבק של נדרים." : event === "reported" ? "דף התשלום דיווח הצלחה; הקולבק של נדרים עוד לא הגיע - לאמת מול נדרים אם לא יגיע תוך דקות." : "",
  ].filter(Boolean);
  return {
    subject: `${head}הרשמה ליום חמישי של הייטקורס: ${who}`,
    html: renderConferenceEmail({ heading: `${head}הרשמה חדשה לכנס`, lines, ctaText: "לרשימת הנרשמות", ctaUrl: `${site()}${PATHS.admin}` }),
  };
}
