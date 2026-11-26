import type { Metadata, Viewport } from "next";
import { rubik } from "../ai-course/font";
import { Kiosk } from "./kiosk";
import "./touch.css";

export const metadata: Metadata = { title: { absolute: "תני לנו את הטאצ' שלך · הייטקורס" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#002C4A" };

/**
 * The conference's touch screen (the owner, 26.11): ״תני לנו את הטאצ' שלך״ →
 * ״מתחילים?״ → ten anonymous questions → ״יש לנו את הטאצ' שלך!״ with confetti,
 * and back to the opening by itself. Public, no sign-in; the answers show as
 * live charts on /touch/screen.
 */
export default function TouchPage() {
  return <Kiosk fontClass={rubik.className} />;
}
