import Image from "next/image";
import Link from "next/link";
import { H, LOGO, TAGLINE } from "@/app/ai-course/theme";
import { CONTACT_EMAIL, PATHS } from "@/lib/conference-shared";

/*
  The conference pages' frame (registration, payment, thank-you): the
  Hightecourse logo on white with the yellow rule, and the navy footer bar -
  the same look as the syllabus and the quiz, outside the community's shell.
*/
export { H, LOGO };

export function ConferenceHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="w-full bg-white" style={{ borderBottom: `3px solid ${H.yellow}` }}>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <Link href={PATHS.landing} className="shrink-0" aria-label="הייטקורס 2026 - לדף הכנס">
          <Image src={LOGO.src} alt={LOGO.alt} width={LOGO.width} height={LOGO.height} priority style={{ height: "auto", width: "min(200px, 50vw)" }} />
        </Link>
        {right}
      </div>
    </header>
  );
}

export function ConferenceFooter() {
  return (
    <footer className="w-full" style={{ background: H.navy }}>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-[13.5px]" style={{ color: H.white }}>
        <span className="font-bold" style={{ color: H.yellow }}>
          {TAGLINE}
        </span>
        <span aria-hidden style={{ color: H.yellow }}>
          |
        </span>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline" dir="ltr" style={{ color: H.white }}>
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}
