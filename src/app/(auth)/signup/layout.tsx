import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה",
  description: "פתיחת חשבון בקהילת קוד פתוח - קהילה לג'וניוריות בפיתוח.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
