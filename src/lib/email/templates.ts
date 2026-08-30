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
import { toSiteAuthLink } from "./auth-links";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl();
const LOGO = `${SITE}/logo-opencode.png`;
const BRAND = "קהילת קוד פתוח";
const TAGLINE = "פותחים לך דלת להייטק";

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
    ${BRAND} · ${TAGLINE} 💜
  </div>
</div>`;
}

export interface BuiltEmail {
  subject: string;
  html: string;
}

// The four auth emails below run their link through `toSiteAuthLink` so the
// member always clicks a link on OUR domain that verifies server-side — a
// Supabase verify link only works in the browser that started the flow.

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
      ctaUrl: toSiteAuthLink(actionUrl),
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
      ctaUrl: toSiteAuthLink(actionUrl),
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
      ctaUrl: toSiteAuthLink(actionUrl),
      footnote: "אם לא ביקשת את הקישור, אפשר להתעלם מהמייל.",
    }),
  };
}

/**
 * Notify a member that someone wrote to her in chat. Any member may write to
 * any member, so the copy names only the sender — never a role ("המנטורית שלך",
 * "מנטי") — and reads the same whoever is on the other side.
 */
export function newMessageEmail(fromName: string): BuiltEmail {
  return {
    subject: `הודעה חדשה מ־${fromName} · קוד פתוח`,
    html: renderEmail({
      heading: "יש לך הודעה חדשה 💬",
      lines: [
        `<b>${escapeHtml(fromName)}</b> כתבה לך בצ'אט של קוד פתוח.`,
        "אפשר להיכנס ולהשיב לה מתי שנוח לך 💜",
      ],
      ctaText: "לצ'אט",
      ctaUrl: `${SITE}/chat`,
      footnote: "מקבלת יותר מדי מיילים? תוכלי לשנות את זה בפרופיל ← העדפות מייל.",
    }),
  };
}

