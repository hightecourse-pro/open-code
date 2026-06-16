import type { Metadata } from "next";
import { Noto_Sans_Hebrew, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Noto Sans Hebrew is a variable font — omit `weight` to get the full 300–900 range.
const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  variable: "--font-noto-hebrew",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "קוד פתוח — קהילת ג'וניוריות בהייטק",
    template: "%s · קוד פתוח",
  },
  description:
    "קהילה חמה ותומכת לג'וניוריות בתחום הפיתוח — כלי AI, סימולטור ראיונות, קורסים, לוח משרות ומנטוריות. אנחנו ביחד.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${notoSansHebrew.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
