import { CONF, INSTALL_TITLE, UPDATE_TEXT, courseUpdateSubject, installListFor, kindNeedsLaptop, personalAreaOpenAt, type PrepKind } from "./config";

/*
  ״הייטקורס 2026 - מידע חשוב לפני הכנס״ - the pre-conference letter, built per
  participant from her row in the owner's sheet. The 2025 letter (the Apps
  Script's buildPreConferenceEmailHtml_) is the base; what the owner asked for
  on 19/11 is new: replies to the office, logistics questions to יהודית, the
  deadline for lodging, babysitting and the laptop (״מוצאי שבת בשעה 23:00״),
  the push to the personal area for whoever has not updated it, the laptop +
  AI tools block with the rental option and the questionnaire button, the
  program attached and shown, the sheet's notes (״נדרש אישור חברה״) printed
  prominently, and bigger headings. 20/11: the owner's wording round - the
  deadline as ״מוצאי שבת הקרובה בשעה 23:00״, the ״קורס דיגיטלי נוסף״ section,
  the kashrut and parking texts; later that morning: the deadline Sunday
  10:00, one font everywhere (״שכל הפונט יהיה זהה - אריאל״), the caterer's
  logo, no deadline in the personal-area block. Tables and inline styles only
  (mail clients).
*/
const F = "font-family:Arial, Helvetica, sans-serif;";
/** Every element that carries a style gets the font too - mail clients do not reliably inherit it (the owner: ״שכל הפונט יהיה זהה - אריאל״). */
const withFont = (html: string) => html.replace(/style="/g, `style="${F} `);
// Never a weight above 700: Chrome on Windows resolves Arial at 800/900 to Arial Black, which has no Hebrew glyphs,
// and the Hebrew then falls back to a serif font (the owner's screenshot, 20/11: ״עדיין יש הבדלי פונטים״).
const H = { navy: "#004878", yellow: "#F8C800", yellowSoft: "#FFF4C2", bg: "#E6EFF7", ink: "#1C2B3A", body: "#3B4C5E", muted: "#5E7183", line: "#D9E2EC", red: "#C0392B", redSoft: "#FDECEA", blueSoft: "#EEF4F9" };

export interface PrepMailInput {
  firstName: string;
  lastName: string;
  idNumber: string;
  /** the canonical course name */
  course: string;
  /** the sheet's note after the course (״נדרש אישור חברה למעבר״, ״נדרש לבחור…״) - printed prominently */
  courseNote: string;
  kind: PrepKind;
  laptopRequired: boolean;
  lodging: string;
  lodgingPaid: string;
  certCourse: string;
  laptopRental: string;
  laptopRentalPaid: string;
  sitterMorning: string;
  sitterEvening: string;
  sitterMorningPaid: string;
  sitterEveningPaid: string;
  /** ״עדכון״ = כן in the sheet */
  updatedPersonal: boolean;
  /** the questionnaire link for her token */
  formUrl: string;
  /** the site that hosts the logo and the program */
  siteUrl: string;
  /** the program image (shown in the letter, attached to the mail) */
  programUrl: string;
}

const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const yes = (v: string) => (v ?? "").trim() === "כן";
const no = (v: string) => (v ?? "").trim() === "לא";

const p = (html: string, extra = "") => `<p style="margin:0 0 12px; font-size:15.5px; line-height:1.75; color:${H.body};${extra}">${html}</p>`;
/** A section heading - big and clear (the owner: ״תדגיש ותגדיל את הכותרות של כל נושא״). */
const h2 = (text: string) => `<h2 style="margin:0 0 4px; font-size:23px; line-height:1.3; font-weight:700; color:${H.navy};">${text}</h2><div style="width:56px; height:4px; background:${H.yellow}; border-radius:2px; margin:0 0 14px;"></div>`;
const section = (inner: string) => `<tr><td style="padding:24px 28px 10px; border-top:1px solid ${H.line};">${inner}</td></tr>`;
const redLine = (text: string) => `<p style="margin:0 0 12px; font-size:15.5px; line-height:1.7; font-weight:700; color:${H.red};">${text}</p>`;
const button = (href: string, text: string, tone: "yellow" | "navy" = "navy") =>
  `<a href="${href}" style="display:inline-block; background:${tone === "yellow" ? H.yellow : H.navy}; color:${tone === "yellow" ? H.navy : "#ffffff"}; text-decoration:none; font-weight:700; font-size:16px; padding:14px 30px; border-radius:999px;">${text}</a>`;
const box = (inner: string, tone: "yellow" | "red" | "blue" | "navy") => {
  const bg = tone === "yellow" ? H.yellowSoft : tone === "red" ? H.redSoft : tone === "blue" ? H.blueSoft : H.navy;
  const bar = tone === "yellow" ? H.yellow : tone === "red" ? H.red : H.navy;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:${bg}; border-right:5px solid ${bar}; border-radius:12px; padding:14px 16px;">${inner}</td></tr></table>`;
};

function deadlineBox(laptop: boolean): string {
  return box(
    `<div style="font-size:17px; font-weight:700; color:${H.navy}; margin-bottom:6px;">הרישום ללינה ולשמרטפיה${laptop ? " ולהשכרת מחשב" : ""} נסגר ב${CONF.deadline}.</div>
     <div style="font-size:14.5px; line-height:1.65; color:${H.ink};">רוצה להוסיף לינה, חדר פרטי או שמרטפיה לבוקר ולערב? זה אפשרי רק עד ${CONF.deadline}, באזור האישי שלך ב<a href="${CONF.site}" style="color:${H.navy}; font-weight:700;">אתר שלנו</a>.${laptop ? ` גם הזמנת <b>מחשב נייד להשכרה</b> נסגרת אז.` : ""}</div>`,
    "yellow"
  );
}

function personalAreaBlock(updated: boolean): string {
  if (!updated) {
    return box(
      `<div style="font-size:16px; font-weight:700; color:${H.red}; margin-bottom:6px;">עוד לא עדכנת את הפרטים שלך באזור האישי</div>
       <div style="font-size:14.5px; line-height:1.65; color:${H.ink}; margin-bottom:12px;">לפי הרישום אצלנו, הפרטים באזור האישי עדיין לא עודכנו. כדי שנדע מה להכין לך - לינה, שמרטפיה, מחשב - היכנסי לאזור האישי ואשרי או עדכני את הפרטים.</div>
       ${button(CONF.site, "לאזור האישי באתר הייטקורס", "navy")}`,
      "red"
    );
  }
  return p(`הפרטים שלך באזור האישי מעודכנים - תודה. רוצה לשנות משהו? אפשר ב<a href="${CONF.site}" style="color:${H.navy}; font-weight:700;">אתר הייטקורס</a>.`);
}

function detailsCard(i: PrepMailInput): string {
  const row = (k: string, v: string) => `<tr><td style="padding:7px 0 7px 12px; font-size:14px; font-weight:700; color:${H.muted}; width:120px; vertical-align:top; white-space:nowrap;">${k}</td><td style="padding:7px 0; font-size:15.5px; line-height:1.55; color:${H.ink}; vertical-align:top;">${v}</td></tr>`;
  const cert = i.certCourse && i.certCourse !== i.course ? row("תעודה על הקורס הדיגיטלי", `<b>${esc(i.certCourse)}</b>`) : "";
  const lodgingText = i.lodging ? esc(i.lodging) : "לא";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${H.blueSoft}; border-radius:14px; margin:0 0 12px;"><tr><td style="padding:10px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("שם", `<b>${esc(i.firstName)} ${esc(i.lastName)}</b>`)}
      ${i.idNumber ? row("ת.ז.", `<span dir="ltr">${esc(i.idNumber)}</span>`) : ""}
      ${row("קורס פרונטלי", `<b>${esc(i.course)}</b>`)}
      ${row("לינה", `<b>${lodgingText}</b>`)}
      ${cert}
    </table></td></tr></table>`;
}

/** The sheet's note after the course name, printed so it cannot be missed (the owner: ״תכתוב בצורה בולטת את ההערה הזו״). */
function courseNoteBox(note: string): string {
  if (!note) return "";
  return box(`<div style="font-size:16px; font-weight:700; color:${H.red};">שימי לב: ${esc(note)}</div><div style="font-size:14px; line-height:1.6; color:${H.ink}; margin-top:4px;">כך רשום אצלנו ליד הקורס שלך. לשאלות - פשוט השיבי למייל הזה.</div>`, "red");
}

function laptopSection(i: PrepMailInput): string {
  if (i.kind === "unknown") {
    return `${h2("מה צריך עבור הקורס שלך?")}
      ${p(`הקורס שלך עוד לא נקבע סופית${i.courseNote ? ` (<b>${esc(i.courseNote)}</b>)` : ""}. ברגע שייקבע נעדכן אותך מה צריך להביא.`)}
      ${p(`בינתיים נשמח לכמה פרטים קצרים (דקה אחת):`)}
      <div style="margin:4px 0 16px;">${button(i.formUrl, "כמה פרטים לקראת הקורס", "navy")}</div>`;
  }
  const laptop = i.laptopRequired || kindNeedsLaptop(i.kind);
  if (!laptop) {
    return `${h2("מה צריך עבור הקורס שלך?")}
      ${p(`נרשמת לקורס <b>${esc(i.course)}</b>. <b>לקורס שלך לא נדרש מחשב נייד.</b>`)}
      ${p(`כדי שנכיר אותך לפני הקורס - נשמח לכמה פרטים קצרים (דקה אחת):`)}
      <div style="margin:4px 0 16px;">${button(i.formUrl, "כמה פרטים לקראת הקורס", "navy")}</div>`;
  }
  let rental = "";
  if (yes(i.laptopRental)) {
    rental = p(`הזמנת מחשב מהשכרה - הוא ימתין לך בעמדת השכרת המחשבים.`);
    if (no(i.laptopRentalPaid)) rental += redLine("יש להסדיר את התשלום עבור השכרת המחשב.");
  } else {
    rental = p(`<b>אין לך מחשב נייד?</b> אפשר להשכיר מחשב ב<a href="${CONF.site}" style="color:${H.navy}; font-weight:700;">אזור האישי</a> במחיר של <b>${CONF.laptopRentalNis} ש״ח</b> למחשב לשעות הקורס. ההזמנה עד <b>${CONF.deadline}</b>, כדי שנספיק להזמין.`);
  }
  // the installations the course needs on the laptop (the owner, 19/11 night) - only the courses that have a list
  const install = installListFor(i.course);
  const installBox = install
    ? box(
        `<div style="font-size:16px; font-weight:700; color:${H.navy}; margin-bottom:4px;">${INSTALL_TITLE}</div>
         <ul style="margin:0; padding:0 22px 0 0; font-size:15.5px; line-height:1.8; font-weight:700; color:${H.ink};">${install.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`,
        "yellow"
      )
    : "";
  return `${h2("מה צריך עבור הקורס שלך?")}
    ${p(`נרשמת לקורס <b>${esc(i.course)}</b>.`)}
    ${box(
      `<div style="font-size:16.5px; font-weight:700; color:#ffffff; margin-bottom:6px;">בקורס הזה נדרש להביא מחשב נייד</div>
       <div style="font-size:14.5px; line-height:1.65; color:#DCE8F2;">התרגול בקורס נעשה עם <b style="color:${H.yellow};">כלי AI</b>, ולכן חשוב להגיע עם מחשב שאפשר להתקין ולעבוד עליו במהלך הקורס.</div>`,
      "navy"
    )}
    ${installBox}
    ${rental}
    ${p(`<b>מגיעה עם מחשב או בלי?</b> ספרי לנו בשאלון קצר (דקה אחת): תפקיד, מחשב נייד וכלי ה-AI שיש לך.`)}
    <div style="margin:4px 0 16px;">${button(i.formUrl, "לשאלון - מגיעה עם מחשב?", "yellow")}</div>`;
}

function babysitSection(i: PrepMailInput): string {
  const m = yes(i.sitterMorning);
  const e = yes(i.sitterEvening);
  let dyn = "";
  if (m && e) dyn = p("<b>נרשמת לשירותי השמרטפיה בבוקר ובערב.</b>");
  else if (m) dyn = p("<b>נרשמת לשירותי השמרטפיה בבוקר.</b>");
  else if (e) dyn = p("<b>נרשמת לשירותי השמרטפיה בערב.</b>");
  if ((m && no(i.sitterMorningPaid)) || (e && no(i.sitterEveningPaid))) dyn += redLine("יש להסדיר את התשלום עבור השמרטפיה.");
  if (m) {
    dyn += p("בשעות הבוקר המטפלות הן נשים מנוסות, כדי לאפשר לך מקסימום רוגע נפשי בשעות הקורס.");
    dyn += p("גם השמרטפיות צריכות לאכול ארוחת צהריים - שימי לב לקחת את התינוק לפני סוף הארוחה, כדי לאפשר להן לאכול ולחזור לשמור על התינוקות בזמן הקורס.");
  }
  return `${h2("שמרטפיה")}
    ${redLine("לא ניתן להיכנס למתחם הקורסים ולאירועי הערב עם תינוק כלל.")}
    ${p("מי שמגיעה עם תינוק נדרשת להשתמש בשירותי השמרטפיה, הרישום מראש בתשלום סמלי.")}
    ${dyn}
    ${p(`<b>לא ניתן להגיע עם תינוק אם לא נרשמת מראש</b> - כמות המטפלות מותאמת לכמות התינוקות, כדי לתת טיפול מיטבי. הרישום לשמרטפיה נסגר ב${CONF.deadline}.`)}
    ${p("בתוכניות הקלילות אחר הצהרים (סרט / סדנה) אפשר להיכנס בשמחה גם עם תינוקות.")}
    ${p("באירועי הערב (19:00-23:00) יש להשתמש בשמרטפיה.")}
    ${p("<b>השהות של התינוק בכנס ובשמרטפיה היא באחריות האמא בלבד.</b>")}`;
}

function kashrutSection(i: PrepMailInput): string {
  const breakfastNote = no(i.lodging) ? p("<b>אם אינך ישנה במלון</b> - יש לקחת שובר לארוחת הבוקר בכניסה לחדר האוכל, עד השעה 8:40.") : "";
  // the caterer's logo beside the meals line (the owner, 20/11: ״צרפתי לוגו של הקייטרינג״)
  const meals = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr>
      <td style="vertical-align:middle; padding:0 0 0 12px;">${p(`<b>ארוחות צהריים וערב</b> - מקייטרינג חיצוני בכשרות <b>בד״ץ עד״ח</b>.`, " margin:0;")}</td>
      <td style="width:150px; vertical-align:middle;"><img src="${i.siteUrl}${CONF.cateringLogoPath}" alt="יאמי - גורמה ויוקרה" width="150" style="display:block; width:150px; height:auto; border:0; border-radius:8px;" /></td>
    </tr></table>`;
  return `${h2("כשרות הכנס")}
    ${meals}
    ${p(`<b>הפסקת קפה ועוגות</b> - כל המוצרים בהשגחת <b>בד״ץ עד״ח</b>.`)}
    <h3 style="margin:14px 0 8px; font-size:17px; font-weight:700; color:${H.navy};">ארוחת הבוקר</h3>
    ${p("ארוחות הבוקר <b>ממטבח המלון</b>.")}
    ${p(`<b>המשגיח מטעמנו</b> שאחראי על הכשרת המטבח וכשרות המוצרים:<br><b>הרב עקיבא אוירבך</b> <span dir="ltr" style="white-space:nowrap;">052-7614823</span>`)}
    ${p(`<b>כשרות המוצרים</b> - עד״ח / הרב רובין / הרב לנדא / שארית<br><b>מוצרי חלב</b> - עד״ח / ועדת מהדרין<br><b>פירות וירקות</b> - הרב אפרתי / עד״ח<br><b>ירקות עלים</b> - עד״ח`)}
    ${p("<b>המטבח החלבי עבר הכשרה</b> - למעוניינות הכנו גם כלים וסכו״ם חד פעמי.")}
    ${breakfastNote}
    ${p("<b>ביום חמישי</b> ארוחת הבוקר תוגש כבופה בלובי (פואיה) ליד האולם.")}
    ${p("<b>רגישות לגלוטן</b> יכולות לגשת אלינו כדי לקבל מידע על מוצרים ללא גלוטן (המטבח לא נקי מגלוטן).")}`;
}

/** The letter for one participant. */
export function buildPrepMail(i: PrepMailInput): { subject: string; html: string } {
  const logo = `${i.siteUrl}/ai-course/hightecourse.png`;
  const first = esc(i.firstName || "");
  const laptop = i.kind !== "unknown" && (i.laptopRequired || kindNeedsLaptop(i.kind));
  const lodgingNote = yes(i.lodging) && no(i.lodgingPaid) ? redLine("יש להסדיר את התשלום עבור הלינה במלון.") : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(CONF.subject)}</title></head>
<body style="margin:0; padding:0; background:${H.bg};">
<div dir="rtl" style="background:${H.bg}; padding:28px 12px; color:${H.ink}; text-align:right;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid ${H.line};">
    <tr><td style="padding:22px 24px 16px; text-align:center;"><img src="${logo}" alt="הייטקורס - לחשוב בגדול" width="190" style="display:inline-block; width:190px; height:auto; border:0;" /></td></tr>
    <tr><td style="height:4px; background:${H.yellow}; font-size:0; line-height:0;">&nbsp;</td></tr>
    <tr><td style="background:${H.navy}; padding:22px 24px 24px; text-align:center;">
      <div style="font-size:13px; font-weight:700; color:${H.yellow}; margin-bottom:6px;">מידע חשוב לפני הכנס</div>
      <div style="font-size:30px; line-height:1.15; font-weight:700; color:#ffffff;">${CONF.title}</div>
      <div style="display:inline-block; margin-top:14px; background:${H.yellow}; color:${H.navy}; font-weight:700; font-size:14.5px; padding:8px 18px; border-radius:999px;">${CONF.hebrewDates} &nbsp;|&nbsp; ${CONF.dates}</div>
      <div style="margin-top:10px; font-size:13.5px; color:#C9D9E6;">${CONF.venue}</div>
    </td></tr>

    <tr><td style="padding:26px 28px 6px;">
      <h1 style="margin:0 0 12px; font-size:24px; line-height:1.3; font-weight:700; color:${H.navy};">שלום ${first},</h1>
      ${p(`<b>המייל ארוך... אבל חשוב ממש לקרוא עד הסוף.</b>`, ` font-size:16.5px; color:${H.ink};`)}
      ${p(`<b>הנה זה מגיע...</b> מתרגשות ממש לפגוש אותך ב${CONF.firstDay}, במלוא המרץ.`)}
      ${deadlineBox(laptop)}
      ${personalAreaBlock(i.updatedPersonal)}
    </td></tr>

    ${section(`${h2("הפרטים שלך")}
      ${p("נשמח אם תעברי עליהם ותראי שאין טעויות:")}
      ${detailsCard(i)}
      ${courseNoteBox(i.courseNote)}
      ${lodgingNote}
      ${redLine("לא ניתן לעבור בין קורסים במהלך הכנס.")}`)}

    ${section(laptopSection(i))}

    ${section(`${h2("קורס דיגיטלי נוסף")}
      ${p(`כדי להשלים ל-40 שעות קורס - את זכאית לבחור <b>קורס העשרה נוסף</b> ב<a href="${CONF.site}" style="color:${H.navy}; font-weight:700;">אזור האישי</a> והוא ישותף לך אוטומטית בתוך חצי שעה. אם את מעדיפה הקלטה ממגוון הקורסים החדשים בכנס - תמתיני כשבוע לאחר הכנס לאחר שנעלה אותם לאתר.`)}`)}

    ${section(`${h2("לוח הזמנים של הייטקורס")}
      ${p("יש לנו לו״ז צפוף ותוכניה עמוסה ומלאה (התוכניה המלאה מצורפת למייל הזה, וגם כאן למטה).")}
      ${p("כדי שנהנה עד הסוף - <b>חשוב מאוד לעמוד בזמנים</b>, ו... יש גם <b>מבצע מיוחד</b> למי שמקפידה להיכנס בזמן!")}
      ${p("<b>איך זה הולך?</b><br>בכל קורס יונחו כרטיסי הגרלה. נכנסת בזמן? תוכלי למלא כרטיס ולשלשל לתיבה במתחם ההגרלות. <b>כל מושב</b> מקנה לך כרטיס הגרלה נוסף ומגדיל את סיכוייך לזכות. <b>תוכלי להגיע ל-6 כרטיסי הגרלה!</b>")}
      ${p("ביום האחרון תוגרל <b>מתנה מפנקת</b> על כל יום. <b>שווה...</b>")}
      ${box(`<div style="font-size:14.5px; line-height:1.65; color:${H.ink};"><b>שימי לב:</b> במתחם מחכות לך <b>תיבות הגרלה שוות נוספות</b> (מי ביקשה מצלמה או שואב שוטף רובוטי?) - מוזמנת למלא את פרטייך ולהיכנס להגרלות.</div>`, "yellow")}`)}

    ${section(`${h2("התוכניה")}
      <a href="${i.programUrl}" style="display:block; text-decoration:none;"><img src="${i.programUrl}" alt="התוכניה של הייטקורס 2026" width="564" style="display:block; width:100%; max-width:564px; height:auto; border:1px solid ${H.line}; border-radius:12px;" /></a>
      ${p(`<a href="${i.programUrl}" style="color:${H.navy}; font-weight:700;">לחיצה על התוכניה פותחת אותה בגודל מלא</a>. היא גם מצורפת למייל הזה כקובץ.`, " margin-top:10px;")}`)}

    ${section(`${h2("אירועי הערב")}
      ${box(`<div style="font-size:15.5px; line-height:1.75; color:${H.ink};">עם פרסום התוכניה המושקעת של הייטקורס קיבלנו עשרות פניות של נשים שמבקשות להגיע רק לתוכניות הערב. אנחנו <b>לא מאפשרות באופן גורף</b>, גם לא במקום מי שחזרה הביתה - <b>המופעים המושקעים מיועדים למי שבחרה להירשם להייטקורס.</b></div>`, "yellow")}
      ${p("לכן - <b>הכניסה לאירועי הערב תהיה בהצגת התג האישי</b>, אותו תקבלי בכניסה לכנס.")}
      ${p(`<b>אם החלטת לא להגיע לערב</b> - נשמח אם תעדכני אותנו, אבל גם אם לא עדכנת אותנו - <b style="color:${H.red};">אל תזמיני אחרות במקומך!</b>`)}`)}

    ${section(babysitSection(i))}

    ${section(kashrutSection(i))}

    ${section(`${h2("חניה")}
      ${p("מלון VERT נמצא במיקום מרכזי על תוואי הרכבת הקלה (צמוד לבנייני האומה).")}
      ${p("הגענו להסדר עם הנהלת המלון על חניון המלון לאורחות הייטקורס ב-<b>30 ש״ח לכל כניסה עד 24 שעות</b> (במקום 80 ש״ח לאורחי המלון).")}
      ${p("התשלום בכרטיס אשראי במחסום של היציאה, לקבלת ההטבה יש לבקש מהצוות שלנו מדבקה להדביק על כרטיס הכניסה לחניה.")}`)}

    ${section(`${h2("טרמפים")}
      ${p(`כדי להקל על נסיעות משותפות פתחנו קובץ משותף: <a href="https://docs.google.com/spreadsheets/d/1Hl4bgKI3AHGO9YpXiXAahvQqeVZY1KvZ6kSlVGQYT38/edit?usp=sharing" style="color:${H.navy}; font-weight:700;">קובץ הטרמפים</a>. מי שיכולה לצרף נוסעות או מעוניינת להצטרף - יכולה לכתוב בקובץ ולחפש מישהי מתאימה. ההתנהלות בקובץ היא חופשית ולא מנוהלת על ידינו.`)}`)}

    ${section(`${h2("אחריות")}
      ${p("אין להייטקורס אחריות על החפצים האישיים של המשתתפות. מומלץ לא להשאיר חפצים חשובים ללא השגחה.")}`)}

    ${section(`${box(
      `<div style="font-size:15.5px; font-weight:700; color:${H.navy}; margin-bottom:6px;">יש שאלה?</div>
       <div style="font-size:14.5px; line-height:1.7; color:${H.ink};">אפשר פשוט להשיב למייל הזה - התשובות מגיעות ל-<a href="mailto:${CONF.replyTo}" style="color:${H.navy}; font-weight:700;" dir="ltr">${CONF.replyTo}</a>.<br>
       <b>שאלות טכניות בענייני לינה, שמרטפיה וכדומה</b> - ל${CONF.logistics.name}: <a href="mailto:${CONF.logistics.mail}" style="color:${H.navy}; font-weight:700;" dir="ltr">${CONF.logistics.mail}</a></div>`,
      "blue"
    )}
      <p style="margin:6px 0 16px; font-size:16px; line-height:1.7; color:${H.ink};"><b>מחכות לך!</b><br>שרה, תמר, תהילה, יהודית<br>וכל צוות הייטקורס</p>`)}
  </table>
  <div style="text-align:center; color:${H.muted}; font-size:12px; margin-top:16px;">${CONF.title} · ${CONF.hebrewDates} · ${CONF.dates} · ${CONF.venue}</div>
</div>
</body></html>`;
  return { subject: CONF.subject, html: withFont(html) };
}

/* ---- the per-course update (the owner, 22/11: ״צריך לשלוח לכל קורס עדכון על הכלים הנדרשים לקורס״) ---- */

export interface CourseUpdateInput {
  firstName: string;
  course: string;
  kind: PrepKind;
  laptopRequired: boolean;
  /** the course text the owner dictated - paragraphs, the first one bold */
  lines: string[];
  laptopOwn: string;
  laptopRental: string;
  laptopRentalPaid: string;
  /** she filled our questionnaire */
  answered: boolean;
  answerLaptop: "yes" | "no" | undefined;
  /** she ticked ״אין לי כלי AI עם רישיון״ */
  noTools: boolean;
  /** ״עדכון״ = כן in the sheet */
  updatedPersonal: boolean;
  /** what she chose in the sheet but has not paid for - labels (״הלינה במלון״, ״השמרטפיה בערב״…) */
  unpaid: string[];
  formUrl: string;
  siteUrl: string;
  /** when the mail is built - decides whether the personal area is still open */
  now?: Date;
}

const joinHe = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ו${xs[xs.length - 1]}`);

