// ============================================================================
// מסך האולם (1920×1080) · the picture of the whole hall: a drone's view of the
// sea, אי השפיות in the middle, the 30 circles' islands around it, and every
// circle's ship sailing in as it progresses. Every few dozen seconds the scene
// changes: a zoom on one circle, head to head, the race, the numbers. When all
// circles arrived (or from the studio): the great gate scene. On the studio's
// word: the reveal. Ported from the hand-over kit's hall.js (22.11); the only
// difference is the data - one JSON feed (HallView) instead of sync.js.
// ============================================================================
import { COLORS, RESOURCE_OF, RULES, ZONE_IDS, buildContent, fill, isZoneId, type Content, type Gender, type ZoneId } from "@/lib/sanity/content";
import { makeBoard, tierIdFor, type Board, type Snapshot } from "@/lib/sanity/engine";
import { ASSETS, faceSVG, icon, logo, nameOf, prep, symbol, token } from "@/lib/sanity/art";
import { Kaleido, buildScore, logoFromNumbers, photoToLogo, playScore, type Player } from "@/lib/sanity/creations";
import { photoPath, type CreationMeta, type EventInfo, type HallView } from "@/lib/sanity/shared";

export type SceneId = "map" | "focus" | "compare" | "race" | "stats";
type Xf = { a: number; ax: number; ay: number; pt: (p: readonly [number, number] | number[]) => [number, number]; s: number; th: number; cx: number; cy: number };
type Scene = { id: SceneId; name: string; dur: number; render: () => void; prep?: () => boolean };

const hexPts = (x: number, y: number, r: number, rot = 30) => [...Array(6)].map((_, i) => { const a = (Math.PI / 180) * (60 * i + rot); return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(" ");
// 22.11: the yellow boat of the opening illustration
const boatG = (s = 1, flip = false) => `<g transform="scale(${flip ? -s : s} ${s})"><image href="${ASSETS}/scene/boat.png" x="-19" y="-34" width="40" height="52"/></g>`;
const MAP = { w: 1920, h: 830, cx: 960, cy: 415, rx: 790, ry: 318, irx: 250, iry: 140 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: string, c2: string, t: number) => { const p = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)); const A = p(c1), B = p(c2); return "#" + A.map((v, k) => Math.round(lerp(v, B[k], t)).toString(16).padStart(2, "0")).join(""); };
// morning → noon → sunset → night
const SKY = [
  { f: 0, s: ["#F6ECE4", "#D6E5F0", "#AFCADF"], tint: "#FFB27A", ta: 0.06 },
  { f: 0.3, s: ["#F1F5F8", "#D3E3EF", "#A7C4DB"], tint: "#FFFFFF", ta: 0 },
  { f: 0.65, s: ["#F6E8DC", "#C9DAEA", "#98B6D2"], tint: "#FF9A6B", ta: 0.06 },
  { f: 1, s: ["#C9D3E6", "#9DB2CF", "#7792B8"], tint: "#15233F", ta: 0.12 },
];
function skyAt(f: number) { let i = 0; while (i < SKY.length - 2 && f > SKY[i + 1].f) i++; const A = SKY[i], B = SKY[i + 1]; const t = Math.max(0, Math.min(1, (f - A.f) / (B.f - A.f))); return { s: A.s.map((c, k) => mix(c, B.s[k], t)), tint: mix(A.tint, B.tint, t), ta: lerp(A.ta, B.ta, t) }; }
const FACE_KINDS = ["cave", "lake", "forest", "observatory", "reef", "safari", "start", "goal", "lighthouse", "fog", "market"] as const;
const DAY_NAMES = ["זריחה", "בוקר", "אחר הצהריים", "שקיעה", "לילה"];

export class HallApp {
  private root: HTMLElement;
  private C: Content;
  private gender: Gender;
  private slug: string | null;
  private lockedScene: string | null;
  private N = 30;
  private circles: Record<number, Snapshot> = {};
  private creations: Record<number, CreationMeta> = {};
  private event: EventInfo | null = null;
  private offset = 0;
  private factIdx = 0;
  private prevFinished = new Set<number>();
  private startedAt = Date.now();
  private boards = new Map<string, Board>();
  private xfCache = new Map<string, Xf>();
  private lastPos = new Map<number, [number, number]>();
  private mapReady = false;
  private firstLoad = true;
  private goalHit = false;
  private grandOn = false;
  private revealOn = false;
  private player: Player | null = null;
  private kal: Kaleido | null = null;
  private focusId: number | null = null;
  private cmp: number[] = [];
  private SCENES: Scene[];
  private si = 0;
  private cur: Scene;
  private sceneTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private news: { k: string; t: string }[] = [];
  private prevState: Record<number, { zone: string; here: string; floods: number; finished: boolean }> = {};
  private celT: ReturnType<typeof setTimeout> | null = null;
  private grandInt: ReturnType<typeof setInterval> | null = null;
  private alive = true;
  private onKey: (e: KeyboardEvent) => void;
  private onResize: () => void;

  constructor(root: HTMLElement, opts: { slug: string | null; lockedScene: string | null; gender: Gender }) {
    this.root = root;
    this.slug = opts.slug;
    this.lockedScene = opts.lockedScene;
    this.gender = opts.gender;
    this.C = buildContent(opts.gender);
    const H = this.C.HALL;
    this.SCENES = [
      { id: "map", name: H.scenes.map, dur: 45, render: () => this.renderMap() },
      { id: "focus", name: H.scenes.focus, dur: 18, render: () => this.renderFocus(), prep: () => { this.focusId = this.pickFocus(); return !!this.focusId; } },
      { id: "map", name: H.scenes.map, dur: 35, render: () => this.renderMap() },
      { id: "compare", name: H.scenes.compare, dur: 16, render: () => this.renderCompare(), prep: () => { this.cmp = this.pickCompare(); return this.cmp.length === 2; } },
      { id: "map", name: H.scenes.map, dur: 35, render: () => this.renderMap() },
      { id: "race", name: H.scenes.race, dur: 20, render: () => this.renderRace() },
      { id: "focus", name: H.scenes.focus, dur: 18, render: () => this.renderFocus(), prep: () => { this.focusId = this.pickFocus(); return !!this.focusId; } },
      { id: "stats", name: H.scenes.stats, dur: 16, render: () => this.renderStats() },
    ];
    this.cur = this.SCENES[0];
    this.skeleton();
    this.show(this.SCENES[0]);
    this.schedule(this.SCENES[0].dur);
    this.nextFact();
    this.intervals.push(setInterval(() => { const s = Math.floor((Date.now() + this.offset - (this.startedAtMs() ?? this.startedAt)) / 1000); const el = this.$("#elapsed"); if (el) el.textContent = `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`; }, 1000));
    this.intervals.push(setInterval(() => this.nextFact(), 5500));
    this.later(() => this.hallBirds(), 3000);
    this.later(() => { this.hallCloud(300); this.hallCloud(1250); }, 1500);
    this.intervals.push(setInterval(() => this.hallCloud(), 26000));
    this.onKey = (e: KeyboardEvent) => { if (e.key === "r") this.showReveal(); if (e.key === "Escape") this.hideReveal(); if (e.key === "f") document.documentElement.requestFullscreen?.().catch(() => {}); if (e.key === "ArrowLeft") this.nextScene(); };
    this.onResize = () => this.fit();
    document.addEventListener("keydown", this.onKey);
    addEventListener("resize", this.onResize);
    this.fit();
  }

