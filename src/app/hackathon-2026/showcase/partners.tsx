"use client";
// The three partners on top of the page (the product manager's notes through the owner, 8/11: ״למעלה הייתי
// שמה את 3 החברות ומתחת את המספרים … רשימת החברות מלמטה צריך להיות למעלה לפני הזוכות, עם משפט הסבר אחד
// קצר על האתגר״): the cards that used to sit under the grid, now above the figures in the dashboard, each
// with the challenge's technology and one sentence about it. A click filters the grid below (?ch=, the
// same URL state as the explorer) and opens the details under the row; a second click closes and clears.
// The static fallback (before the URL is readable) draws the same cards as plain links into the filtered grid.
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHALLENGE_INFO, CHALLENGE_ORDER, SHOWCASE2_PATH as BASE, isChallengeKey, projectsOf, type ChallengeKey } from "@/lib/hackathon-showcase";
import { COLOR, CompanyDetails, PARTNER_LOGOS, SHEBA_LOGO } from "./ui";

export function Partners() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const chParam = sp.get("ch");
  const ch: ChallengeKey | "" = isChallengeKey(chParam) ? chParam : "";
  const pick = (k: ChallengeKey) => {
    const n = new URLSearchParams(sp.toString());
    if (ch === k) n.delete("ch");
    else n.set("ch", k);
    const qs = n.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return <PartnerCards ch={ch} onPick={pick} />;
}

/** The row of three cards and, under it, the open partner's details. With `onPick` the cards are buttons; without it, links. */
export function PartnerCards({ ch = "", onPick }: { ch?: ChallengeKey | ""; onPick?: (k: ChallengeKey) => void }) {
  return (
    <div id="challenges" className="flex flex-col gap-4 scroll-mt-20" data-testid="sh-partners">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="שלושת האתגרים">
        {CHALLENGE_ORDER.map((k) => (
          <CompanyCard key={k} k={k} on={ch === k} count={projectsOf(k).length} onClick={onPick ? () => onPick(k) : undefined} />
        ))}
      </div>
      {ch && <CompanyDetails k={ch} className="bg-white border border-[#E3DDEE]" />}
    </div>
  );
}

/**
 * A partner's card, as the canvas draws the challenge cards: the marks, the small grey line, the big name,
 * the challenge's technology (the owner, 4/11), one sentence about the challenge (8/11), the count and the
 * arrow - a button that filters the grid and opens the details under the row, or a link when there is no
 * browser state yet.
 */
function CompanyCard({ k, on, count, onClick }: { k: ChallengeKey; on: boolean; count: number; onClick?: () => void }) {
  const c = CHALLENGE_INFO[k];
  const cls = `text-start flex flex-col gap-2.5 p-6 rounded-[14px] bg-white border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] ${on ? "border-[#1B1530] shadow-[0_0_0_1.5px_#1B1530]" : "border-[#E3DDEE] hover:border-[#1B1530]"}`;
  const style = { borderTop: `4px solid ${COLOR[k]}` };
  const body = (
    <>
      <span className="flex items-center gap-3 h-10">
        {PARTNER_LOGOS[k].map((l) => (
          <Image key={l.src} src={l.src} alt={l.alt} width={l.width} height={l.height} className="h-10 w-auto max-w-[120px] object-contain" data-testid={l.src === SHEBA_LOGO.src ? "sh-company-sheba" : undefined} />
        ))}
      </span>
      <span className="text-[13px] font-bold text-[#6B6580]">{c.org}</span>
      <span className="text-[26px] font-black leading-[1.2] text-[#1B1530] -mt-1">{c.short}</span>
      <span className="text-[16px] font-bold text-[#1B1530]" dir="ltr" data-testid="sh-company-tech">
        {c.techLabel}
      </span>
      <span className="text-[15px] leading-relaxed text-[#4E4862]" data-testid="sh-company-line">
        {c.sentence}
      </span>
      <span className="flex items-center justify-between gap-3 pt-3 mt-auto border-t border-[#F0EDF5]">
        <span className="text-[14px] text-[#6B6580]">{count} פרויקטים</span>
        <span className="text-[15px] font-bold text-[#4A4EA3]">{on ? "לסגירה ↑" : "לפרטים ←"}</span>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={on} aria-expanded={on} className={cls} style={style} data-testid="sh-company" data-ch={k} data-on={on ? "1" : "0"}>
      {body}
    </button>
  ) : (
    <Link href={`${BASE}?ch=${k}#projects`} className={cls} style={style} data-testid="sh-company" data-ch={k} data-on="0">
      {body}
    </Link>
  );
}
