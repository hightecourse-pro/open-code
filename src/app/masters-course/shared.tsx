import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { C, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, SHUFRA_EMAIL, courseMailto } from "./theme";

export { C };

// The ad's rounded, friendly Hebrew face (the owner, 25/9: "בצבעים ובנראות
// של המודעה"). Loaded for the course pages only.
// Self-hosted (5/10): Vercel builds started failing on the Google Fonts fetch
// ("next/font/google queries have exactly one entry") - the variable TTF in
// the repo removes that network dependency from every build.
export const rubik = localFont({ src: "./fonts/Rubik-Variable.ttf", weight: "300 900", display: "swap" });

/**
 * Partner logos. The owner sent שופרא and הייטקורס as pictures in the chat;
 * once the files sit in public/masters-course/ (shufra.png, hightcourse.png)
 * they are shown big, like in the ad. Until then: text wordmarks in the same
 * size, so nothing on the page waits for them.
 */
function hasPublicFile(rel: string): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", rel));
  } catch {
    return false;
  }
}

function Wordmark({ name, tagline, color }: { name: string; tagline: string; color: string }) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="font-black text-[30px] sm:text-[40px]" style={{ color }}>
        {name}
      </span>
      <span className="text-[11.5px] sm:text-[13px]" style={{ color: C.muted }}>
        {tagline}
      </span>
    </div>
  );
}

function PartnerLogo({ file, alt, fallback, className }: { file: string; alt: string; fallback: React.ReactNode; className: string }) {
  if (!hasPublicFile(file)) return <>{fallback}</>;
  // Never wider than a third of the bar on a phone - the height gives way.
  return (
    <div className="max-w-[32%] sm:max-w-none shrink min-w-0">
      <Image src={`/${file}`} alt={alt} width={400} height={160} className={`${className} w-auto max-w-full`} style={{ height: "auto" }} priority />
    </div>
  );
}

export function PartnersHeader() {
  return (
    <header className="flex items-center justify-between gap-4 sm:gap-10 px-1 sm:px-4 py-2">
      <PartnerLogo
        file="masters-course/shufra.png"
        alt="שופרא - מרחב מקצועי מתקדם, מבית סמינר הרב וולף"
        className="max-h-[50px] sm:max-h-[80px]"
        fallback={<Wordmark name="שופרא" tagline="מרחב מקצועי מתקדם · מבית סמינר הרב וולף" color={C.orange} />}
      />
      <Link href="/masters-course" className="max-w-[32%] sm:max-w-none shrink min-w-0">
        <Image
          src="/masters-course/opencode.png"
          alt="קוד פתוח - השמה. הכשרה. תרבות."
          width={400}
          height={200}
          className="max-h-[50px] sm:max-h-[80px] w-auto max-w-full"
          style={{ height: "auto" }}
          priority
        />
      </Link>
      <PartnerLogo
        file="masters-course/hightcourse.png"
        alt="הייטקורס - לחשוב בגדול"
        className="max-h-[46px] sm:max-h-[76px]"
        fallback={<Wordmark name="הייטקורס" tagline="לחשוב בגדול" color={C.navy} />}
      />
    </header>
  );
}

export function CourseFooter() {
  return (
    <footer className="text-center pb-6">
      <p className="font-black text-[18px]" style={{ color: C.navy }}>
        • תוכנית גמישה ומותאמת למצב השוק •
      </p>
      <p className="text-[15px] mt-1">הקורס נולד מתוך מחקר שוק על מגמות השינויים הדרמטיים בהייטק.</p>
      <p className="text-[14px] mt-4 leading-relaxed" style={{ color: C.muted }}>
        שאלות על ההרשמה? לשופרא בטלפון{" "}
        <a href={CONTACT_PHONE_HREF} dir="ltr" className="font-bold underline" style={{ color: C.navy }}>
          {CONTACT_PHONE}
        </a>{" "}
        או במייל{" "}
        <a href={courseMailto(SHUFRA_EMAIL)} className="font-bold underline" style={{ color: C.navy }}>
          {SHUFRA_EMAIL}
        </a>
        , או לקוד פתוח במייל{" "}
        <a href={courseMailto(CONTACT_EMAIL)} className="font-bold underline" style={{ color: C.navy }}>
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}
