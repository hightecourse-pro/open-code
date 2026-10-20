// Hightecourse brand palette, sampled from the logo (not Open Code's colors -
// the owner, 20/10: "הצבעים בסגנון הייטקורס על הלוגו ולא קוד פתוח").
// No server imports here - the client quiz uses it too.
export const H = {
  navy: "#004878",
  navyDeep: "#003A61",
  yellow: "#F8C800",
  yellowSoft: "#FFF4C2",
  bg: "#F4F7FA",
  ink: "#1C2B3A",
  muted: "#5E7183",
  line: "#D9E2EC",
  white: "#FFFFFF",
  green: "#1E7F4F",
  red: "#C0392B",
};

export const CONTACT_PHONE = "050-4122899";
export const CONTACT_PHONE_HREF = "tel:+972504122899";
export const CONTACT_EMAIL = "office@hightecourse.com";
export const MAIL_SUBJECT = "שאלה על קורסי פיתוח ה-AI";
export const contactMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}`;
