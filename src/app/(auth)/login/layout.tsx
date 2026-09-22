import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "כניסה",
  description: "כניסה לחשבון שלך בקהילת קוד פתוח.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
