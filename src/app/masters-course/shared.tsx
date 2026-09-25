import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { Rubik } from "next/font/google";
import { C, WA_URL } from "./theme";

export { C, WA_URL };

// The ad's rounded, friendly Hebrew face (the owner, 25/9: "בצבעים ובנראות
// של המודעה"). Loaded for the course pages only.
export const rubik = Rubik({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "900"], display: "swap" });

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
    <header className="flex items-center justify-between gap-3 sm:gap-8">
      <PartnerLogo
        file="masters-course/shufra.png"
        alt="שופרא - מרחב מקצועי מתקדם, מבית סמינר הרב וולף"
        className="max-h-[60px] sm:max-h-[100px]"
        fallback={<Wordmark name="שופרא" tagline="מרחב מקצועי מתקדם · מבית סמינר הרב וולף" color={C.orange} />}
      />
      <Link href="/masters-course" className="max-w-[32%] sm:max-w-none shrink min-w-0">
        <Image
          src="/masters-course/opencode.png"
          alt="קוד פתוח - השמה. הכשרה. תרבות."
          width={400}
          height={200}
          className="max-h-[60px] sm:max-h-[100px] w-auto max-w-full"
          style={{ height: "auto" }}
          priority
        />
      </Link>
      <PartnerLogo
        file="masters-course/hightcourse.png"
        alt="הייטקורס - לחשוב בגדול"
        className="max-h-[56px] sm:max-h-[96px]"
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
      <p className="text-[13.5px] mt-3" style={{ color: C.muted }}>
        שאלות? בוואטסאפ{" "}
        <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: C.navy }}>
          02-580-0296
        </a>{" "}
        או במייל{" "}
        <a href="mailto:office@opencode.org.il" className="font-bold underline" style={{ color: C.navy }}>
          office@opencode.org.il
        </a>
      </p>
    </footer>
  );
}
