// Palette + contact link shared by the course pages. No server imports here -
// the client registration form uses it too.
// The ad's palette.
export const C = {
  bg: "#EEF4F4",
  navy: "#23405F",
  teal: "#9CCFCB",
  tealDeep: "#5FB0AA",
  yellow: "#F3C532",
  pink: "#C9386C",
  orange: "#F27A3D",
  ink: "#2B3A4A",
  muted: "#6B7A8A",
};

// Contact on the course pages (the owner, 4/10: phone + email, no WhatsApp).
// The number is the community office line until the owner sends the course one.
export const CONTACT_PHONE = "02-580-0296";
export const CONTACT_PHONE_HREF = "tel:+97225800296";
export const CONTACT_EMAIL = "office@opencode.org.il";
// Questions about the registration go to Shufra too (the owner, 9/10) - each
// mail link opens with a subject that says what it is about.
export const SHUFRA_EMAIL = "info@shufra.org.il";
export const COURSE_MAIL_SUBJECT = "שאלה על ההרשמה לקורס מאסטרית בהייטק";
export function courseMailto(address: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(COURSE_MAIL_SUBJECT)}`;
}
