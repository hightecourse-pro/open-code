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

import { getSiteUrl } from "@/lib/site";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl();
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

/** Notify a mentor that a member wrote to her in chat. */
export function newMessageEmail(fromName: string): BuiltEmail {
  return {
    subject: `הודעה חדשה מ־${fromName} · קוד פתוח`,
    html: renderEmail({
      heading: "יש לך הודעה חדשה 💬",
      lines: [`${fromName} כתבה לך בצ'אט של קוד פתוח.`, "אפשר להיכנס ולהשיב מתי שנוח לך."],
      ctaText: "לצ'אט",
      ctaUrl: `${SITE}/chat`,
      footnote: "מקבלת יותר מדי מיילים? תוכלי לשנות את זה בפרופיל ← העדפות מייל.",
    }),
  };
}

export interface DigestData {
  name?: string;
  unreadCount: number;
  unreadFrom: string[];
  newForumPosts: number;
  newJobs: number;
  upcomingSessions: { title: string; when: string }[];
}

/** The daily digest: a warm roundup of what's waiting for a member. */
export function dailyDigestEmail(data: DigestData): BuiltEmail {
  const row = (emoji: string, text: string, href: string, cta: string) =>
    `<div style="display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid ${C.border};">
      <div style="font-size:20px;">${emoji}</div>
      <div style="flex:1; font-size:14px; color:${C.body};">${text}</div>
      <a href="${SITE}${href}" style="font-size:13px; font-weight:700; color:${C.pink}; text-decoration:none; white-space:nowrap;">${cta} ←</a>
    </div>`;

  const rows: string[] = [];
  if (data.unreadCount > 0) {
    const who = data.unreadFrom.slice(0, 3).join(", ");
    const count =
      data.unreadCount === 1 ? "הודעה חדשה אחת" : `${data.unreadCount} הודעות חדשות`;
    rows.push(row("💬", `<b>${count}</b> בצ'אט${who ? ` — מ־${who}` : ""}`, "/chat", "לצ'אט"));
  }
  if (data.newForumPosts > 0) {
    const count =
      data.newForumPosts === 1 ? "פוסט חדש אחד" : `${data.newForumPosts} פוסטים חדשים`;
    rows.push(row("📣", `<b>${count}</b> בפורום`, "/forum", "לפורום"));
  }
  if (data.newJobs > 0) {
    // The digest count is community-wide, so don't promise a personal match.
    const count = data.newJobs === 1 ? "משרה חדשה אחת" : `${data.newJobs} משרות חדשות`;
    rows.push(row("💼", `<b>${count}</b> בלוח המשרות`, "/jobs", "למשרות"));
  }
  if (data.upcomingSessions.length > 0) {
    const list = data.upcomingSessions
      .slice(0, 3)
      .map((s) => `${s.title} (${s.when})`)
      .join(" · ");
    rows.push(row("📅", `<b>סשנים קרובים:</b> ${list}`, "/events", "ליומן"));
  }

  const body = `<div dir="rtl" style="font-family: Arial, 'Segoe UI', Helvetica, sans-serif; background:${C.bg}; padding:32px 16px; color:${C.ink};">
  <div style="max-width:480px; margin:0 auto; background:${C.card}; border-radius:18px; overflow:hidden; border:1px solid ${C.border};">
    <div style="padding:26px 24px 12px; text-align:center; background:#ffffff;">
      <img src="${LOGO}" alt="קוד פתוח" width="150" style="display:inline-block; width:150px; height:auto; border:0;" />
    </div>
    <div style="height:4px; background:${C.gradient};"></div>
    <div style="padding:26px 26px;">
      <h1 style="font-size:20px; margin:0 0 6px; color:${C.ink};">${data.name ? `בוקר טוב ${data.name}! ` : "בוקר טוב! "}☀️</h1>
      <p style="font-size:14px; line-height:1.6; color:${C.body}; margin:0 0 12px;">הנה מה שמחכה לך היום בקהילה:</p>
      ${rows.join("")}
      <a href="${SITE}/forum" style="display:inline-block; background:${C.gradient}; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; padding:12px 28px; border-radius:10px; margin:18px 0 2px;">כניסה לקהילה</a>
    </div>
  </div>
  <div style="text-align:center; color:${C.muted}; font-size:12px; margin-top:18px;">
    קוד פתוח · ${TAGLINE} 💜
  </div>
</div>`;

  return { subject: "מה חדש בקוד פתוח היום 💜", html: body };
}