  destroy() {
    this.alive = false;
    document.removeEventListener("keydown", this.onKey);
    removeEventListener("resize", this.onResize);
    this.timers.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    if (this.sceneTimer) clearTimeout(this.sceneTimer);
    if (this.celT) clearTimeout(this.celT);
    if (this.grandInt) clearInterval(this.grandInt);
    this.player?.stop();
    this.kal?.stop();
    this.root.innerHTML = "";
  }

  // ---------- helpers ----------
  private $(sel: string): HTMLElement | null { return this.root.querySelector(sel); }
  private later(fn: () => void, ms: number) { const t = setTimeout(() => { if (this.alive) fn(); }, ms); this.timers.push(t); return t; }
  private list(): Snapshot[] { return Object.values(this.circles); }
  private startedAtMs(): number | null { return this.event?.startedAt ? new Date(this.event.startedAt).getTime() : null; }
  private zoneById(id: string | null | undefined) { return this.C.ZONES.find((z) => z.id === id); }
  private tierFor(n: number) { return this.C.GAME.tiers.find((t) => t.id === tierIdFor(n))!; }
  private boardOf(c: { seed?: number; circle: number } | null | undefined): Board | null { if (!c || !c.seed) return null; const key = `${c.seed}:${c.circle}`; if (!this.boards.has(key)) this.boards.set(key, makeBoard(c.seed, c.circle)); return this.boards.get(key)!; }
  /** The island's clock as the kit's `remaining` (seconds left of the island's time), from the server's clock. */
  private remaining(c: Snapshot): number | null { if (!c.timerEnd) return null; return Math.max(0, (c.timerEnd - (Date.now() + this.offset)) / 1000); }
  private progress(c: Snapshot | undefined): number {
    if (!c) return 0;
    if (c.finished) return 1;
    const st = c.stage || 0;
    if (st < 1) return 0;
    const rem = this.remaining(c);
    const frac = rem != null ? 1 - rem / (c.timerTotal || 600) : 0.5;
    return Math.min(0.94, ((st - 1 + Math.min(1, Math.max(0, frac))) / 6) * 0.9 + 0.04);
  }

  // ---------- the data ----------
  update(view: HallView, offset: number) {
    if (!this.alive) return;
    this.offset = offset;
    const prevCtl = JSON.stringify([this.event?.hallScene, this.event?.focusCircle, this.event?.compare]);
    const prevReveal = !!this.event?.reveal;
    this.event = view.event;
    if (view.event && view.event.gender !== this.gender) { this.gender = view.event.gender; this.C = buildContent(this.gender); }
    this.N = view.event?.circles || 30;
    this.circles = {};
    view.circles.forEach((c) => { if (c && c.circle) this.circles[c.circle] = c; });
    this.creations = {};
    view.creations.forEach((c) => { if (c && c.circle) this.creations[c.circle] = c; });
    this.onData();
    const reveal = !!view.event?.reveal;
    if (reveal && !prevReveal) this.showReveal();
    else if (!reveal && prevReveal && this.revealOn) this.hideReveal();
    // the studio's remote changed, or the page opened already locked (?scene= / a locked hallScene): switch now, not in 45s
    const forced = !!this.lockedScene || (!!view.event?.hallScene && view.event.hallScene !== "auto");
    if (JSON.stringify([view.event?.hallScene, view.event?.focusCircle, view.event?.compare]) !== prevCtl ? !this.firstLoadCtl || forced : this.firstLoadCtl && forced) this.nextScene();
    this.firstLoadCtl = false;
  }
  private firstLoadCtl = true;

  // ---------- the skeleton ----------
  private skeleton() {
    const H = this.C.HALL;
    this.root.innerHTML = `
  <div class="sky"></div>
  <header class="h-head">
    <div style="display:flex;align-items:center;gap:22px">${logo(96)}<div><div class="h-title">${H.title}</div><div class="h-live"><i></i>${H.live} · <span id="elapsed">00:00</span></div></div></div>
    <div class="h-scene" id="sceneName"></div>
    <div class="h-kpis"><div><b id="k-active">0</b><span>${H.active}</span></div><div><b id="k-tokens">0</b><span>${H.tokens}</span><div class="goal"><i id="k-goalbar"></i></div><span id="k-goal" class="goal-t"></span></div><div><b id="k-arrived">0</b><span>${H.arrived}</span></div></div>
  </header>
  <main class="scenes"><section class="scene" id="sc-map"></section><section class="scene" id="sc-focus"></section><section class="scene" id="sc-compare"></section><section class="scene" id="sc-race"></section><section class="scene" id="sc-stats"></section></main>
  <div class="ticker"><span class="t-ic">${icon("star", 50, "#1B2645")}</span><span id="fact"></span><span class="t-dots" id="sceneDots"></span></div>
  <div id="celebrate"></div>
  <div id="reveal" hidden></div>`;
  }

