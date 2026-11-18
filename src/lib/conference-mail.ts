import { getSiteUrl } from "@/lib/site";
import { CONFERENCE_SUBTITLE, CONFERENCE_TITLE, CONTACT_EMAIL, DAY, PATHS, PAYMENT_LABEL, nis, type OrderKind, type PaymentMethod } from "@/lib/conference-shared";

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

const dateLine = `<b>${DAY.label} | ${DAY.date} | ${DAY.hebrew}</b> · התכנסות ובופה בוקר מ-08:00, סיום ב-17:00.`;

function paymentLine(o: MailOrder): string {
  if (o.paymentMethod === "transfer") {
    return `אופן התשלום: <b>העברה בנקאית מול חשבונית</b>. <b>החשבונית לתשלום תישלח אלייך במייל בנפרד</b>${
      o.invoiceName ? ` (על שם ${escapeHtml(o.invoiceName)}${o.companyId ? `, ח.פ. ${escapeHtml(o.companyId)}` : ""})` : ""
    }.`;
  }
  return o.paid
    ? "אופן התשלום: <b>כרטיס אשראי</b> - התשלום התקבל. הקבלה נשלחת בנפרד ממערכת הסליקה (נדרים פלוס)."
    : "אופן התשלום: <b>כרטיס אשראי</b> - התשלום נקלט בדף התשלום ומאומת בדקות הקרובות.";
}

function participantsList(o: MailOrder): string {
  const items = o.participants
    .map((p) => `<li>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}${p.roleTitle ? ` · ${escapeHtml(p.roleTitle)}` : ""}${p.department ? ` · ${escapeHtml(p.department)}` : ""}</li>`)
    .join("");
  return `<ul style="margin:0 0 14px; padding-inline-start:18px; color:${H.body}; font-size:15px; line-height:1.75;">${items}</ul>`;
}

/** To the registrant (single) or the group's contact: the registration is in, what she chose, what happens next. */
export function conferenceConfirmationEmail(o: MailOrder): { subject: string; html: string } {
  const first = o.kind === "group" ? (o.contactName ?? "").split(/\s+/)[0] : o.participants[0]?.firstName ?? "";
  const price = o.unitPriceNis < 650 ? `${o.participantCount} × ${nis(o.unitPriceNis)} ₪ (מחיר קבוצה, במקום 650 ₪)` : `${o.participantCount} × ${nis(o.unitPriceNis)} ₪`;
  const lines =
    o.kind === "group"
      ? [
          `ההרשמה הקבוצתית של <b>${escapeHtml(o.company ?? "")}</b> ליום השלישי של הייטקורס 2026 התקבלה.`,
          dateLine,
          `המשתתפות (${o.participantCount}):`,
          participantsList(o),
          `סכום לתשלום: <b>${nis(o.amountNis)} ₪</b> (${price}).`,
          paymentLine(o),
          `מספר ההרשמה: <b dir="ltr">${o.shortCode}</b>.`,
        ]
      : [
          `ההרשמה שלך ליום השלישי של הייטקורס 2026 התקבלה.`,
          dateLine,
          `סכום לתשלום: <b>${nis(o.amountNis)} ₪</b>.`,
          paymentLine(o),
          `מספר ההרשמה: <b dir="ltr">${o.shortCode}</b>.`,
        ];
  return {
    subject: `${first ? `${first}, ` : ""}ההרשמה ליום חמישי של הייטקורס 2026 התקבלה`,
    html: renderConferenceEmail({
      heading: o.kind === "group" ? "ההרשמה הקבוצתית התקבלה" : `${first ? `${first}, ` : ""}נרשמת ליום חמישי!`,
      lines,
      ctaText: "לתוכנית היום",
      ctaUrl: `${site()}${PATHS.landing}#schedule`,
      footnote: "נתראה ביום חמישי. פרטים נוספים יישלחו לקראת הכנס.",
    }),
  };
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