/** Notify an applicant that her application status changed. */
export function applicationStatusEmail(
  jobTitle: string,
  company: string,
  status: "in_review" | "accepted" | "rejected",
  name?: string
): BuiltEmail {
  const per = {
    in_review: {
      subject: `המועמדות שלך בבדיקה · ${jobTitle}`,
      heading: "המועמדות שלך בבדיקה 👀",
      line: `המועמדות שלך למשרת <b>${jobTitle}</b> ב־${company} נמצאת עכשיו בבדיקה. נעדכן אותך ברגע שיש חדש!`,
    },
    accepted: {
      subject: `חדשות טובות על המועמדות שלך 🎉 · ${jobTitle}`,
      heading: "מזל טוב! 🎉",
      line: `המועמדות שלך למשרת <b>${jobTitle}</b> ב־${company} התקבלה! ניצור איתך קשר עם כל הפרטים.`,
    },
    rejected: {
      subject: `עדכון על המועמדות שלך · ${jobTitle}`,
      heading: "הפעם זה לא התקדם 💜",
      line: `המועמדות למשרת <b>${jobTitle}</b> ב־${company} לא התקדמה הפעם. זה קורה לכולן — וזה לא אומר כלום עלייך. יש עוד משרות שמחכות לך, ואנחנו כאן בשבילך.`,
    },
  }[status];

  return {
    subject: per.subject,
    html: renderEmail({
      heading: per.heading,
      lines: [`${name ? `היי ${name}, ` : ""}${per.line}`],
      ctaText: "לכל המשרות",
      ctaUrl: `${SITE}/jobs`,
    }),
  };
}

/**
 * Ask a member for a Google address, because Drive can't share the community
 * material with the address she signed up with.
 */
export function driveEmailRequestEmail(name?: string): BuiltEmail {
  return {
    subject: "רגע אחד לפני שנשתף איתך את החומרים 💜",
    html: renderEmail({
      heading: "צריכות ממך כתובת Gmail 📩",
      lines: [
        `${name ? `היי ${name}, ` : ""}רצינו לשתף איתך את הקלטות הסשנים וחומרי הקורסים ב-Google Drive,`,
        "אבל הכתובת שאיתה נרשמת אינה חשבון Google — ודרייב יודע לשתף רק עם חשבון Google.",
        "אם יש לך כתובת Gmail (או כל כתובת שמחוברת לחשבון Google), הוסיפי אותה בפרופיל ואנחנו נשתף איתך הכול אוטומטית תוך דקות.",
      ],
      ctaText: "הוספת כתובת Gmail",
      ctaUrl: `${SITE}/profile`,
      footnote: "אין לך חשבון Google? אפשר לפתוח אחד בחינם ב-accounts.google.com, ואז להוסיף אותו כאן.",
    }),
  };
}

/** Member-supplied text goes into email HTML — neutralize markup first. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Tell the team a member asked to be matched with a mentor. */
export function mentorRequestEmail(
  memberName: string,
  reasonLabel: string,
  note?: string | null
): BuiltEmail {
  return {
    subject: `בקשה למנטורית מ${memberName} · קוד פתוח`,
    html: renderEmail({
      heading: "בקשה חדשה למנטורית 👑",
      lines: [
        `<b>${escapeHtml(memberName)}</b> ביקשה שנחבר אותה למנטורית.`,
        `<b>הסיבה:</b> ${escapeHtml(reasonLabel)}`,
        ...(note ? [`<b>מה שהיא כתבה:</b> ${escapeHtml(note)}`] : []),
      ],
      ctaText: "לבקשות למנטורית",
      ctaUrl: `${SITE}/admin/mentor-requests`,
      footnote: "אפשר לסמן את הבקשה כטופלה במסך הניהול.",
    }),
  };
}

/**
 * Tell a hiring client that candidates were sent for one of their jobs, with a
 * link straight into that job in the portal. Addressed to a company, so the
 * copy is neutral/plural — not the members' feminine voice.
 */
export function jobCandidatesEmail(
  companyName: string,
  jobTitle: string,
  candidateNames: string[],
  portalUrl: string
): BuiltEmail {
  const names = candidateNames.slice(0, 12);
  const list = names.length
    ? `<ul style="margin:6px 0 14px; padding-inline-start:20px; color:${C.body}; font-size:14px;">${names
        .map((n) => `<li style="margin-bottom:4px;">${escapeHtml(n)}</li>`)
        .join("")}</ul>`
    : "";
  const more =
    candidateNames.length > names.length
      ? `<p style="font-size:13px; color:${C.muted}; margin:0 0 14px;">ועוד ${candidateNames.length - names.length} מועמדות בפורטל.</p>`
      : "";

  return {
    subject: `מועמדות למשרת ${jobTitle} · קוד פתוח`,
    html: renderEmail({
      heading: "בחרנו לכם מועמדות 👋",
      lines: [
        `שלום ${companyName},`,
        `ריכזנו עבורכם מועמדות רלוונטיות למשרת <b>${jobTitle}</b>. אפשר לצפות בפרופיל המלא של כל אחת — ולהוריד קורות חיים אם תרצו.`,
        `${list}${more}`,
        "הכניסה לפורטל עם שם המשתמש והסיסמה שקיבלתם.",
      ],
      ctaText: "צפייה במועמדות למשרה",
      ctaUrl: portalUrl,
      footnote: "המידע מיועד לשימוש בתהליכי הגיוס שלכם בלבד.",
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
