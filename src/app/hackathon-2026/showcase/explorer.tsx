"use client";
// The second portal's explorer (the owner, 5/11: ״בקוביות קטנות יותר את שאר הפרויקטים עם סינון נח״): the
// heading, a filter line that sticks under the top bar while the grid scrolls (the partner pills, ״עלו
// לגמר״, the search), a row of technology chips, and the grid of small tiles - without the three winners,
// who have their own cards above, until a filter is on (then everything that matches). The grid runs in
// the challenges' order, each challenge opening with its finalists (the product manager, 8/11: ״העולות
// לגמר למעלה בלי סדר״). The partners' cards moved to the top of the page (partners.tsx) and share this
// URL state (?ch=&q=&t=&f=), as do the links between the two designs.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { CHALLENGE_INFO, CHALLENGE_ORDER, byChallenge, filterProjects, isChallengeKey, normalize, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { PILL, PILL_OFF, PILL_ON, ProjectCard, SectionHead, WRAP } from "./ui";

export function Explorer({ projects, topTech }: { projects: ShowcaseProject[]; topTech: { name: string; count: number }[] }) {
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

  const active = !!(ch || q || techSel.length || finals);
  const winners = new Set(projects.filter((p) => p.award === "winner").map((p) => p.k8));
  const matches = byChallenge(filterProjects(projects, { challenge: ch, q, tech: techSel, finals }));
  // the three winners have their own cards above - the plain grid is ״שאר הפרויקטים״; a filter shows everything that matches
  const list = active ? matches : matches.filter((p) => !winners.has(p.k8));
  const countOf = (k: ChallengeKey | "") => filterProjects(projects, { challenge: k, q, tech: techSel, finals }).length;
  const finalsCount = filterProjects(projects, { challenge: ch, q, tech: techSel, finals: true }).length;
  const filtersLine = [ch && CHALLENGE_INFO[ch].short, finals && "עלו לגמר", q && `״${q}״`, ...techSel].filter(Boolean).join(" · ");
  const countLabel = active ? (list.length === 1 ? "פרויקט אחד" : `${list.length} פרויקטים`) : `עוד ${list.length} פרויקטים`;

  return (
    <>
      {/* the projects */}
      <section id="projects" className="scroll-mt-16" data-testid="sh-explorer">
        <div className={`${WRAP} pt-14 pb-5`}>
          <SectionHead eyebrow="כל הפרויקטים" title={<span data-testid="sh-count">{countLabel}</span>}>
            {active ? (
              <p className="text-[15px] text-[#4E4862] flex items-center gap-3 flex-wrap">
                <span>{filtersLine}</span>
                <button type="button" onClick={clearAll} className="font-bold text-[#B0154B] underline underline-offset-2" data-testid="sh-clear">
                  ניקוי הסינון
                </button>
              </p>
            ) : (
              <p className="text-[18px] leading-relaxed text-[#4E4862]">לכל פרויקט עמוד משלו: סרטון הדגמה, קישור למוצר ומשפט אישי ממי שבנתה אותה. אפשר לסנן לפי אתגר או לפי טכנולוגיה, או לחפש.</p>
            )}
          </SectionHead>
        </div>

        {/* the filter line - stuck under the top bar while the grid scrolls (the owner, 5/11: ״סינון נח״) */}
        <div className="md:sticky md:top-16 z-30 bg-white/95 backdrop-blur border-y border-[#ECE8F2]" data-testid="sh-filters">
          <div className={`${WRAP} py-3 flex flex-wrap items-center gap-2`}>
            <div role="group" aria-label="סינון לפי אתגר" className="flex flex-wrap gap-2">
              <Pill label="הכל" on={ch === "" && !finals} count={countOf("")} onClick={() => setParams({ ch: null, f: null })} testid="sh-pill" ch="" />
              {CHALLENGE_ORDER.map((k) => (
                <Pill key={k} label={CHALLENGE_INFO[k].short} on={ch === k} count={countOf(k)} onClick={() => pickCompany(k)} testid="sh-pill" ch={k} />
              ))}
              <Pill label="עלו לגמר" on={finals} count={finalsCount} onClick={() => setParams({ f: finals ? null : "finals" })} testid="sh-finals-pill" />
            </div>
            <label className="relative w-full sm:w-[280px] sm:ms-auto">
              <input
                type="search"
                value={q}
                onChange={(e) => onType(e.target.value)}
                placeholder="חיפוש: שם, טכנולוגיה, מילה מהתיאור"
                className="w-full h-11 px-4 rounded-full bg-white border border-[#D9D3E6] focus:border-[#1B1530] focus:outline-none text-[15px] text-[#1B1530] placeholder:text-[#6B6580]"
                aria-label="חיפוש בפרויקטים"
                data-testid="sh-search"
              />
            </label>
          </div>
        </div>

        <div className={`${WRAP} pt-5 pb-20 flex flex-col gap-6`}>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="סינון לפי טכנולוגיה">
            {topTech.map((t) => (
              <TechButton key={t.name} name={t.name} count={t.count} on={techSel.some((x) => normalize(x) === normalize(t.name))} onClick={() => toggleTech(t.name)} />
            ))}
            {techSel
              .filter((t) => !topTech.some((x) => normalize(x.name) === normalize(t)))
              .map((t) => (
                <TechButton key={t} name={t} on onClick={() => toggleTech(t)} />
              ))}
          </div>

          {list.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="sh-grid">
              {list.map((p, i) => (
                <ProjectCard key={p.k8} p={p} eager={i < 4} />
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-16" data-testid="sh-empty">
              <p className="text-[21px] font-black text-[#1B1530]">אין פרויקט שמתאים לחיפוש הזה</p>
              <button type="button" onClick={clearAll} className={`${PILL} ${PILL_ON} mt-5`}>
                להצגת כל הפרויקטים
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Pill({ label, on, count, onClick, testid, ch }: { label: string; on: boolean; count: number; onClick: () => void; testid: string; ch?: string }) {
  return (
    <button type="button" onClick={onClick} className={`${PILL} ${on ? PILL_ON : PILL_OFF}`} data-on={on ? "1" : "0"} data-testid={testid} data-ch={ch} aria-pressed={on}>
      {label}
      <span className={`text-[12px] ${on ? "text-white/80" : "text-[#6B6580]"}`}>{count}</span>
    </button>
  );
}

function TechButton({ name, count, on, onClick }: { name: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md text-[12.5px] px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] transition-colors ${on ? "bg-[#1B1530] text-white" : "bg-[#F4F2F8] text-[#4E4862] hover:bg-[#E3DDEE]"}`}
      data-on={on ? "1" : "0"}
      data-testid="sh-tech-btn"
      aria-pressed={on}
    >
      <span dir="ltr">{name}</span>
      {typeof count === "number" && <span className={`text-[11px] ${on ? "text-white/80" : "text-[#6B6580]"}`}>{count}</span>}
    </button>
  );
}