/** The team answered her request — the reply waits in her chat (30/8). */
export function teamRepliedEmail(requestSubject: string, name?: string): BuiltEmail {
  return {
    subject: "הצוות ענה לך · קוד פתוח",
    html: renderEmail({
      heading: "יש לך תשובה מהצוות 💜",
      lines: [
        name ? `היי ${escapeHtml(name)},` : "היי,",
        `ענינו על הפנייה שלך <b>"${escapeHtml(requestSubject)}"</b> — התשובה מחכה לך בצ'אט.`,
      ],
      ctaText: "לתשובה בצ'אט",
      ctaUrl: `${SITE}/chat`,
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
  // A table, not flexbox: Gmail and Outlook drop display:flex, which collapsed
  // the row and ran the text straight into the link with no space between them.
  const row = (emoji: string, text: string, href: string, cta: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom:1px solid ${C.border};">
      <tr>
        <td width="28" style="font-size:20px; padding:12px 0 12px 8px; vertical-align:top;">${emoji}</td>
        <td style="font-size:14px; line-height:1.6; color:${C.body}; padding:12px 4px;">${text}</td>
        <td style="padding:12px 8px 12px 0; text-align:left; vertical-align:middle;">
          <a href="${SITE}${href}" style="font-size:13px; font-weight:700; color:${C.pink}; text-decoration:none; white-space:nowrap;">${cta} ←</a>
        </td>
      </tr>
    </table>`;

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
      <p style="font-size:12.5px; line-height:1.7; color:${C.muted}; margin:18px 0 0;">
        אפשר לשנות את תדירות המיילים או להפסיק אותם לגמרי בכל רגע —
        <a href="${SITE}/profile" style="color:${C.pink}; text-decoration:underline;">בהגדרות שלך</a>.
      </p>
    </div>
  </div>
  <div style="text-align:center; color:${C.muted}; font-size:12px; margin-top:18px;">
    ${BRAND} · ${TAGLINE} 💜
  </div>
</div>`;

  return { subject: "מה חדש בקוד פתוח היום 💜", html: body };
}

/** Notify an applicant that her application status changed. */
export function applicationStatusEmail(
  jobTitle: string,
  company: string | null,
  status: "in_review" | "accepted" | "rejected",
  name?: string
): BuiltEmail {
  // Internal jobs keep the client confidential — pass company: null there.
  const at = company ? ` ב־${company}` : "";
  const per = {
    in_review: {
      subject: `המועמדות שלך בבדיקה · ${jobTitle}`,
      heading: "המועמדות שלך בבדיקה 👀",
      line: `המועמדות שלך למשרת <b>${jobTitle}</b>${at} נמצאת עכשיו בבדיקה. נעדכן אותך ברגע שיש חדש!`,
    },
    accepted: {
      subject: `חדשות טובות על המועמדות שלך 🎉 · ${jobTitle}`,
      heading: "מזל טוב! 🎉",
      line: `המועמדות שלך למשרת <b>${jobTitle}</b>${at} התקבלה! ניצור איתך קשר עם כל הפרטים.`,
    },
    rejected: {
      subject: `עדכון על המועמדות שלך · ${jobTitle}`,
      heading: "הפעם זה לא התקדם 💜",
      line: `המועמדות למשרת <b>${jobTitle}</b>${at} לא התקדמה הפעם. זה קורה לכולן — וזה לא אומר כלום עלייך. יש עוד משרות שמחכות לך, ואנחנו כאן בשבילך.`,
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

/** Tell the team a portal client just marked a candidate for an interview. */
export function clientInterviewEmail(
  companyName: string,
  candidateName: string,
  jobTitle: string,
  adminUrl: string
): BuiltEmail {
  return {
    subject: `🎯 ${companyName} מסמנת לראיון · ${jobTitle}`,
    html: renderEmail({
      heading: "יש התעניינות מלקוח 🎯",
      lines: [
        `<b>${escapeHtml(companyName)}</b> סימנה בפורטל שהיא רוצה לראיין את <b>${escapeHtml(candidateName)}</b> למשרת <b>${escapeHtml(jobTitle)}</b>.`,
        "שווה לעדכן את המועמדת ולקבוע סטטוס ראיון במרכז הסינון.",
      ],
      ctaText: "למרכז הסינון",
      ctaUrl: adminUrl,
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
  note?: string | null,
  kind: "general" | "employment" = "general"
): BuiltEmail {
  const employment = kind === "employment";
  return {
    subject: employment
      ? `ליווי תעסוקתי · בקשה מ${memberName} · קוד פתוח`
      : `בקשה למנטורית מ${memberName} · קוד פתוח`,
    html: renderEmail({
      heading: employment ? "בקשה חדשה לליווי תעסוקתי 💼" : "בקשה חדשה למנטורית 👑",
      lines: [
        employment
          ? `<b>${escapeHtml(memberName)}</b> מתחילה עבודה חדשה וביקשה ליווי לחודשים הראשונים.`
          : `<b>${escapeHtml(memberName)}</b> ביקשה שנחבר אותה למנטורית.`,
        `<b>הסיבה:</b> ${escapeHtml(reasonLabel)}`,
        ...(note ? [`<b>מה שהיא כתבה:</b> ${escapeHtml(note)}`] : []),
      ],
      ctaText: "לבקשות למנטורית",
      ctaUrl: `${SITE}/admin/mentor-requests`,
      footnote: "אפשר לשייך מנטורית ולסמן את הבקשה כטופלה במסך הניהול.",
    }),
  };
}

/** Tell a member which mentor will accompany her, with a link to the chat. */
/**
 * To the MENTOR: a member was matched to her, for a stated purpose — she has
 * to ACCEPT before the member sees her (the owner's flow, 2026-08-27).
 */
export function mentorAssignmentInviteEmail(
  mentorName: string | undefined,
  memberName: string,
  purposeLabel: string,
  note: string | null
): BuiltEmail {
  return {
    subject: "צוותה לך מנטית — מחכה לאישור שלך 👑",
    html: renderEmail({
      heading: "צוותה לך מנטית 👑",
      lines: [
        `${mentorName ? `היי ${escapeHtml(mentorName)}, ` : ""}שמחות לספר ששיבצנו אלייך את <b>${escapeHtml(memberName)}</b>.`,
        `הצורך: <b>${escapeHtml(purposeLabel)}</b>.${note ? ` במילים שלה: "${escapeHtml(note)}"` : ""}`,
        "כדי שהליווי יתחיל צריך את האישור שלך — היא תראה אותך רק אחרי שתאשרי. אם זה לא מתאים כרגע, אפשר גם לוותר ונשבץ מישהי אחרת.",
      ],
      ctaText: "לאישור השיבוץ",
      ctaUrl: `${SITE}/mentor`,
      footnote: "תודה שאת חלק מזה 💜",
    }),
  };
}

export function assignedMentorEmail(
  memberName: string | undefined,
  mentorName: string
): BuiltEmail {
  return {
    subject: "צוותה לך מנטורית לליווי 👑",
    html: renderEmail({
      heading: "צוותה לך מנטורית לליווי 👑",
      lines: [
        `${memberName ? `היי ${escapeHtml(memberName)}, ` : ""}חדשות משמחות — <b>${escapeHtml(mentorName)}</b> תלווה אותך מעכשיו 💜`,
        "היא כבר יודעת עלייך — אפשר לכתוב לה בצ'אט מתי שנוח לך.",
      ],
      ctaText: "לצ'אט",
      ctaUrl: `${SITE}/chat`,
      footnote: "מאחלות לך המון הצלחה — ואנחנו כאן לכל דבר 💜",
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
  portalUrl: string,
  opts?: {
    /** A personal word from the admin, shown highlighted (escaped here). */
    personalNote?: string | null;
    /** Portal access details, shown in a bordered mono block. */
    credentials?: { username: string; password: string } | null;
  }
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

  const personalNote = opts?.personalNote?.trim();
  const note = personalNote
    ? `<span style="display:block; background:${C.bg}; border-inline-start:3px solid ${C.pink}; border-radius:8px; padding:12px 16px; font-size:14.5px; line-height:1.7; color:${C.ink};">${escapeHtml(personalNote)}</span>`
    : null;

  // dir=ltr on the values so username/password never get bidi-scrambled.
  const credValue = (v: string) =>
    `<b dir="ltr" style="font-family:'Courier New',monospace; font-size:14px; color:${C.ink}; unicode-bidi:isolate;">${escapeHtml(v)}</b>`;
  const creds = opts?.credentials
    ? `<span style="display:block; border:1px solid ${C.border}; background:${C.bg}; border-radius:10px; padding:12px 16px;">
        <span style="display:block; font-size:13px; color:${C.muted}; margin-bottom:6px;">פרטי הגישה לפורטל:</span>
        <span style="display:block; font-size:14px; color:${C.body}; margin-bottom:4px;">שם משתמש: ${credValue(opts.credentials.username)}</span>
        <span style="display:block; font-size:14px; color:${C.body};">סיסמה: ${credValue(opts.credentials.password)}</span>
      </span>`
    : null;

  return {
    subject: `מועמדות למשרת ${jobTitle} · קוד פתוח`,
    html: renderEmail({
      heading: "בחרנו לכם מועמדות 👋",
      lines: [
        `שלום ${escapeHtml(companyName)},`,
        ...(note ? [note] : []),
        `ריכזנו עבורכם מועמדות רלוונטיות למשרת <b>${escapeHtml(jobTitle)}</b>. אפשר לצפות בפרופיל המלא של כל אחת — ולהוריד קורות חיים אם תרצו.`,
        `${list}${more}`,
        creds ?? "הכניסה לפורטל עם שם המשתמש והסיסמה שקיבלתם.",
      ],
      ctaText: "צפייה במועמדות למשרה",
      ctaUrl: portalUrl,
      footnote: "המידע מיועד לשימוש בתהליכי הגיוס שלכם בלבד.",
    }),
  };
}

/**
 * Tell a member we submitted her CV to a client. `applied` — she applied to
 * the job herself; false — the admin curated her for it without an application.
 */
export function candidateSubmittedEmail(
  name: string | undefined,
  jobTitle: string,
  applied: boolean
): BuiltEmail {
  const firstLine = applied
    ? "רק רצינו לספר לך שהגשנו את קורות החיים שלך למשרה שהגשת אליה מועמדות :)"
    : `רק רצינו לספר לך שהגשנו את קורות החיים שלך למשרת ${escapeHtml(jobTitle)} — אנחנו מאמינות שאת יכולה להתאים :)`;

  return {
    subject: "קוד פתוח מגישה אותך למשרה",
    html: renderEmail({
      heading: "הגשנו אותך למשרה 💜",
      lines: [
        ...(name ? [`היי ${escapeHtml(name)},`] : []),
        firstLine,
        "עמותת קוד פתוח משקיעה משאבים רבים כדי לאתר ולייצר משרות בתקופה כל כך מאתגרת.",
        `העלות המינימלית שלנו לכל משרה כזו היא 2500 ש"ח, ולכן אנחנו גובים את הסכום הזה לאחר כל השמה מוצלחת בעז"ה (התשלום לאחר הודעת הקבלה לארגון)`,
        "נשמח לקבל עדכון כשיצרו איתך קשר לראיון או מבחן",
        "מאחלות לך הצלחה וסייעתא דשמיא, צוות קוד פתוח",
      ],
    }),
  };
}

/** Warm update to an applicant when the admin moves her along the client pipeline. */
export function applicationPipelineEmail(
  name: string | undefined,
  jobTitle: string,
  status: "sent" | "interview" | "exam" | "hired" | "declined"
): BuiltEmail {
  const title = escapeHtml(jobTitle);
  const per = {
    sent: {
      subject: `המועמדות שלך הוגשה למעסיק 🤞 · ${jobTitle}`,
      heading: "המועמדות שלך אצל המעסיק 🤞",
      lines: [
        `עדכון טוב — הגשנו את המועמדות שלך למשרת <b>${title}</b> למעסיק.`,
        "ברגע שתהיה התקדמות נעדכן אותך מיד. בינתיים — מחזיקות אצבעות 💜",
      ],
      cta: true,
    },
    interview: {
      subject: `זומנת לראיון! 🎉 · ${jobTitle}`,
      heading: "זומנת לראיון! 🎉",
      lines: [
        `חדשות מצוינות — המועמדות שלך למשרת <b>${title}</b> מתקדמת, ואת מוזמנת לראיון!`,
        "זה הזמן לנשום עמוק, לעבור שוב על פרטי המשרה ולהגיע בדיוק כמו שאת. מחזיקות לך אצבעות 💜",
      ],
      cta: true,
    },
    exam: {
      subject: `יש מבחן בדרך 💪 · ${jobTitle}`,
      heading: "יש מבחן בדרך 💪",
      lines: [
        `בהמשך למועמדות שלך למשרת <b>${title}</b> — השלב הבא הוא מבחן.`,
        "קחי את הזמן להתכונן בנחת — את מסוגלת לזה לגמרי, ואנחנו כאן לכל שאלה 💜",
      ],
      cta: true,
    },
    hired: {
      subject: `מזל טוב! התקבלת 🎉 · ${jobTitle}`,
      heading: "מזל טוב! התקבלת 🎉",
      lines: [
        `איזו התרגשות — התקבלת למשרת <b>${title}</b>! 🎉`,
        "עבדת בשביל זה, וזה כולו שלך. מאחלות לך המון הצלחה בתפקיד החדש — ותמיד נשמח לשמוע איך הולך 💜",
      ],
      cta: false,
    },
    declined: {
      subject: `עדכון על המועמדות שלך · ${jobTitle}`,
      heading: "הפעם זה לא התקדם 💜",
      lines: [
        `המועמדות שלך למשרת <b>${title}</b> לא התקדמה הפעם. זה קורה לכולן — וזה לא אומר כלום עלייך.`,
        "יש עוד משרות שמחכות לך, ואנחנו ממשיכות לחפש בשבילך. אנחנו כאן 💜",
      ],
      cta: true,
    },
  }[status];

  return {
    subject: per.subject,
    html: renderEmail({
      heading: per.heading,
      lines: [...(name ? [`היי ${escapeHtml(name)},`] : []), ...per.lines],
      ...(per.cta ? { ctaText: "לכל המשרות", ctaUrl: `${SITE}/jobs` } : {}),
    }),
  };
}

/**
 * Tell a member a job was published specifically to her (targeted audience).
 * The description is a plain-text excerpt — never raw HTML from the editor.
 */
export function jobPublishedEmail(
  name: string | undefined,
  jobTitle: string,
  descriptionText: string,
  applyUrl: string
): BuiltEmail {
  return {
    subject: "משרה חדשה במיוחד בשבילך 💼",
    html: renderEmail({
      heading: "משרה חדשה במיוחד בשבילך 💼",
      lines: [
        `${name ? `היי ${escapeHtml(name)}, ` : "היי, "}חשבנו עלייך! פתחנו משרה חדשה שנראית לנו מתאימה בדיוק לך:`,
        // The client's name is confidential — the role speaks for itself.
        `<b>${escapeHtml(jobTitle)}</b> · משרה בלעדית דרך קוד פתוח`,
        ...(descriptionText ? [escapeHtml(descriptionText)] : []),
        "מחכות לראות את המועמדות שלך 💜",
      ],
      ctaText: "לצפייה והגשה",
      ctaUrl: applyUrl,
      footnote: "המשרה פורסמה לקבוצה מצומצמת של חברות שמתאימות לה — שווה להגיש מוקדם.",
    }),
  };
}

/** Short confirmation to a member right after she submits an application. */
export function applyConfirmationEmail(name: string | undefined, jobTitle: string): BuiltEmail {
  return {
    subject: "קיבלנו את המועמדות שלך 💜",
    html: renderEmail({
      heading: "קיבלנו את המועמדות שלך 💜",
      lines: [
        `${name ? `היי ${escapeHtml(name)}, ` : ""}המועמדות שלך למשרת <b>${escapeHtml(jobTitle)}</b> הוגשה בהצלחה 🎉`,
        "אנחנו עוברות על כל הגשה באופן אישי — נעדכן אותך בכל התקדמות.",
      ],
      ctaText: "לכל המשרות",
      ctaUrl: `${SITE}/jobs`,
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
      ctaUrl: toSiteAuthLink(actionUrl),
      footnote: "אם לא ביקשת זאת, אפשר להתעלם מהמייל.",
    }),
  };
}

// ---------------------------------------------------------------- mentors

/** Sent when an admin approves a mentor application. */
export function mentorApprovedEmail(name?: string): BuiltEmail {
  return {
    subject: "אושרת כמנטורית בקוד פתוח 👑",
    html: renderEmail({
      heading: `${name ? `${escapeHtml(name)}, ` : ""}ברוכה הבאה למנטוריות שלנו 👑`,
      lines: [
        "עברנו על הבקשה שלך — ואנחנו שמחות לצרף אותך לצוות המנטוריות של הקהילה 💜",
        "מהרגע הזה הפרופיל שלך מסומן כמנטורית: תוכלי לענות בפורום, להתכתב עם חברות, להצטרף לסשנים — ולעשות בדיוק את ההבדל שבשבילו באת.",
      ],
      ctaText: "כניסה לקהילה",
      ctaUrl: `${SITE}/forum`,
      footnote: "תודה שאת בוחרת לתרום מהניסיון שלך. זה שווה המון 💜",
    }),
  };
}

// ---------------------------------------------------- subscription lifecycle

/** Right after she cancels auto-renewal in the app. */
export function subscriptionCanceledEmail(name: string | undefined, activeUntil: string): BuiltEmail {
  return {
    subject: "ביטלת את חידוש המנוי — את איתנו עד " + activeUntil,
    html: renderEmail({
      heading: `${name ? `${escapeHtml(name)}, ` : ""}קיבלנו את הביטול 💜`,
      lines: [
        `המנוי שלך יישאר פעיל עד <b>${activeUntil}</b> — עד אז הכול נשאר פתוח בדיוק כמו היום.`,
        "אחרי התאריך הזה הגישה לקורסים, להקלטות, לצ'אט ולכלי ה-AI תיסגר, אבל תמיד אפשר לחזור.",
        "התחרטת? אפשר להפעיל את החידוש מחדש בלחיצה אחת מעמוד הפרופיל.",
      ],
      ctaText: "לעמוד הפרופיל שלי",
      ctaUrl: `${SITE}/profile`,
      footnote: "אם הביטול לא היה מכוון — כתבי לנו ונסדר הכול יחד.",
    }),
  };
}

/** The day the subscription actually ends (sent by the daily cron). */
export function subscriptionEndedEmail(name: string | undefined): BuiltEmail {
  return {
    subject: "המנוי שלך בקוד פתוח הסתיים — נשמח לראות אותך חוזרת 💜",
    html: renderEmail({
      heading: `${name ? `${escapeHtml(name)}, ` : ""}המנוי שלך הסתיים`,
      lines: [
        "תקופת המנוי שלך הגיעה לסיומה, והגישה לקורסים, להקלטות, לצ'אט ולכלי ה-AI הושהתה.",
        "את עדיין חלק מהקהילה — אפשר להמשיך לקרוא ולהתעדכן, ולחדש מתי שמתאים לך.",
      ],
      ctaText: "לחידוש המנוי",
      ctaUrl: `${SITE}/join`,
      footnote: "יש שאלה על החיוב או על המנוי? כתבי לנו ונעזור.",
    }),
  };
}

// ------------------------------------------------------- session reminders

const REMINDER_COPY: Record<string, (title: string, time: string) => { subject: string; heading: string; line: string }> = {
  morning: (title, time) => ({
    subject: `היום ב-${time}: ${title}`,
    heading: "יש לנו סשן היום 🎉",
    line: `<b>${title}</b> מתחיל היום בשעה <b>${time}</b> (שעון ישראל). שמרי לך את הזמן — נשמח לראות אותך.`,
  }),
  t30: (title, time) => ({
    subject: `בעוד חצי שעה: ${title}`,
    heading: "עוד חצי שעה מתחילים ⏰",
    line: `<b>${title}</b> מתחיל ב-<b>${time}</b>. כדאי להכין קפה ולהתארגן 🙂`,
  }),
  start: (title) => ({
    subject: `עכשיו מתחילים 💜 ${title}`,
    heading: "אנחנו מתחילות ממש עכשיו 💜",
    line: `<b>${title}</b> מתחיל ברגעים אלה — מחכות לך בפנים.`,
  }),
};

/** One of the three session reminder emails (stage: morning / t30 / start). */
export function sessionReminderEmail(
  stage: "morning" | "t30" | "start",
  title: string,
  timeIL: string,
  zoomUrl: string | null
): BuiltEmail {
  const c = REMINDER_COPY[stage](escapeHtml(title), timeIL);
  return {
    subject: c.subject,
    html: renderEmail({
      heading: c.heading,
      lines: [c.line],
      ctaText: zoomUrl ? "הצטרפות לזום" : "לפרטי הסשן",
      ctaUrl: zoomUrl || `${SITE}/events`,
      footnote: "התזכורות נשלחות למנויות הקהילה. נתראה שם 💜",
    }),
  };
}
