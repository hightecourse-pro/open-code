import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, H, LOGO, PARTNER, TAGLINE, contactMailto } from "./theme";

/*
  The page chrome shared by the quiz and its admin: the syllabus' header
  (logo with "בשיתוף John Bryce" under it) and its navy footer bar
  (yellow tagline, white contact). Every link gets its colour explicitly -
  the community's global stylesheet paints anchors purple otherwise.
*/

export function Brand({ wide, right }: { wide?: boolean; right?: React.ReactNode }) {
  return (
    <header className="w-full bg-white" style={{ borderBottom: `3px solid ${H.yellow}` }}>
      <div className={`mx-auto flex ${wide ? "max-w-5xl" : "max-w-3xl"} flex-wrap items-center ${right ? "justify-between" : "justify-center"} gap-3 px-4 py-3.5`}>
        <div className="flex items-center gap-4">
          <Link href="/ai-course" className="shrink-0" aria-label="הייטקורס - לשאלון">
            <Image src={LOGO.src} alt={LOGO.alt} width={LOGO.width} height={LOGO.height} priority style={{ height: "auto", width: "min(190px, 48vw)" }} />
          </Link>
          <div className="flex flex-col items-center leading-none" style={{ color: H.navy }} dir="ltr" aria-label={`בשיתוף ${PARTNER}`}>
            <span className="text-[10px] font-medium" dir="rtl">
              בשיתוף
            </span>
            <span className="mt-1 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white" style={{ background: "#B3202E", borderRadius: 3 }}>
              {PARTNER}
            </span>
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

export function PageFooter({ wide }: { wide?: boolean }) {
  return (
    <footer className="w-full" style={{ background: H.navy }}>
      <div className={`mx-auto flex ${wide ? "max-w-5xl" : "max-w-3xl"} flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-[13.5px]`} style={{ color: H.white }}>
        <span className="font-bold" style={{ color: H.yellow }}>
          {TAGLINE}
        </span>
        <span aria-hidden style={{ color: H.yellow }}>
          |
        </span>
        <a href={CONTACT_PHONE_HREF} className="hover:underline" dir="ltr" style={{ color: H.white }} data-testid="footer-phone">
          {CONTACT_PHONE}
        </a>
        <span aria-hidden style={{ color: H.yellow }}>
          |
        </span>
        <a href={contactMailto} className="hover:underline" dir="ltr" style={{ color: H.white }} data-testid="footer-mail">
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}
