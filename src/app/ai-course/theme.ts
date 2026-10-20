// Hightecourse brand palette, sampled from the logo and the printed syllabus
// (not Open Code's colors - the owner, 20/10: "בעיצוב של הייטקורס").
// No server imports here - the client quiz uses it too.
export const H = {
  navy: "#004878",
  navyDeep: "#003A61",
  yellow: "#F8C800",
  yellowSoft: "#FFF4C2",
  bg: "#F6F8FA",
  row: "#EEF2F6",
  ink: "#1C2B3A",
  muted: "#5E7183",
  line: "#D9E2EC",
  white: "#FFFFFF",
  green: "#1E7F4F",
  red: "#C0392B",
};

export const LOGO = { src: "/ai-course/hightecourse.png", alt: "הייטקורס - לחשוב בגדול", width: 2856, height: 833 };
/** The syllabus footer line, word for word. */
export const TAGLINE = "הייטקורס. להתמקצע מהטובים ביותר";
/** "בשיתוף John Bryce" under the logo on every syllabus page. */
export const PARTNER = "John Bryce";

// Contact is the office mail only - the phone on the syllabus is the owner's
// own and she asked to keep it off the page (20/10).
export const CONTACT_EMAIL = "office@hightecourse.com";
export const MAIL_SUBJECT = "שאלה על קורסי פיתוח ה-AI";
export const contactMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}`;