  // ============================================================
  //  scene 1: the drone's view
  // ============================================================
  private anchorAng(i: number) { return ((-90 + ((i - 1) * 360) / this.N) * Math.PI) / 180; }
  // every board turned so its goal faces אי השפיות and its start points out
  private boardXf(i: number, B: Board): Xf {
    const key = i + ":" + B.seed + ":" + this.N;
    const hit = this.xfCache.get(key);
    if (hit) return hit;
    const a = this.anchorAng(i), ax = MAP.cx + Math.cos(a) * MAP.rx, ay = MAP.cy + Math.sin(a) * MAP.ry;
    const st = B.faces[B.start].c, gl = B.faces[B.goal].c;
    const cx = B.faces.reduce((s, f) => s + f.c[0], 0) / B.faces.length, cy = B.faces.reduce((s, f) => s + f.c[1], 0) / B.faces.length;
    const toC = Math.atan2(MAP.cy - ay, MAP.cx - ax), v = Math.atan2(gl[1] - st[1], gl[0] - st[0]);
    const th = toC - v, s = 10.2, co = Math.cos(th), si = Math.sin(th);
    const pt = ([x, y]: readonly [number, number] | number[]): [number, number] => [ax + ((x - cx) * co - (y - cy) * si) * s, ay + ((x - cx) * si + (y - cy) * co) * s];
    const X: Xf = { a, ax, ay, pt, s, th, cx, cy };
    this.xfCache.set(key, X);
    return X;
  }
  // 22.11: the ship stops at the shore of אי השפיות (the drawing is 560×373) and never climbs on it.
  private dockPt(i: number): [number, number] { const a = this.anchorAng(i), sn = Math.sin(a); return [MAP.cx + Math.cos(a) * 314, MAP.cy + sn * 196 + (sn > 0 ? sn * 66 : 0)]; }
  private dayFrac() {
    const L = this.list().filter((c) => (c.stage || 0) >= 1 || c.finished);
    const p = L.length ? L.reduce((s, c) => s + this.progress(c), 0) / L.length : 0;
    const s0 = this.startedAtMs();
    const t = s0 ? (Date.now() + this.offset - s0) / (100 * 60000) : 0;
    return Math.max(0, Math.min(1, Math.max(p, t)));
  }
  private initMap() {
    let stars = "";
    for (let k = 0; k < 90; k++) { const x = ((k * 733) % 1900) + 10, y = ((k * 389) % 810) + 10; stars += `<circle cx="${x}" cy="${y}" r="${(k % 3) * 0.7 + 1}" fill="#fff" style="animation-delay:${(k % 7) * 0.4}s"/>`; }
    const el = this.$("#sc-map")!;
    el.innerHTML = `
    <svg id="mapsvg" viewBox="0 0 ${MAP.w} ${MAP.h}" width="${MAP.w}" height="${MAP.h}" font-family="Rag Sans" style="position:absolute;inset:0">
      <defs><radialGradient id="seaG" cx="50%" cy="50%" r="72%"><stop id="sg0" offset="0" stop-color="#CBEAFA"/><stop id="sg1" offset=".55" stop-color="#86C9EE"/><stop id="sg2" offset="1" stop-color="#4FA9DD"/></radialGradient>
      ${FACE_KINDS.map((k) => `<pattern id="pt-${k}" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${ASSETS}/islands/${k}_tile.jpg" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>`).join("")}<pattern id="seaT" patternUnits="userSpaceOnUse" width="314" height="314"><image href="${ASSETS}/scene/sea_tile.png" width="314" height="314"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to="314 0" dur="90s" repeatCount="indefinite"/></pattern><radialGradient id="sunG" cx="12%" cy="0%" r="70%"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".9"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient></defs>
      <rect width="${MAP.w}" height="${MAP.h}" fill="url(#seaG)"/><rect width="${MAP.w}" height="${MAP.h}" fill="url(#seaT)"/><rect id="sun" width="${MAP.w}" height="${MAP.h}" fill="url(#sunG)"/>
      <g transform="translate(${MAP.cx} ${MAP.cy})">
        <defs><clipPath id="goalClip"><ellipse rx="252" ry="140"/></clipPath><radialGradient id="goalGlow"><stop offset="0" stop-color="#FFF3C8" stop-opacity=".9"/><stop offset="1" stop-color="#FFF3C8" stop-opacity="0"/></radialGradient></defs>
        <g id="islandGlow" opacity="0"><ellipse rx="330" ry="200" fill="#FFD66B" opacity=".25"/></g>
        <ellipse cy="10" rx="290" ry="186" fill="#1C4E72" opacity=".10"/>
        <image href="${ASSETS}/scene/goal_top.png" x="-280" y="-187" width="560" height="373"/>
        <g transform="translate(0 196)"><rect x="-108" y="-24" width="216" height="46" rx="23" fill="#15233F" stroke="#D9B46A" stroke-width="3"/><text y="11" text-anchor="middle" font-size="30" font-weight="700" fill="#F5EEE0">${nameOf("goal")}</text></g></g>
      <g id="L-boards"></g><rect id="tint" width="${MAP.w}" height="${MAP.h}" fill="#000" opacity="0" style="pointer-events:none"/>
      <g id="L-stars" class="stars" opacity="0">${stars}</g><g id="L-ships"></g></svg>
    <div class="ov ov-r" id="ovR"></div><div class="ov ov-l" id="ovL"></div><div class="daytime" id="daytime"></div>`;
    this.mapReady = true;
  }
  private renderMap() {
    if (!this.mapReady) this.initMap();
    const H = this.C.HALL;
    const L = this.list();
    const f = this.dayFrac(), sky = skyAt(f);
    ["sg0", "sg1", "sg2"].forEach((id, k) => this.$("#" + id)?.setAttribute("stop-color", sky.s[k]));
    const tint = this.$("#tint"); tint?.setAttribute("fill", sky.tint); tint?.setAttribute("opacity", String(sky.ta));
    this.$("#sun")?.setAttribute("opacity", String(Math.max(0, 1 - f * 3)));
    this.$("#L-stars")?.setAttribute("opacity", String(Math.max(0, (f - 0.8) / 0.2) * 0.6));
    this.$("#islandGlow")?.setAttribute("opacity", String(Math.max(0, (f - 0.6) / 0.4)));
    const dt = this.$("#daytime"); if (dt) dt.textContent = f < 0.2 ? DAY_NAMES[0] : f < 0.5 ? DAY_NAMES[1] : f < 0.72 ? DAY_NAMES[2] : f < 0.88 ? DAY_NAMES[3] : DAY_NAMES[4];
    // the boards: the real shape of every circle
    const ranks = L.filter((c) => c.finished).sort((a, b) => (a.finishedAt || a.t || 0) - (b.finishedAt || b.t || 0)).map((c) => c.circle);
    let boardsSvg = "";
    for (let i = 1; i <= this.N; i++) {
      const c = this.circles[i];
      const B = this.boardOf(c) || this.boardOf({ seed: 7000 + i, circle: i })!;
      const X = this.boardXf(i, B);
      const vis: string[] = (c && c.visited) || [], fl: number[] = (c && c.flooded) || [];
      let g = "";
      B.faces.forEach((fc) => {
        const pts = fc.pts.map((p) => X.pt(p).map((v) => v.toFixed(1)).join(",")).join(" ");
        const col = COLORS[fc.kind] || "#0062AF";
        const done = vis.includes(fc.kind) || (fc.kind === "start" && !!c && c.stage >= 1) || (fc.kind === "goal" && !!c && c.finished);
        const flooded = fl.includes(fc.i);
        g += `<polygon points="${pts}" fill="url(#pt-${fc.kind})" opacity="${done ? 1 : 0.62}" stroke="${done ? "#D9B46A" : col}" stroke-width="${done ? 2.6 : 1.6}"/>`;
        if (flooded) { const [fx, fy] = X.pt(fc.c); g += `<polygon class="flood" points="${pts}" fill="#2E71A0" fill-opacity=".62"/><path class="fwave" d="M${(fx - 9).toFixed(1)} ${(fy + 1).toFixed(1)} q 3 -3 6 0 t 6 0 t 6 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`; }
      });
      const [sx, sy] = X.pt(B.faces[B.start].c);
      const out = [sx + Math.cos(X.a) * 26, sy + Math.sin(X.a) * 18];
      g += `<g transform="translate(${out[0].toFixed(1)} ${out[1].toFixed(1)})"><circle r="15" fill="${c && c.finished ? "#E0A800" : c ? "#0062AF" : "#9FB4CC"}" stroke="#fff" stroke-width="2"/><text y="5.5" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">${i}</text></g>`;
      boardsSvg += `<g opacity="${c ? 1 : 0.45}">${g}</g>`;
    }
    const lb = this.$("#L-boards"); if (lb) lb.innerHTML = boardsSvg;
    // the ships: one fixed element per circle; only the position changes, softly
    const layer = this.$("#L-ships"); if (!layer) return;
    for (let i = 1; i <= this.N; i++) {
      const c = this.circles[i];
      let el = this.$("#ship-" + i) as SVGGElement | null;
      if (!c) { if (el) el.remove(); continue; }
      const B = this.boardOf(c); if (!B) continue;
      const X = this.boardXf(i, B);
      if (!el) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        el.id = "ship-" + i; el.setAttribute("class", "mboat");
        el.innerHTML = `<g class="bob">${boatG(0.62, false)}</g><g class="lbl" transform="translate(0 20)"></g>`;
        layer.appendChild(el);
        const p0 = X.pt(B.faces[B.start].c); el.style.transform = `translate(${p0[0]}px,${p0[1]}px)`;
      }
      let p: [number, number];
      if (c.finished) p = this.dockPt(i);
      else { const fi = c.pos != null && B.faces[c.pos] ? c.pos : B.start; p = X.pt(B.faces[fi].c); }
      const last = this.lastPos.get(i);
      if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) > 4) {
        const w = document.createElementNS("http://www.w3.org/2000/svg", "path"); w.setAttribute("class", "wake");
        w.setAttribute("d", `M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${p[0].toFixed(1)} ${p[1].toFixed(1)}`);
        layer.insertBefore(w, layer.firstChild); this.later(() => w.remove(), 6500);
      }
      this.lastPos.set(i, p);
      el.style.transform = `translate(${p[0].toFixed(1)}px,${(p[1] - 6).toFixed(1)}px)`;
      const rank = ranks.indexOf(i);
      const lbl = el.querySelector(".lbl")!;
      lbl.innerHTML = c.finished
        ? `<rect x="-34" y="-11" width="68" height="22" rx="11" fill="#E0A800" stroke="#fff" stroke-width="2"/><text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">מקום ${rank + 1}</text>`
        : `<rect x="-26" y="-11" width="52" height="22" rx="11" fill="#1B2645"/><text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff"><tspan>${i}</tspan><tspan fill="#FFD66B" dx="5">${c.total || 0}</tspan></text>`;
      el.classList.toggle("docked", !!c.finished);
    }
    // the side panels
    const sums = this.C.ZONES.map((z) => ({ z, n: L.reduce((s, c) => s + ((c.tokens || {})[z.id] || 0), 0) }));
    const mx = Math.max(1, ...sums.map((s) => s.n));
    const zc = (z: ZoneId) => L.filter((c) => c.zone === z && !c.finished && c.stage >= 1).length;
    const ovR = this.$("#ovR"), ovL = this.$("#ovL");
    if (ovR) ovR.innerHTML = ranks.length
      ? `<h4>${H.arrivedTitle}</h4>${ranks.slice(0, 7).map((n, k) => `<div class="ovrow"><b style="background:#E0A800">${k + 1}</b><span>מעגל ${n}</span><span class="num" style="margin-inline-start:auto;font-weight:700">${this.circles[n].total}</span></div>`).join("")}`
      : `<h4>${H.whereTitle}</h4>${this.C.ZONES.map((z) => `<div class="ovrow"><img src="${ASSETS}/islands/${z.id}_tile.jpg" height="30" alt="" style="clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)"><span style="color:${z.color}">${z.name}</span><b style="background:${z.color}">${zc(z.id)}</b></div>`).join("")}`;
    if (ovL) ovL.innerHTML = `<h4>${H.resourcesTitle}</h4>${sums.map(({ z, n }) => `<div class="ovbar">${token(z.id, 28)}<span class="bt"><i style="width:${(n / mx) * 100}%;background:${z.color}"></i></span><b class="num" style="color:${z.color}">${n}</b></div>`).join("")}`;
  }

  // ============================================================
  //  scene 2: zoom on one circle
  // ============================================================
  private pickFocus(): number | null {
    const fc = this.event?.focusCircle;
    if (fc && this.circles[fc]) return +fc;
    const L = this.list().filter((c) => c.stage >= 1); if (!L.length) return null;
    return L[Math.floor(Math.random() * L.length)].circle;
  }
  private boardSVG(c: Snapshot, w: number, h: number) {
    const b = this.boardOf(c); if (!b) return "";
    const sc = Math.min((w - 30) / b.w, (h - 30) / b.h); const ox = (w - b.w * sc) / 2, oy = (h - b.h * sc) / 2; let g = "";
    b.faces.forEach((f) => { let st = ""; if ((c.flooded || []).includes(f.i)) st += "flood "; if ((c.visited as string[] || []).includes(f.kind) || (f.kind === "market" && (c.usedHelpers || []).includes(f.kind))) st += "done "; g += faceSVG(f, sc, { state: st, label: true }); });
    const here = b.faces[c.pos ?? b.start];
    if (here) { const hp = here.pts.map(([x, y]) => `${x * sc},${y * sc}`).join(" "); g += `<polygon points="${hp}" fill="none" stroke="#fff" stroke-width="14"/><polygon class="here" points="${hp}" fill="none" stroke="#FFC609" stroke-width="9"/>`; }
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g transform="translate(${ox} ${oy})">${g}</g></svg>`;
  }
  private renderFocus() {
    const H = this.C.HALL;
    const c = this.focusId ? this.circles[this.focusId] : null; const el = this.$("#sc-focus")!; if (!c) { el.innerHTML = ""; return; }
    const z = this.zoneById(c.zone); const rank = [...this.list()].sort((a, b) => (b.total || 0) - (a.total || 0)).findIndex((x) => x.circle === c.circle) + 1;
    const tier = this.tierFor(c.total || 0); const done = c.finished ? 6 : Math.max(0, (c.visited || []).length);
    el.innerHTML = `<div class="focus">
    <div class="f-board">${this.boardSVG(c, 940, 700)}</div>
    <div class="f-info">
      <span class="f-kick">${icon("star", 34, "#E0A800")}${H.scenes.focus}</span><h2>מעגל ${c.circle}</h2>
      <p class="f-where">${c.finished ? H.arrivedTitle : z ? `עכשיו <b style="color:${z.color}">${prep("ב", z.name)}</b> · ${z.task}` : H.leaving}</p>
      <div class="f-stats"><div><b>${done}/6</b><span>איים</span></div><div><b>${c.total}</b><span>אסימונים</span></div><div><b>#${rank}</b><span>באולם</span></div><div><b>${c.floods || 0}</b><span>הצפות</span></div></div>
      <div class="f-pack">${this.C.ZONES.map((zz) => `<div>${token(zz.id, 60)}<b style="color:${zz.color}">${(c.tokens || {})[zz.id] || 0}</b><span>${zz.resource}</span></div>`).join("")}</div>
      <p class="f-tier">בדרך ל: <b>${tier.title}</b></p></div></div>`;
  }

  // ============================================================
  //  scene 3: head to head
  // ============================================================
  private pickCompare(): number[] {
    const cc = this.event?.compare;
    if (cc && cc.length === 2 && this.circles[cc[0]] && this.circles[cc[1]]) return cc.map(Number);
    const L = [...this.list()].filter((c) => c.stage >= 1).sort((a, b) => (b.total || 0) - (a.total || 0)); if (L.length < 2) return [];
    const i = Math.floor(Math.random() * (L.length - 1)); return [L[i].circle, L[i + 1].circle];
  }
  private renderCompare() {
    const H = this.C.HALL;
    const el = this.$("#sc-compare")!; const [a, b] = this.cmp.map((n) => this.circles[n]); if (!a || !b) { el.innerHTML = ""; return; }
    const mx = Math.max(6, ...this.C.ZONES.flatMap((z) => [(a.tokens || {})[z.id] || 0, (b.tokens || {})[z.id] || 0]));
    const side = (c: Snapshot, cls: string) => { const z = this.zoneById(c.zone); return `<div class="cmp-head ${cls}"><span>מעגל</span><b>${c.circle}</b><em class="num">${c.total} אסימונים</em><small>${c.finished ? H.arrived : z ? "עכשיו " + prep("ב", z.name) : ""}</small></div>`; };
    el.innerHTML = `<div class="cmp"><div class="cmp-top">${side(a, "a")}<span class="vs">מול</span>${side(b, "b")}</div>
    <div class="cmp-rows">${this.C.ZONES.map((z) => { const va = (a.tokens || {})[z.id] || 0, vb = (b.tokens || {})[z.id] || 0; return `<div class="cmp-row"><span class="cb a"><b class="num" style="color:${z.color}">${va}</b><i style="width:${(va / mx) * 100}%;background:${z.color}"></i></span><span class="cz" style="color:${z.color}">${token(z.id, 46)}${z.resource}</span><span class="cb b"><i style="width:${(vb / mx) * 100}%;background:${z.color}"></i><b class="num" style="color:${z.color}">${vb}</b></span></div>`; }).join("")}</div></div>`;
  }

  // ============================================================
  //  scene 4: the race
  // ============================================================
  private lane(c: Snapshot | undefined, i: number) {
    const W = 600; const st = c ? c.stage : 0; const done = !!c && c.finished; const visited: string[] = (c && c.visited) || [];
    const X = (p: number) => W - 24 - (p / 6.5) * (W - 48); const pos = done ? 6.5 : this.progress(c) * 6.5;
    const symbolPath = (z: ZoneId) => symbol(z, 100, "#fff").replace(/<svg[^>]*>|<\/svg>/g, "");
    const dots = [...Array(6)].map((_, k) => { const z = visited[k]; const cur = !z && k === st - 1 && !done && c ? c.zone : null; const cc = cur && isZoneId(cur) ? COLORS[cur] : null;
      return `<g transform="translate(${X(k + 0.5)} 22)"><polygon points="${hexPts(0, 0, 13)}" fill="${z && isZoneId(z) ? COLORS[z] : cc ? `color-mix(in srgb, ${cc} 22%, #fff)` : "#fff"}" stroke="${z && isZoneId(z) ? COLORS[z] : cc || "#9CCBEB"}" stroke-width="2.4" ${cur ? 'class="pulse"' : ""}/>${z && isZoneId(z) ? `<g transform="translate(-8 -8) scale(.16)">${symbolPath(z)}</g>` : ""}</g>`; }).join("");
    return `<div class="lane ${done ? "done" : ""}"><b class="ln">${c ? c.circle : i}</b>
    <svg viewBox="0 0 ${W} 44" width="${W}" height="44"><path d="M${X(0)} 22 H${X(6.5)}" stroke="#9CCBEB" stroke-width="2" stroke-dasharray="3 7"/>${dots}
    <g transform="translate(${X(6.5)} 22)"><polygon points="${hexPts(0, 0, 17)}" fill="${done ? "#E0A800" : "#FFF6D6"}" stroke="#E0A800" stroke-width="2.4"/></g>
    ${c && !done && st >= 1 ? `<g transform="translate(${X(pos)} 30)">${boatG(0.62, true)}</g>` : ""}</svg><span class="lt num">${c ? c.total : ""}</span></div>`;
  }
  private renderRace() {
    const arr = [...Array(this.N)].map((_, i) => this.circles[i + 1]); const h = Math.ceil(this.N / 2);
    this.$("#sc-race")!.innerHTML = `<div class="race"><div class="cols"><div class="col">${arr.slice(0, h).map((c, i) => this.lane(c, i + 1)).join("")}</div><div class="col">${arr.slice(h).map((c, i) => this.lane(c, h + i + 1)).join("")}</div></div></div>`;
  }

  // ============================================================
  //  scene 5: the numbers
  // ============================================================
  private renderStats() {
    const H = this.C.HALL;
    const L = this.list(); const sums = this.C.ZONES.map((z) => ({ z, n: L.reduce((s, c) => s + ((c.tokens || {})[z.id] || 0), 0) })); const mx = Math.max(1, ...sums.map((s) => s.n));
    const top = [...L].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 3);
    const floods = L.reduce((s, c) => s + (c.floods || 0), 0), dried = L.reduce((s, c) => s + (c.dried || 0), 0), reef = L.filter((c) => (c.visited as string[] || []).includes("reef")).length;
    this.$("#sc-stats")!.innerHTML = `<div class="stats">
    <div class="st-res"><h2>מה האולם אסף עד עכשיו</h2><div class="st-bars">${sums.map(({ z, n }) => `<div class="st-col"><b class="num" style="color:${z.color}">${n}</b><span class="st-b"><i style="height:${(n / mx) * 100}%;background:${z.color}"></i></span>${token(z.id, 70)}<em style="color:${z.color}">${z.resource}</em></div>`).join("")}</div></div>
    <div class="st-side"><div class="st-card"><h3>${H.leaders}</h3><div class="podium">${top.map((c, i) => `<div class="pd p${i + 1}"><b>מעגל ${c.circle}</b><span class="num">${c.total}</span></div>`).join("")}</div></div>
    <div class="st-card st-nums"><div><b>${floods}</b><span>איים הוצפו</span></div><div><b>${dried}</b><span>ייבושים</span></div><div><b>${reef}</b><span>מעגלים קמו בריף</span></div></div></div></div>`;
  }

  // ============================================================
  //  the scene manager
  // ============================================================
  private show(scene: Scene) {
    this.cur = scene;
    this.root.querySelectorAll(".scene").forEach((s) => s.classList.toggle("on", s.id === "sc-" + scene.id));
    const sn = this.$("#sceneName"); if (sn) sn.innerHTML = `<i></i>${scene.name}`;
    scene.render();
    const dots = this.$("#sceneDots"); if (dots) dots.innerHTML = this.SCENES.map((s) => `<i class="${s === scene ? "on" : ""}"></i>`).join("");
  }
  nextScene() {
    if (!this.alive) return;
    const ctl = this.event?.hallScene;
    const forced = this.lockedScene || (ctl && ctl !== "auto" ? ctl : null);
    if (forced) {
      if (forced === "grand") { this.showGrand(); this.schedule(12); return; }
      const s = this.SCENES.find((x) => x.id === forced) || this.SCENES[0];
      if (s.prep && !s.prep()) this.show(this.SCENES[0]); else this.show(s);
      this.schedule(12); return;
    }
    for (let k = 0; k < this.SCENES.length; k++) { this.si = (this.si + 1) % this.SCENES.length; const s = this.SCENES[this.si]; if (!s.prep || s.prep()) { this.show(s); break; } }
    this.schedule(this.cur.dur);
  }
  private schedule(sec: number) { if (this.sceneTimer) clearTimeout(this.sceneTimer); this.sceneTimer = setTimeout(() => this.nextScene(), sec * 1000); }
  /** For the presenter: lock on one scene now (the kit's window.HALL.show). */
  showScene(id: SceneId) { const s = this.SCENES.find((x) => x.id === id); if (s && (!s.prep || s.prep())) this.show(s); }

  // ============================================================
  //  22.11: the great scene at the end: the gate of אי השפיות opens for the whole hall
  // ============================================================
  private checkGrand() {
    const L = this.list(); if (this.grandOn || !L.length) return;
    const all = L.filter((c) => c.stage >= 1 || c.finished);
    if ((all.length && all.every((c) => c.finished)) || this.lockedScene === "grand" || this.event?.hallScene === "grand") this.showGrand();
  }
  private showGrand() {
    if (this.grandOn) return;
    this.grandOn = true; if (this.sceneTimer) clearTimeout(this.sceneTimer);
    const H = this.C.HALL;
    const L = this.list();
    const sums = this.C.ZONES.map((z) => ({ z, n: L.reduce((s, c) => s + ((c.tokens || {})[z.id] || 0), 0) }));
    const g = document.createElement("div"); g.id = "grand";
    const chip = ({ z, n }: { z: Content["ZONES"][number]; n: number }) => `<div class="gc"><img src="${ASSETS}/coins/coin_${z.id}.png" alt=""><b class="num">${n}</b><span>${z.resource}</span></div>`;
    g.innerHTML = `<div class="g-head"><p>${this.N} מעגלים · ${H.grandLine} ${prep("ל", nameOf("goal"))}</p><h1>האולם אסף</h1><b class="num" id="g-n">0</b></div>
    <div class="g-gate"><img src="${ASSETS}/scene/gate_open.png" alt=""><div class="leaf l"><img src="${ASSETS}/scene/door_r.png" alt=""></div><div class="leaf r"><img src="${ASSETS}/scene/door_l.png" alt=""></div></div>
    <div class="g-side r">${sums.slice(0, 3).map(chip).join("")}</div><div class="g-side l">${sums.slice(3).map(chip).join("")}</div>
    <div class="confetti" id="g-conf"></div>`;
    this.root.appendChild(g);
    this.later(() => g.classList.add("on"), 50);
    this.later(() => g.querySelector(".g-gate")?.classList.add("open"), 1600);
    this.later(async () => {
      const el = this.$("#g-n"); if (!el) return; const steps = 60; const live = () => this.list().reduce((s, c) => s + (c.total || 0), 0);
      for (let k = 1; k <= steps; k++) { if (!this.alive) return; el.textContent = String(Math.round((live() * k) / steps)); await new Promise((r) => setTimeout(r, 40)); }
      this.grandInt = setInterval(() => { el.textContent = String(live()); this.root.querySelectorAll("#grand .gc b").forEach((b, i) => { const z = this.C.ZONES[i]; b.textContent = String(this.list().reduce((s, c) => s + ((c.tokens || {})[z.id] || 0), 0)); }); }, 2000);
      const cols = this.C.ZONES.map((z) => z.color).concat(["#D9B46A", "#F5EEE0"]);
      const bits = [...Array(160)].map((_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % cols.length]};animation-delay:${(k % 24) * 0.08}s;animation-duration:${3 + (k % 7) * 0.3}s;--dx:${((k * 53) % 200) - 100}px;--rt:${(k * 97) % 720}deg"></i>`).join("");
      const conf = this.$("#g-conf"); if (conf) conf.innerHTML = bits + this.coinBits(48);
    }, 3000);
  }

  // ---------- updates ----------
  private setNum(id: string, v: number) { const el = this.$("#" + id); if (!el) return; if (+(el.textContent || 0) !== v) { el.textContent = String(v); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } }
  private renderKpis() {
    const B = this.C.BONUS;
    const L = this.list(); const tot = L.reduce((s, c) => s + (c.total || 0), 0); const goal = L.length * RULES.bonuses.hallGoalPerCircle;
    this.setNum("k-active", L.filter((c) => c.stage >= 1 && !c.finished).length); this.setNum("k-tokens", tot); this.setNum("k-arrived", L.filter((c) => c.finished).length);
    const pct = goal ? Math.min(100, (tot / goal) * 100) : 0; const bar = this.$("#k-goalbar"); if (bar) bar.style.width = pct + "%";
    const kg = this.$("#k-goal"); if (kg) kg.textContent = tot >= goal && goal ? `${B.hallGoal} הושג! +${RULES.bonuses.hallGoal} לכל מעגל` : `${B.hallGoal}: ${goal}`;
    if (goal && tot >= goal && !this.goalHit) { this.goalHit = true; if (!this.firstLoad) this.goalCelebrate(goal); }
  }
  private coinBits(n: number) { return [...Array(n)].map((_, k) => { const z = ZONE_IDS[k % ZONE_IDS.length]; return `<i class="cc" style="left:${(k * 61 + 7) % 100}%;background-image:url(${ASSETS}/coins/coin_${z}.png);animation-delay:${(k % 18) * 0.11}s;animation-duration:${3 + (k % 5) * 0.35}s;--dx:${((k * 41) % 160) - 80}px;--rt:${(k * 83) % 540}deg"></i>`; }).join(""); }
  private goalCelebrate(goal: number) {
    const H = this.C.HALL, B = this.C.BONUS;
    const el = this.$("#celebrate"); if (!el) return; const cols = this.C.ZONES.map((z) => z.color).concat(["#FFD66B", "#FFFFFF"]);
    const bits = [...Array(200)].map((_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % cols.length]};animation-delay:${(k % 24) * 0.06}s;animation-duration:${2.4 + (k % 7) * 0.25}s;--dx:${((k * 53) % 200) - 100}px;--rt:${(k * 97) % 720}deg;${k % 3 ? "" : "border-radius:50%;"}"></i>`).join("");
    el.innerHTML = `<div class="confetti">${bits}${this.coinBits(30)}</div><div class="cel"><div class="cel-in">${icon("star", 90, "#E0A800")}<div><span>${B.hallGoal}!</span><b>${H.goalTitle}</b><em>${fill(B.hallGoalLine, { goal, n: RULES.bonuses.hallGoal })}</em></div></div></div>`;
    if (this.celT) clearTimeout(this.celT); this.celT = setTimeout(() => { el.innerHTML = ""; }, 7000);
  }
  // 22.11: the news strip: real events from the tables, facts in between
  private collectNews() {
    const H = this.C.HALL;
    this.list().forEach((c) => {
      const p = this.prevState[c.circle];
      if (p && !this.firstLoad) {
        const z = this.zoneById(c.zone);
        if (c.zone && c.zone !== p.zone && z && !c.finished) this.news.push({ k: c.zone, t: `מעגל ${c.circle} ${H.news.docked} ${prep("ב", z.name)}` });
        if (c.here === "fog" && p.here !== "fog") this.news.push({ k: "fog", t: `מעגל ${c.circle} ${H.news.fog} בערפל` });
        if (c.here === "lighthouse" && p.here !== "lighthouse") this.news.push({ k: "lighthouse", t: `מעגל ${c.circle} ${H.news.lighthouse} במגדלור` });
        if (c.here === "market" && p.here !== "market") this.news.push({ k: "market", t: `מעגל ${c.circle} ${H.news.market} בשוק החליפין` });
        if ((c.floods || 0) > (p.floods || 0)) this.news.push({ k: "lake", t: `הגאות עלתה: אי הוצף אצל מעגל ${c.circle}` });
        if (c.finished && !p.finished) this.news.push({ k: "goal", t: `מעגל ${c.circle} ${H.news.arrived} ${prep("ל", nameOf("goal"))}!` });
      }
      this.prevState[c.circle] = { zone: c.zone, here: c.here, floods: c.floods, finished: c.finished };
    });
    this.news.splice(0, Math.max(0, this.news.length - 12));
  }
  private nextFact() {
    const H = this.C.HALL;
    const ic = this.root.querySelector(".ticker .t-ic"); const el = this.$("#fact"); if (!ic || !el) return;
    if (this.news.length) { const n = this.news.shift()!; el.classList.remove("in"); void el.offsetWidth; el.textContent = n.t; el.classList.add("in"); ic.innerHTML = `<img src="${ASSETS}/islands/${n.k}_tile.jpg" alt="">`; return; }
    ic.innerHTML = `<img src="${ASSETS}/logo.png" alt="">`;
    const L = this.list();
    if (!L.length) { el.textContent = H.settling; return; }
    const sums = this.C.ZONES.map((z) => ({ z, n: L.reduce((s, c) => s + ((c.tokens || {})[z.id] || 0), 0) })).sort((a, b) => a.n - b.n);
    const zc: Record<string, number> = {}; L.forEach((c) => { if (this.zoneById(c.zone) && !c.finished) zc[c.zone] = (zc[c.zone] || 0) + 1; }); const busy = Object.entries(zc).sort((a, b) => b[1] - a[1])[0];
    const lead = [...L].sort((a, b) => (b.total || 0) - (a.total || 0))[0]; const avg = Math.round(L.reduce((s, c) => s + (c.total || 0), 0) / L.length);
    const facts = [fill(H.facts[0], { n: L.filter((c) => (c.visited as string[] || []).includes("reef")).length }), fill(H.facts[1], { resource: sums[0].z.resource }), fill(H.facts[2], { n: L.reduce((s, c) => s + (c.floods || 0), 0) }), busy ? fill(H.facts[3], { zone: prep("ב", this.zoneById(busy[0])!.name) }) : null, lead ? fill(H.facts[4], { circle: lead.circle, n: lead.total }) : null, fill(H.facts[5], { n: L.filter((c) => c.dried).length }), fill(H.facts[6], { n: avg })].filter((x): x is string => !!x);
    el.classList.remove("in"); void el.offsetWidth; el.textContent = facts[this.factIdx++ % facts.length]; el.classList.add("in");
  }
  private celebrate(c: Snapshot) {
    const H = this.C.HALL;
    const el = this.$("#celebrate"); if (!el) return;
    const rank = this.list().filter((x) => x.finished).sort((a, b) => (a.finishedAt || a.t || 0) - (b.finishedAt || b.t || 0)).findIndex((x) => x.circle === c.circle) + 1;
    const cols = this.C.ZONES.map((z) => z.color).concat(["#FFD66B", "#FFFFFF"]);
    const bits = [...Array(140)].map((_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % cols.length]};animation-delay:${(k % 20) * 0.06}s;animation-duration:${2.4 + (k % 7) * 0.25}s;--dx:${((k * 53) % 200) - 100}px;--rt:${(k * 97) % 720}deg;${k % 3 ? "" : "border-radius:50%;"}"></i>`).join("");
    el.innerHTML = `<div class="confetti">${bits}${this.coinBits(26)}</div><div class="cel"><div class="cel-in"><img src="${ASSETS}/scene/gate.png" alt="" style="height:120px"><div><span>${H.arrivedTitle}!</span><b>מעגל ${c.circle} · מקום ${rank}</b><em class="num">${c.total} אסימונים · ${this.tierFor(c.total || 0).title}</em></div></div></div>`;
    const ship = this.$("#ship-" + c.circle); if (ship) { ship.classList.remove("arrive"); void (ship as unknown as SVGGraphicsElement).getBBox; ship.classList.add("arrive"); }
    if (this.celT) clearTimeout(this.celT); this.celT = setTimeout(() => { el.innerHTML = ""; }, 5200);
  }
  private onData() {
    this.collectNews(); this.renderKpis(); this.cur.render(); this.checkGrand();
    this.list().forEach((c) => { if (c.finished && !this.prevFinished.has(c.circle)) { this.prevFinished.add(c.circle); if (!this.firstLoad) this.celebrate(c); } });
    this.firstLoad = false;
  }
  private hallBirds() {
    const host = this.$("#sc-map");
    if (host && !this.grandOn) {
      const n = Math.random() < 0.7 ? 1 : 2, dur = 26 + Math.random() * 12;
      for (let i = 0; i < n; i++) {
        const sc = 0.26 + Math.random() * 0.16, y = 150 + Math.random() * 560; const f = document.createElement("div"); f.className = "flyer"; f.innerHTML = `<div class="bird" style="transform:scale(${sc.toFixed(2)});animation-delay:-${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(0.9 + Math.random() * 0.4).toFixed(2)}s"></div>`;
        f.style.left = 1960 + i * (300 + Math.random() * 500) + "px"; f.style.top = y.toFixed(0) + "px"; f.style.transitionDuration = dur + i * 4 + "s"; host.appendChild(f);
        requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${-2600}px, ${-60 + Math.random() * 120}px)`; })); this.later(() => f.remove(), (dur + i * 4) * 1000 + 500);
      }
    }
    this.later(() => this.hallBirds(), 9000 + Math.random() * 12000);
  }
  private hallCloud(startX?: number) {
    const host = this.$("#sc-map");
    if (host && !this.grandOn) {
      const k = Math.floor(Math.random() * 5), w = 170 + Math.random() * 150, dur = 80 + Math.random() * 40;
      const c = document.createElement("img"); c.src = `${ASSETS}/scene/cloud_${k}.png`; c.className = "hcloud"; c.alt = ""; c.style.width = w.toFixed(0) + "px";
      const x0 = startX ?? -w - 20; c.style.left = x0 + "px"; c.style.top = (60 + Math.random() * 640).toFixed(0) + "px";
      const dist = 1960 + w - x0, t = (dur * dist) / (1960 + w * 2); c.style.transitionDuration = t.toFixed(1) + "s"; host.appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = `translateX(${dist}px)`; })); this.later(() => c.remove(), t * 1000 + 500);
    }
  }

  // ============================================================
  //  the reveal
  // ============================================================
  showReveal() {
    if (this.revealOn) return; this.revealOn = true;
    const R = this.C.REVEAL, H = this.C.HALL;
    const el = this.$("#reveal"); if (!el) return; el.hidden = false;
    el.innerHTML = `<div class="rv-intro"><p class="rv1">${R.pre}</p><p class="rv2">${R.pre2}</p><button class="btn" id="rv-go" type="button" style="margin-top:40px;background:#E0A800">${H.revealCta} ${icon("star", 40, "#fff")}</button></div>`;
    const go = this.$("#rv-go"); if (go) go.onclick = () => this.runReveal();
  }
  private async runReveal() {
    const R = this.C.REVEAL, T = this.C.TASKS;
    const el = this.$("#reveal"); if (!el) return;
    const L = Object.values(this.creations).sort((a, b) => a.circle - b.circle);
    el.innerHTML = `<canvas id="kal" width="1920" height="1080"></canvas>
    <div class="rv-top">${logo(110)}</div>
    <div class="rv-legend"><span>${icon("wave", 40, "#fff")}${R.melody}</span><span>${icon("speech", 40, "#fff")}${R.song}</span><span>${icon("tiles", 40, "#fff")}${R.shape}</span></div>
    <div class="rv-line"><small id="rv-c"></small><span>${T.safari.sentenceStart},</span><b id="rv-s"></b></div>
    <div class="rv-lyrics" id="rv-lyrics"></div>`;
    this.kal = new Kaleido(this.$("#kal") as HTMLCanvasElement); this.kal.start();
    const logos: Record<number, string> = {};
    const slug = this.event?.slug ?? this.slug ?? "";
    for (const c of L) logos[c.circle] = (c.hasPhoto && (await photoToLogo(photoPath(slug, c.circle, c.photoAt)))) || logoFromNumbers(c.standing, c.circle);
    if (!this.revealOn) return;
    const score = buildScore(L); const lyr = this.$("#rv-lyrics");
    this.player = playScore(score, { onCircle: async (n) => {
      const c = this.creations[n]; const rc = this.$("#rv-c"); if (rc) rc.textContent = `מעגל ${n}`;
      const s = this.$("#rv-s"); if (s) { s.classList.remove("in"); void s.offsetWidth; s.textContent = c?.sentence || "..."; s.classList.add("in"); }
      await this.kal?.add(logos[n]); if (lyr) { const li = document.createElement("div"); li.textContent = `אנחנו ${c?.sentence || ""}`; lyr.prepend(li); [...lyr.children].slice(9).forEach((x) => x.remove()); }
    } });
    this.later(() => { if (!this.revealOn) return; const f = document.createElement("div"); f.className = "rv-final"; f.innerHTML = `<p>${R.close}</p>`; el.appendChild(f); }, (score.length + 1) * 1000);
  }
  hideReveal() { this.revealOn = false; this.player?.stop(); this.player = null; this.kal?.stop(); this.kal = null; const el = this.$("#reveal"); if (el) { el.hidden = true; el.innerHTML = ""; } }

  // ---------- scale ----------
  private fit() { const k = Math.min(innerWidth / 1920, innerHeight / 1080); this.root.style.transform = `scale(${k})`; }
}

export const resourceOf = RESOURCE_OF;
