import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL, H, LOGO, TAGLINE, contactMailto } from "./theme";

/*
  The page chrome shared by the quiz and its admin: the logo header (no
  partner mark - the owner, 20/10: "תוריד לגמרי את בשיתוף ג'ון ברייס") and the
  syllabus' navy footer bar (yellow tagline, white contact). Every link gets its colour explicitly -
  the community's global stylesheet paints anchors purple otherwise.
*/

export function Brand({ wide, right }: { wide?: boolean; right?: React.ReactNode }) {
  return (
    <header className="w-full bg-white" style={{ borderBottom: `3px solid ${H.yellow}` }}>
      <div className={`mx-auto flex ${wide ? "max-w-5xl" : "max-w-3xl"} flex-wrap items-center ${right ? "justify-between" : "justify-center"} gap-3 px-4 py-3.5`}>
        <Link href="/ai-course" className="shrink-0" aria-label="הייטקורס - לשאלון">
          <Image src={LOGO.src} alt={LOGO.alt} width={LOGO.width} height={LOGO.height} priority style={{ height: "auto", width: "min(210px, 55vw)" }} />
        </Link>
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
        <a href={contactMailto} className="hover:underline" dir="ltr" style={{ color: H.white }} data-testid="footer-mail">
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}
