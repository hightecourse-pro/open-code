"use client";
// The explorer of the projects portal: free-text search (names, technologies, the blurb, the quotes,
// the challenge), a challenge filter, technology chips - all in the URL (?ch=&q=&t=) so a filtered
// view can be sent as a link, and the challenge cards above can point into it.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { CHALLENGE_INFO, CHALLENGE_ORDER, byAward, filterProjects, isChallengeKey, normalize, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { Reveal } from "./reveal";
import { ProjectCard, TechChip } from "./showcase-ui";

export function Explorer({ projects, topTech }: { projects: ShowcaseProject[]; topTech: { name: string; count: number }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const chParam = sp.get("ch");
  const ch: ChallengeKey | "" = isChallengeKey(chParam) ? chParam : "";
  const techSel = (sp.get("t") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  // ?f=finals - only the winners and the finalists of 28.10
  const finals = sp.get("f") === "finals";
  const urlQ = sp.get("q") ?? "";
  // The typed text wins while it was typed against the current URL; a URL change from outside (a chip
  // on a project's page, the browser's back) wins otherwise - derived in render, no effect.
  const [typed, setTyped] = useState({ base: urlQ, value: urlQ });
  const q = typed.base === urlQ ? typed.value : urlQ;
  const timer = useRef<number | null>(null);

  const setParams = (patch: Record<string, string | null>) => {
    // a keystroke still waiting for its debounce rides along, so it can never land later and undo this change
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
    // cancel a pending debounce - otherwise the last keystroke could re-apply ?q= right after the reset
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setTyped({ base: "", value: "" });
    router.replace(pathname, { scroll: false });
  };

  // winners first, then finalists, then the rest
  const list = byAward(filterProjects(projects, { challenge: ch, q, tech: techSel, finals }));
  const countOf = (k: ChallengeKey | "") => filterProjects(projects, { challenge: k, q, tech: techSel, finals }).length;
  const finalsCount = filterProjects(projects, { challenge: ch, q, tech: techSel, finals: true }).length;
  const active = !!(ch || q || techSel.length || finals);

  return (
    <section id="projects" className="scroll-mt-14" data-testid="sc-explorer">
      {/* the filter bar - sticks under the top bar */}
      <div className="sticky top-14 z-30 bg-[#FBF7FF]/95 backdrop-blur border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="relative flex-1 min-w-[240px]">
              <input
                type="search"
                value={q}
                onChange={(e) => onType(e.target.value)}
                placeholder="חיפוש חופשי: שם, טכנולוגיה, מילה מהתיאור…"
                className="w-full h-11 ps-5 pe-4 rounded-full bg-white border-2 border-ink-900/10 focus:border-brand-pink focus:outline-none text-[15.5px] text-ink-900 placeholder:text-ink-400 shadow-[3px_4px_0_0_#F3C6DD] focus:shadow-[3px_4px_0_0_#E0418D] transition-shadow"
                aria-label="חיפוש בפרויקטים"
                data-testid="sc-search"
              />
            </label>
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="סינון לפי אתגר">
              <ChallengePill k="" on={ch === ""} count={countOf("")} onClick={() => setParams({ ch: null })} />
              {CHALLENGE_ORDER.map((k) => (
                <ChallengePill key={k} k={k} on={ch === k} count={countOf(k)} onClick={() => setParams({ ch: ch === k ? null : k })} />
              ))}
              <span className="w-px h-5 bg-ink-200 mx-1" aria-hidden />
              <Pill label="עלו לגמר" on={finals} count={finalsCount} onClick={() => setParams({ f: finals ? null : "finals" })} testid="sc-finals-pill" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-bold text-ink-500 me-1">טכנולוגיות:</span>
            {topTech.map((t) => (
              <button key={t.name} type="button" onClick={() => toggleTech(t.name)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50">
                <TechChip name={t.name} on={techSel.some((x) => normalize(x) === normalize(t.name))} count={t.count} small />
              </button>
            ))}
            {techSel
              .filter((t) => !topTech.some((x) => normalize(x.name) === normalize(t)))
              .map((t) => (
                <button key={t} type="button" onClick={() => toggleTech(t)} className="rounded-full">
                  <TechChip name={t} on small />
                </button>
              ))}
          </div>
          <div className="flex items-center gap-3 text-[14px] text-ink-700">
            <span data-testid="sc-count">
              <b className="font-display font-black text-[17px] text-ink-900">{list.length}</b> {list.length === 1 ? "פרויקט" : "פרויקטים"}
              {ch && <span className="text-ink-500"> · {CHALLENGE_INFO[ch].short}</span>}
              {finals && <span className="text-ink-500"> · הגמר</span>}
              {q && <span className="text-ink-500"> · ״{q}״</span>}
              {techSel.length > 0 && <span className="text-ink-500"> · {techSel.join(" + ")}</span>}
            </span>
            {active && (
              <button type="button" onClick={clearAll} className="text-[13.5px] font-bold text-brand-pink-deep underline underline-offset-2" data-testid="sc-clear">
                ניקוי הסינון
              </button>
            )}
          </div>
        </div>
      </div>

      {/* the grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {list.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7" data-testid="sc-grid">
            {list.map((p, i) => (
              <Reveal key={p.k8} delay={Math.min(i, 8) * 70} className="h-full">
                <ProjectCard p={p} i={i} eager={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center py-16 sc-pop" data-testid="sc-empty">
            <p className="font-display font-black text-[22px] text-ink-900">לא מצאנו פרויקט שמתאים לחיפוש הזה</p>
            <p className="t-body text-ink-700 mt-1">נסו שם אחר, טכנולוגיה, או מילה מהתיאור - או הסירו את הסינון.</p>
            <button type="button" onClick={clearAll} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-white font-bold px-5 py-2 shadow-md">
              להצגת כל הפרויקטים
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ChallengePill({ k, on, count, onClick }: { k: ChallengeKey | ""; on: boolean; count: number; onClick: () => void }) {
  return <Pill label={k ? CHALLENGE_INFO[k].short : "הכל"} on={on} count={count} onClick={onClick} testid="sc-pill" ch={k} />;
}

function Pill({ label, on, count, onClick, testid, ch }: { label: string; on: boolean; count: number; onClick: () => void; testid: string; ch?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sc-chip inline-flex items-center gap-1.5 rounded-full border-[1.5px] text-[13.5px] font-bold px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50 ${
        on ? "bg-brand-gradient text-white border-transparent shadow-sm" : "bg-white text-ink-900 border-ink-900/10 hover:border-brand-pink/60"
      }`}
      data-on={on ? "1" : "0"}
      data-testid={testid}
      data-ch={ch}
      aria-pressed={on}
    >
      {label}
      <span className={`font-mono text-[11.5px] ${on ? "text-white/85" : "text-ink-500"}`}>{count}</span>
    </button>
  );
}
