// The pieces of בקשות השלמה that client components need too: the kinds, their
// labels, and the row shape. No server imports here.
export type RequestKind = "login" | "product" | "video" | "repo";
export const REQUEST_KINDS: RequestKind[] = ["login", "product", "video", "repo"];
export const KIND_LABEL: Record<RequestKind, string> = {
  login: "פרטי כניסה למערכת",
  product: "המערכת לא זמינה",
  video: "הסרטון",
  repo: "הריפו",
};
/** What the team is asked to send back, per kind - the field's label on her page. */
export const KIND_ASK: Record<RequestKind, string> = {
  login: "פרטי משתמש להדגמה: שם משתמש או מייל + סיסמה, או קוד גישה - לכל סוג משתמשת שיש במערכת",
  product: "הכתובת שבה המערכת עולה ועובדת בענן",
  video: "קישור מתוקן לסרטון (קובץ בדרייב, פתוח ל״כל מי שיש את הקישור״)",
  repo: "הקישור לריפו הציבורי",
};

export interface RequestItem {
  kind: RequestKind;
  detail: string;
}
export interface ReviewResponse {
  login?: string;
  product_url?: string;
  video_url?: string;
  repo_url?: string;
  note?: string;
}
export interface ReviewRequest {
  id: string;
  teamKey: string;
  items: RequestItem[];
  dueAt: string;
  emailSubject: string | null;
  emailHtml: string | null;
  sentAt: string | null;
  sentTo: string[];
  sendError: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  response: ReviewResponse | null;
  createdAt: string;
}
