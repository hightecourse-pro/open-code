"use client";
// The second portal's explorer: the three partners as tiles (logo, name, the challenge's technology,
// the count) - a click filters the grid to that partner AND opens its details under the row (the
// owner, 4/11: ״לחיצה על חברות צריכה לסנן… רק בלחיצה נפתח פרטים״); then the winners' strip (passed
// in), then the sticky search bar and the grid. Same URL state as the first portal (?ch=&q=&t=&f=),
// so links between the two designs mean the same thing.
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { CHALLENGE_INFO, CHALLENGE_ORDER, byAward, filterProjects, isChallengeKey, normalize, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { COLOR, CompanyDetails, Eyebrow, ProjectCard, WRAP } from "./ui";

export function Explorer({ projects, topTech, winners }: { projects: ShowcaseProject[]; topTech: { name: string; count: number }[]; winners: ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const chParam = sp.get("ch");
  const ch: ChallengeKey | "" = isChallengeKey(chParam) ? chParam : "";
  const techSel = (sp.get("t") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const finals = sp.get("f") === "finals";
  const urlQ = sp.get("q") ?? "";
  // the typed text wins while it was typed against the current URL; a URL change from outside wins otherwise
  const [typed, setTyped] = useState({ base: urlQ, value: urlQ });
  const q = typed.base === urlQ ? typed.value : urlQ;
  const timer = useRef<number | null>(null);

  const setParams = (patch: Record<string, string | null>) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
      patch = { q: typed.value || null, ...patch };
    }
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    const qs = n.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const onType = (v: string) => {
    setTyped({ base: urlQ, value: v });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setParams({ q: v || null }), 220);
  };
  const toggleTech = (name: string) => {
    const key = normalize(name);
    const next = techSel.some((t) => normalize(t) === key) ? techSel.filter((t) => normalize(t) !== key) : [...techSel, name];
    setParams({ t: next.join(",") || null });
  };
  const clearAll = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setTyped({ base: "", value: "" });
    router.replace(pathname, { scroll: false });
  };
  const pickCompany = (k: ChallengeKey) => setParams({ ch: ch === k ? null : k });

  const list = byAward(filterProjects(projects, { challenge: ch, q, tech: techSel, finals }));
  const countOf = (k: ChallengeKey | "") => filterProjects(projects, { challenge: k, q, tech: techSel, finals }).length;
  const finalsCount = filterProjects(projects, { challenge: ch, q, tech: techSel, finals: true }).length;
  const active = !!(ch || q || techSel.length || finals);

  return (
    <>
      {/* the partners */}
      <section id="challenges" className={`${WRAP} pt-16 flex flex-col gap-6 scroll-mt-16`} data-testid="sh-companies">
        <div className="flex flex-col gap-2">
          <Eyebrow>האתגרים</Eyebrow>
          <h2 className="text-[32px] sm:text-[38px] font-extrabold leading-tight text-[#1B1530]">שלושה אתגרים. שלוש בעיות אמיתיות מהשטח.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" role="group" aria-label="סינון לפי חברה">
          {CHALLENGE_ORDER.map((k) => (
            <CompanyTile key={k} k={k} on={ch === k} count={projects.filter((p) => p.challenge === k).length} onClick={() => pickCompany(k)} />
          ))}
        </div>
        {ch && <CompanyDetails k={ch} />}
      </section>

      {winners}

      {/* the projects */}
      <section id="projects" className="scroll-mt-16 pt-12" data-testid="sh-explorer">
        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur border-y border-[#ECE8F2]">
          <div className={`${WRAP} py-3 flex flex-col gap-2.5`}>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="relative flex-1 min-w-[220px]">
                <input
                  type="search"
                  value={q}
                  onChange={(e) => onType(e.target.value)}
                  placeholder="חיפוש: שם, טכנולוגיה, מילה מהתיאור"
                  className="w-full h-11 px-4 rounded-lg bg-white border border-[#D9D3E6] focus:border-[#1B1530] focus:outline-none text-[15px] text-[#1B1530] placeholder:text-[#6B6580]"
                  aria-label="חיפוש בפרויקטים"
                  data-testid="sh-search"
                />
              </label>
              <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="סינון לפי אתגר">
                <Pill label="הכל" on={ch === "" && !finals} count={countOf("")} onClick={() => setParams({ ch: null, f: null })} testid="sh-pill" ch="" />
                {CHALLENGE_ORDER.map((k) => (
                  <Pill key={k} label={CHALLENGE_INFO[k].short} on={ch === k} count={countOf(k)} onClick={() => pickCompany(k)} testid="sh-pill" ch={k} />
                ))}
                <span className="w-px h-5 bg-[#D9D3E6] mx-1" aria-hidden />
                <Pill label="עלו לגמר" on={finals} count={finalsCount} onClick={() => setParams({ f: finals ? null : "finals" })} testid="sh-finals-pill" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topTech.map((t) => (
                <TechButton key={t.name} name={t.name} count={t.count} on={techSel.some((x) => normalize(x) === normalize(t.name))} onClick={() => toggleTech(t.name)} />
              ))}
              {techSel
                .filter((t) => !topTech.some((x) => normalize(x.name) === normalize(t)))
                .map((t) => (
                  <TechButton key={t} name={t} on onClick={() => toggleTech(t)} />
                ))}
            </div>
            <div className="flex items-center gap-3 text-[14px] text-[#4E4862]">
              <span data-testid="sh-count">
                <b className="text-[16px] font-black text-[#1B1530]">{list.length}</b> {list.length === 1 ? "פרויקט" : "פרויקטים"}
                {ch && <span className="text-[#6B6580]"> · {CHALLENGE_INFO[ch].short}</span>}
                {finals && <span className="text-[#6B6580]"> · הגמר</span>}
                {q && <span className="text-[#6B6580]"> · ״{q}״</span>}
                {techSel.length > 0 && <span className="text-[#6B6580]"> · {techSel.join(" + ")}</span>}
              </span>
              {active && (
                <button type="button" onClick={clearAll} className="text-[13.5px] font-bold text-[#B0154B] underline underline-offset-2" data-testid="sh-clear">
                  ניקוי הסינון
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`${WRAP} py-8`}>
          {list.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="sh-grid">
              {list.map((p, i) => (
                <ProjectCard key={p.k8} p={p} eager={i < 4} />
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-16" data-testid="sh-empty">
              <p className="text-[21px] font-black text-[#1B1530]">אין פרויקט שמתאים לחיפוש הזה</p>
              <button type="button" onClick={clearAll} className="mt-4 inline-flex items-center min-h-11 px-5 rounded-lg bg-[#1B1530] text-white font-bold">
                להצגת כל הפרויקטים
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** A partner's tile: the logo, the name, the challenge's technology, the count - a button that filters and opens the details. */
function CompanyTile({ k, on, count, onClick }: { k: ChallengeKey; on: boolean; count: number; onClick: () => void }) {
  const c = CHALLENGE_INFO[k];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-expanded={on}
      className={`text-start flex flex-col gap-3 p-6 rounded-[14px] bg-white border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] ${
        on ? "border-[#1B1530] shadow-[0_0_0_1.5px_#1B1530]" : "border-[#ECE8F2] hover:border-[#1B1530]"
      }`}
      style={{ borderTop: `4px solid ${COLOR[k]}` }}
      data-testid="sh-company"
      data-ch={k}
      data-on={on ? "1" : "0"}
    >
      <span className="h-10 flex items-center">
        <Image src={c.logos[0]} alt="" width={220} height={151} className="h-10 w-auto max-w-[140px] object-contain" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[24px] font-black leading-tight text-[#1B1530]">{c.short}</span>
        <span className="text-[13.5px] text-[#6B6580]">{c.org}</span>
      </span>
      <span className="inline-flex w-fit items-center rounded-full bg-[#EEEFFA] text-[#3B3F8F] text-[13.5px] font-bold px-3 py-1" dir="ltr" data-testid="sh-company-tech">
        {c.techLabel}
      </span>
      <span className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0EDF5] text-[14px]">
        <span className="font-bold text-[#6B6580]">{count} פרויקטים</span>
        <span className={`font-bold text-[#4A4EA3] transition-transform ${on ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </span>
    </button>
  );
}

function Pill({ label, on, count, onClick, testid, ch }: { label: string; on: boolean; count: number; onClick: () => void; testid: string; ch?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-9 rounded-full border text-[13.5px] font-semibold px-3 outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] transition-colors ${
        on ? "bg-[#1B1530] text-white border-[#1B1530]" : "bg-white text-[#1B1530] border-[#D9D3E6] hover:border-[#1B1530]"
      }`}
      data-on={on ? "1" : "0"}
      data-testid={testid}
      data-ch={ch}
      aria-pressed={on}
    >
      {label}
      <span className={`text-[11.5px] ${on ? "text-white/80" : "text-[#6B6580]"}`}>{count}</span>
    </button>
  );
}

function TechButton({ name, count, on, onClick }: { name: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md text-[12.5px] px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] transition-colors ${
        on ? "bg-[#1B1530] text-white" : "bg-[#F4F2F8] text-[#4E4862] hover:bg-[#E3DDEE]"
      }`}
      data-on={on ? "1" : "0"}
      data-testid="sh-tech-btn"
      aria-pressed={on}
    >
      <span dir="ltr">{name}</span>
      {typeof count === "number" && <span className={`text-[11px] ${on ? "text-white/80" : "text-[#6B6580]"}`}>{count}</span>}
    </button>
  );
}
