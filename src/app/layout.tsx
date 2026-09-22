import type { Metadata } from "next";
import { Noto_Sans_Hebrew, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site";

// Noto Sans Hebrew is a variable font - omit `weight` to get the full 300–900 range.
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

const SITE = getSiteUrl();
const DESCRIPTION =
  "קהילה חמה ותומכת לג'וניוריות בתחום הפיתוח - כלי AI, סימולטור ראיונות, קורסים, לוח משרות ומנטוריות. אנחנו ביחד.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "קהילת קוד פתוח - פותחים לך דלת להייטק",
    template: "%s · קהילת קוד פתוח",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "קהילת קוד פתוח",
    locale: "he_IL",
    title: "קהילת קוד פתוח - פותחים לך דלת להייטק",
    description: DESCRIPTION,
    images: [{ url: "/logo-opencode.png" }],
  },
};

// Structured data for search engines (the owner, 22/9): who we are and the
// site's main sections. Sitelinks themselves are Google's decision - this
// gives it clean signals to decide with.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "קהילת קוד פתוח",
      url: SITE,
      logo: `${SITE}/logo-opencode.png`,
      email: "office@opencode.org.il",
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#site`,
      url: SITE,
      name: "קהילת קוד פתוח",
      inLanguage: "he",
      publisher: { "@id": `${SITE}/#org` },
    },
    {
      "@type": "ItemList",
      name: "אזורי האתר",
      itemListElement: [
        { "@type": "SiteNavigationElement", position: 1, name: "הצטרפות לקהילה", url: `${SITE}/join` },
        { "@type": "SiteNavigationElement", position: 2, name: "האקתון AI 2026", url: `${SITE}/hackathon-2026` },
        { "@type": "SiteNavigationElement", position: 3, name: "שותפים וספונסרים", url: `${SITE}/hackathon-2026/partners` },
        { "@type": "SiteNavigationElement", position: 4, name: "כניסה לקהילה", url: `${SITE}/login` },
        { "@type": "SiteNavigationElement", position: 5, name: "מדיניות פרטיות", url: `${SITE}/privacy` },
      ],
    },
  ],
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
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
      </body>
    </html>
  );
}
