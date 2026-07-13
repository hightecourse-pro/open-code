// Branded HTML email templates — Open Code colors, RTL Hebrew, warm microcopy.
// Used for every member-facing email (auth + app notifications).

const C = {
  bg: "#F7F5FB",
  card: "#FFFFFF",
  border: "#ECE8F5",
  ink: "#1F1E3F",
  body: "#4A4870",
  muted: "#8C89A6",
  gradient: "linear-gradient(135deg,#E0418D,#6B3D99)",
  pink: "#E0418D",
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://open-code-psi.vercel.app";
const LOGO = `${SITE}/logo-opencode.png`;
const TAGLINE = "קהילה לחרדיות בהייטק";

export interface EmailContent {
  /** Big heading inside the card. */
  heading: string;
  /** Body paragraphs (each becomes its own <p>). */
  lines: string[];
  /** Optional call-to-action button. */
  ctaText?: string;
  ctaUrl?: string;
  /** Small reassurance line under the button (microcopy). */
  footnote?: string;
}

/** Wrap content in the branded shell. Email-safe inline styles only. */
export function renderEmail(c: EmailContent): string {
  const paragraphs = c.lines
    .map(
      (t) =>
        `<p style="font-size:15px; line-height:1.7; color:${C.body}; margin:0 0 14px;">${t}</p>`
    )
    .join("");

  const cta =
    c.ctaText && c.ctaUrl
      ? `<a href="${c.ctaUrl}" style="display:inline-block; background:${C.gradient}; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; padding:13px 30px; border-radius:10px; margin:6px 0 4px;">${c.ctaText}</a>`
      : "";

  const footnote = c.footnote
    ? `<p style="font-size:13px; color:${C.muted}; margin:20px 0 0;">${c.footnote}</p>`
    : "";

  return `<div dir="rtl" style="font-family: Arial, 'Segoe UI', Helvetica, sans-serif; background:${C.bg}; padding:32px 16px; color:${C.ink};">
  <div style="max-width:480px; margin:0 auto; background:${C.card}; border-radius:18px; overflow:hidden; border:1px solid ${C.border};">
    <div style="padding:26px 24px 12px; text-align:center; background:#ffffff;">
      <img src="${LOGO}" alt="קוד פתוח" width="150" style="display:inline-block; width:150px; height:auto; border:0;" />
    </div>
    <div style="height:4px; background:${C.gradient};"></div>
    <div style="padding:28px 26px;">
      <h1 style="font-size:21px; margin:0 0 16px; color:${C.ink};">${c.heading}</h1>
      ${paragraphs}
      ${cta}
      ${footnote}
    </div>
  </div>
  <div style="text-align:center; color:${C.muted}; font-size:12px; margin-top:18px;">
    קוד פתוח · ${TAGLINE} 💜
  </div>
</div>`;
}

export interface BuiltEmail {
  subject: string;
  html: string;
}

export function confirmSignupEmail(actionUrl: string, name?: string): BuiltEmail {
  return {
    subject: "אישור ההרשמה לקוד פתוח 💜",
    html: renderEmail({
      heading: `${name ? `היי ${name}, ` : ""}ברוכה הבאה! 💜`,
      lines: [
        "כיף גדול שהצטרפת לקוד פתוח — קהילה של מפתחות שתומכות אחת בשנייה.",
        "נשאר רק לאשר את כתובת המייל שלך, ואנחנו ממשיכות מכאן:",
      ],
      ctaText: "אישור הכתובת",
      ctaUrl: actionUrl,
      footnote: "אם לא נרשמת לקוד פתוח, אפשר פשוט להתעלם מהמייל הזה.",
    }),
  };
}

export function resetPasswordEmail(actionUrl: string, name?: string): BuiltEmail {
  return {
    subject: "איפוס סיסמה · קוד פתוח",
    html: renderEmail({
      heading: "בחירת סיסמה חדשה 🔑",
      lines: [
        `${name ? `היי ${name}, ` : ""}אל דאגה — קורה לכולן.`,
        "קיבלנו בקשה לאיפוס הסיסמה שלך. לחצי על הכפתור כדי לבחור סיסמה חדשה. הקישור תקף ל-60 דקות.",
      ],
      ctaText: "בחירת סיסמה חדשה",
      ctaUrl: actionUrl,
      footnote: "לא ביקשת לאפס סיסמה? אפשר להתעלם — הסיסמה שלך לא תשתנה.",
    }),
  };
}

export function magicLinkEmail(actionUrl: string, name?: string): BuiltEmail {
  return {
    subject: "קישור הכניסה שלך · קוד פתוח",
    html: renderEmail({
      heading: "הכניסה שלך מחכה 💜",
      lines: [`${name ? `היי ${name}, ` : ""}לחצי על הכפתור כדי להיכנס לקוד פתוח:`],
      ctaText: "כניסה לקהילה",
      ctaUrl: actionUrl,
      footnote: "אם לא ביקשת את הקישור, אפשר להתעלם מהמייל.",
    }),
  };
}

/** Fallback for any other auth action (email change, reauth, invite, …). */
export function genericActionEmail(actionUrl: string): BuiltEmail {
  return {
    subject: "פעולה בחשבון · קוד פתוח",
    html: renderEmail({
      heading: "אישור פעולה",
      lines: ["כדי להשלים את הפעולה בחשבון שלך, לחצי על הכפתור:"],
      ctaText: "להמשך",
      ctaUrl: actionUrl,
      footnote: "אם לא ביקשת זאת, אפשר להתעלם מהמייל.",
    }),
  };
}
