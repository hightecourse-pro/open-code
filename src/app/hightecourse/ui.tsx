import { H } from "../ai-course/theme";

/*
  The small building blocks of the Hightecourse management screens - plain
  components, no hooks, so server and client screens share them.
*/

export function Card({ children, className = "", testId }: { children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`bg-white ${className}`} style={{ border: `1px solid ${H.line}`, borderRadius: 14 }} data-testid={testId}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-2">
      <h2 className="text-[17px] font-black" style={{ color: H.navy }}>
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Stat({ label, value, highlight, sub, testId }: { label: string; value: number | string; highlight?: boolean; sub?: string; testId?: string }) {
  return (
    <div className="px-4 py-3.5" style={{ border: `1px solid ${highlight ? H.yellow : H.line}`, borderRadius: 12, background: highlight ? H.yellowSoft : H.white }} data-testid={testId}>
      <div className="text-[26px] font-black leading-tight tabular-nums" style={{ color: H.navy }} data-testid={testId ? `${testId}-value` : undefined}>
        {value}
      </div>
      <div className="text-[13px] font-medium" style={{ color: H.ink }}>
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 text-[12px]" style={{ color: H.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** An external link in the system's own colour - the community's global stylesheet paints anchors purple otherwise. */
export function ExtLink({ href, children, testId }: { href: string; children: React.ReactNode; testId?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[13px] font-bold underline underline-offset-2" style={{ color: H.navy }} data-testid={testId}>
      {children}
    </a>
  );
}

export function Notice({ children, tone = "warn", testId }: { children: React.ReactNode; tone?: "warn" | "error"; testId?: string }) {
  const color = tone === "error" ? H.red : H.navyDeep;
  return (
    <div className="px-4 py-3 text-[14px] leading-relaxed" style={{ border: `1px solid ${tone === "error" ? H.red : H.yellow}`, background: tone === "error" ? "#FDF1EF" : H.yellowSoft, color, borderRadius: 12 }} data-testid={testId}>
      {children}
    </div>
  );
}

export const fmtTime = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
export const fmtDateTime = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
export const fmtNum = new Intl.NumberFormat("he-IL");