/** One numbered action: a navy circle with the number, a bold title, the content. */
const step = (n: number, title: string, inner: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td style="width:40px; vertical-align:top; padding:0 0 0 12px;"><div style="width:32px; height:32px; line-height:32px; border-radius:16px; background:${H.navy}; color:${H.yellow}; font-size:17px; font-weight:700; text-align:center;">${n}</div></td>
    <td style="vertical-align:top;"><div style="font-size:19px; line-height:1.3; font-weight:700; color:${H.navy}; margin:3px 0 8px;">${title}</div>${inner}</td>
  </tr></table>`;

/**
 * ״הכלים הנדרשים לקורס״ (the owner, 22/11: ״קצר, ממוקד ומניע לפעולה״; ״הכותרת של המייל נראית אותו דבר… הן יכולות
 * להתבלבל ולא לקרוא״): a yellow header instead of the navy band of the first letter, then up to three numbered
 * actions - what the course needs (her text, the laptop and her rental state), the questionnaire for whoever has
 * not filled it (״כדי שנוכל להתארגן על הנדרש לקורס נא למלא בהקדם את הטופס הזה״ + the pairs note), and the personal
 * area that closes at 15:00 (״אנחנו מעבירות היום את שיבוץ החדרים למלון״) with a clear referral for whoever has not
 * updated or paid. After the closing the wording turns to ״סגור״. Arial, weight ≤ 700, tables and inline styles.
 */
export function buildCourseUpdateMail(i: CourseUpdateInput): { subject: string; html: string } {
  const now = i.now ?? new Date();
  const open = personalAreaOpenAt(now);
  const logo = `${i.siteUrl}/ai-course/hightecourse.png`;
  const first = esc(i.firstName || "");
  const laptop = i.kind !== "unknown" && (i.laptopRequired || kindNeedsLaptop(i.kind));
  const linesSayPairs = i.lines.some((l) => l.includes("בזוגות"));
  const small = (html: string) => `<div style="font-size:14.5px; line-height:1.65; color:${H.ink};">${html}</div>`;

  /* 1. what the course needs */
  let need = i.lines.map((l, idx) => p(idx === 0 ? `<b>${esc(l)}</b>` : esc(l), " margin-bottom:8px;")).join("");
  if (laptop) {
    const install = installListFor(i.course);
    need += p(`<b>בקורס הזה נדרש להביא מחשב נייד.</b>`, " margin-bottom:8px;");
    if (install) need += box(`<div style="font-size:15px; font-weight:700; color:${H.navy}; margin-bottom:2px;">${INSTALL_TITLE}</div><div style="font-size:15px; line-height:1.7; font-weight:700; color:${H.ink};">${install.map(esc).join(" · ")}</div>`, "yellow");
    if (yes(i.laptopRental)) {
      need += p(`הזמנת מחשב מהשכרה - הוא ימתין לך בעמדת השכרת המחשבים.`, " margin-bottom:8px;");
      if (no(i.laptopRentalPaid)) need += redLine("יש להסדיר את התשלום עבור השכרת המחשב.");
    } else if (i.answerLaptop === "no") {
      need += open
        ? redLine(`סימנת בשאלון שאת מגיעה בלי מחשב, ולא הזמנת מחשב להשכרה - אפשר להזמין ב<a href="${CONF.site}" style="color:${H.red};">אזור האישי</a> (${CONF.laptopRentalNis} ש״ח) עד ${CONF.personalAreaCloseShort}.`)
        : redLine(`סימנת בשאלון שאת מגיעה בלי מחשב, ולא הזמנת מחשב להשכרה. ההשכרה נסגרה - לשאלות פני ל${CONF.logistics.name}: <a href="mailto:${CONF.logistics.mail}" style="color:${H.red};" dir="ltr">${CONF.logistics.mail}</a>.`);
    } else if (!yes(i.laptopOwn) && !i.answered && open) {
      need += p(`אין לך מחשב נייד? השכרה ב<a href="${CONF.site}" style="color:${H.navy}; font-weight:700;">אזור האישי</a> (${CONF.laptopRentalNis} ש״ח) עד <b>${CONF.personalAreaCloseShort}</b>.`, " margin-bottom:8px;");
    }
  }
  if (i.answered && i.noTools && !linesSayPairs) need += small(esc(UPDATE_TEXT.pairs));

  /* 2. the questionnaire - only for whoever has not filled it */
  const form = !i.answered
    ? `${p(`<b style="color:${H.red};">${esc(UPDATE_TEXT.fillForm)}</b>`, " margin-bottom:10px;")}
       <div style="margin:0 0 10px;">${button(i.formUrl, "למילוי הטופס - דקה אחת", "navy")}</div>
       ${small(esc(UPDATE_TEXT.pairs))}`
    : "";

  /* 3. the personal area */
  const needsPersonal = !i.updatedPersonal || i.unpaid.length > 0;
  let personal = p(open ? `<b>${esc(UPDATE_TEXT.hotelToday)}</b>` : `<b>${esc(UPDATE_TEXT.hotelDone)}</b> האזור האישי באתר סגור לעדכון לינה, שמרטפיה והשכרת מחשב.`, " margin-bottom:10px;");
  if (needsPersonal) {
    personal += box(
      `<div style="font-size:15.5px; font-weight:700; color:${H.red}; margin-bottom:4px;">לפי הרישום אצלנו:</div>
       <ul style="margin:0 0 10px; padding:0 20px 0 0; font-size:15px; line-height:1.7; color:${H.ink};">
         ${!i.updatedPersonal ? `<li>הפרטים שלך <b>באזור האישי עדיין לא עודכנו</b>.</li>` : ""}
         ${i.unpaid.length ? `<li>התשלום עבור <b>${esc(joinHe(i.unpaid))}</b> עדיין לא הוסדר.</li>` : ""}
       </ul>
       ${open ? "" : `<div style="font-size:14.5px; line-height:1.65; color:${H.ink}; margin-bottom:10px;">לתשלום - האזור האישי. שינוי בלינה או בשמרטפיה כבר לא אפשרי; לשאלות - ${CONF.logistics.name}: <a href="mailto:${CONF.logistics.mail}" style="color:${H.navy}; font-weight:700;" dir="ltr">${CONF.logistics.mail}</a>.</div>`}
       ${button(CONF.site, open ? `לאזור האישי - עד ${CONF.personalAreaCloseShort}` : "לאזור האישי באתר הייטקורס", "navy")}`,
      "red"
    );
  } else {
    personal += p(`הפרטים שלך באזור האישי מעודכנים והתשלומים הוסדרו - תודה.`, " margin-bottom:0;");
  }

  const steps: [string, string][] = [["מה צריך לקורס", need]];
  if (form) steps.push(["הטופס הקצר", form]);
  steps.push([open ? `האזור האישי נסגר ${CONF.personalAreaCloseShort}` : "האזור האישי סגור", personal]);

  const subject = courseUpdateSubject(i.course);
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0; padding:0; background:${H.bg};">
<div style="display:none; max-height:0; overflow:hidden; font-size:1px; line-height:1px; color:${H.bg};">${esc(UPDATE_TEXT.preheader)}</div>
<div dir="rtl" style="background:${H.bg}; padding:28px 12px; color:${H.ink}; text-align:right;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid ${H.line};">
    <tr><td style="background:${H.yellow}; padding:24px 28px 22px;">
      <div style="font-size:13.5px; font-weight:700; color:${H.navy}; margin-bottom:6px;">${CONF.title} · ${esc(i.course)}</div>
      <div style="font-size:30px; line-height:1.2; font-weight:700; color:${H.navy};">עדכון קצר לפני הקורס שלך</div>
      <div style="font-size:15.5px; font-weight:700; color:${H.navy}; margin-top:8px;">${steps.length === 3 ? "שלושה דברים" : "שני דברים"}, דקה אחת.</div>
    </td></tr>
    <tr><td style="height:4px; background:${H.navy}; font-size:0; line-height:0;">&nbsp;</td></tr>

    <tr><td style="padding:24px 28px 8px;">
      <h1 style="margin:0 0 18px; font-size:22px; line-height:1.3; font-weight:700; color:${H.navy};">שלום ${first},</h1>
      ${steps.map(([title, inner], idx) => step(idx + 1, title, inner)).join("")}
    </td></tr>

    <tr><td style="padding:14px 28px 22px; border-top:1px solid ${H.line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><div style="font-size:14.5px; line-height:1.6; color:${H.ink};"><b>שאלות?</b> פשוט השיבי למייל הזה.<br>שאלות על לינה ושמרטפיה - ל${CONF.logistics.name}: <a href="mailto:${CONF.logistics.mail}" style="color:${H.navy}; font-weight:700;" dir="ltr">${CONF.logistics.mail}</a></div>
          <div style="font-size:14.5px; font-weight:700; color:${H.navy}; margin-top:8px;">צוות הייטקורס</div></td>
        <td style="width:110px; vertical-align:middle; text-align:left;"><img src="${logo}" alt="הייטקורס" width="100" style="display:inline-block; width:100px; height:auto; border:0;" /></td>
      </tr></table>
    </td></tr>
  </table>
  <div style="text-align:center; color:${H.muted}; font-size:12px; margin-top:16px;">${CONF.title} · ${CONF.hebrewDates} · ${CONF.dates} · ${CONF.venue}</div>
</div>
</body></html>`;
  return { subject, html: withFont(html) };
}
