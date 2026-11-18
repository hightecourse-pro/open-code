import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { rubik } from "../ai-course/font";
import { CONTACT_EMAIL, H, LOGO, TAGLINE, contactMailto } from "../ai-course/theme";
import { PATHS } from "./config";
import { Nav, UserMenu } from "./gate";

export const metadata: Metadata = {
  // every screen sets an absolute title - the community root template would add ״· קהילת קוד פתוח״ otherwise
  title: { absolute: "מערכת ניהול הייטקורס" },
  robots: { index: false, follow: false },
  icons: { icon: "/ai-course/icon.png" },
};
export const dynamic = "force-dynamic";

/*
  /hightecourse - מערכת ניהול הייטקורס: its own chrome in the Hightecourse
  language (logo, yellow rule, navy footer), outside the Open Code shell. The
  navigation shows for admins; every screen gates on its own.
*/
export default async function HcLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile().catch(() => null);
  const isAdmin = profile?.role === "admin";
  const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  return (
    <div dir="rtl" className={`${rubik.className} flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <header className="w-full bg-white" style={{ borderBottom: `3px solid ${H.yellow}` }}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-2">
          <Link href={PATHS.home} className="flex shrink-0 items-center gap-3" aria-label="מערכת ניהול הייטקורס">
            <Image src={LOGO.src} alt={LOGO.alt} width={LOGO.width} height={LOGO.height} priority style={{ height: "auto", width: "min(190px, 50vw)" }} />
            <span className="text-[15px] font-black" style={{ color: H.navy }}>
              מערכת ניהול
            </span>
          </Link>
          {isAdmin && <UserMenu name={profile?.first_name || profile?.full_name || "מנהלת"} />}
        </div>
        {isAdmin && <Nav />}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="w-full" style={{ background: H.navy }}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-[13.5px]" style={{ color: H.white }}>
          <span className="font-bold" style={{ color: H.yellow }}>
            {TAGLINE}
          </span>
          <span aria-hidden style={{ color: H.yellow }}>
            |
          </span>
          <a href={contactMailto} className="hover:underline" dir="ltr" style={{ color: H.white }}>
            {CONTACT_EMAIL}
          </a>
          <span aria-hidden style={{ color: H.yellow }}>
            |
          </span>
          <span dir="ltr" className="text-[12px] opacity-70" data-testid="hc-build">
            {build}
          </span>
        </div>
      </footer>
    </div>
  );
}
