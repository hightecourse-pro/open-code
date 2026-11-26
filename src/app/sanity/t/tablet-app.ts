// ============================================================================
// The tablet of a circle · a 1280×720 stage scaled to any screen.
// A faithful port of the hand-over kit's tablet.js (22.11, ״ההדמיה המלאה״):
// a phase machine - R[phase] draws every screen, go() moves to the next - with
// typed state (GameState), the texts from content.ts in the event's gender,
// the game saved in localStorage AND on the server (sync.ts): a refresh, a
// dead battery or a replacement device all come back to the same screen.
// ============================================================================
import { buildContent, fill, type Content, type ZoneId } from "@/lib/sanity/content";
import * as E from "@/lib/sanity/engine";
import type { Face, GameState, Phase } from "@/lib/sanity/engine";
import { photoPath, type TabletBootstrap, type TabletSave } from "@/lib/sanity/shared";
import { createEditBar, decorate, loadStore, markDeep, putRow, readEditable, screenId, type EditStore } from "./edit-mode";
import { createSync } from "./sync";

export interface TabletOptions {
  boot: TabletBootstrap;
  token: string;
  dev: boolean;
  shot: boolean;
  /** the owner's wording editor inside the game (26.11): texts become editable, a bar on top walks the screens */
  edit?: boolean;
}
export interface TabletHandle {
  readonly S: GameState;
  go(phase: Phase, extra?: Partial<GameState>): void;
  render(): void;
  destroy(): void;
}
declare global {
  interface Window {
    HK?: { S: GameState; go: (p: Phase, extra?: Partial<GameState>) => void; render: () => void; ACT: Record<string, (...a: never[]) => void>; R: Record<string, () => void> };
  }
}

const ASSET = "/sanity";
const HS = 58; // the size of a hexagon on the board
const PAD = 8;

export function createTabletApp(host: HTMLElement, opts: TabletOptions): TabletHandle {
  const { boot, token } = opts;
  const SHOT = opts.shot;
  const CIRCLE = boot.circle;
  // edit mode: every Hebrew text carries its path (invisible marks) and an edit already made replaces it
  const EDIT_STORE: EditStore = { edits: new Map(), screens: new Map(), note: "" };
  const C0: Content = buildContent(boot.event.gender);
  const C: Content = opts.edit ? markDeep(C0, EDIT_STORE.edits) : C0;
  const { GAME, ZONES, SPECIAL, UI, HOW, TASK_UI, FOG_CARDS, TASKS, gx } = C;
  const SAVE = `hk:game:${boot.event.slug}:${CIRCLE}:v3`;
  let alive = true;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (alive) fn();
    }, ms);
    timeouts.add(t);
    return t;
  };

  // ---------- which game: the server's, the local one, or a new one ----------
  function loadLocal(): GameState | null {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || "null") as GameState | null;
      return s && s.board ? s : null;
    } catch {
      return null;
    }
  }
  function fresh(): GameState {
    return E.newGame(CIRCLE);
  }
  function choose(): GameState {
    const resetAt = boot.resetAt ? new Date(boot.resetAt).getTime() : 0;
    const local = loadLocal();
    const localOk = local && (!resetAt || (local.createdAt ?? 0) >= resetAt) ? local : null;
    const server = boot.state && (!resetAt || (boot.state.createdAt ?? 0) >= resetAt) ? { ...boot.state, version: boot.version } : null;
    if (localOk && server) return (localOk.version ?? 0) >= server.version ? localOk : server;
    return localOk ?? server ?? fresh();
  }
  let S: GameState = choose();
  let restoredHasPhoto = boot.hasPhoto && !S.creations.photo;
  let B = S.board;

  // ---------- saving: localStorage now, the server soon ----------
  const sync = createSync(token, {
    onStale: (state, version, resetAt) => adopt(state, version, resetAt, version - (S.version ?? 0) >= 10 ? "undo" : true),
    onOnline: (on) => {
      const p = $("#syncpill") as HTMLElement | null;
      if (!p) return;
      p.hidden = on;
      p.textContent = UI.sync.offline;
    },
  });
  function payload(): TabletSave {
    return {
      version: S.version,
      state: { ...S, creations: { ...S.creations, photo: null } },
      snapshot: E.snapshot(S, { zoneTarget: S.zone ?? null, total: total(), hasPhoto: !!S.creations.photo || restoredHasPhoto }),
      creations: { standing: S.creations.standing, sentence: S.creations.sentence, quad: S.quad ?? null },
    };
  }
  function persistLocal() {
    try {
      localStorage.setItem(SAVE, JSON.stringify(S));
    } catch {
      /* storage full - the server copy still has it */
    }
  }
  function save() {
    S.version = (S.version ?? 0) + 1;
    persistLocal();
    sync.queue(payload());
  }
  /** The creations changed (a photo was taken, a count typed, the sentence written): save, and send the photo once. */
  function pushCreations(photo?: string | null) {
    S.version = (S.version ?? 0) + 1;
    persistLocal();
    sync.queue(payload(), photo ?? null);
  }
  /** The server's truth replaces ours: another device took over, or the studio reset the event. */
  function adopt(state: GameState | null, version: number, resetAt: string | null, announce: boolean | "undo", hasPhoto = boot.hasPhoto) {
    const resetMs = resetAt ? new Date(resetAt).getTime() : 0;
    const wasReset = !state || (resetMs && (S.createdAt ?? 0) < resetMs);
    S = state ? { ...state, version } : fresh();
    if (!state) S.version = Math.max(0, version);
    restoredHasPhoto = !!state && !S.creations.photo && hasPhoto;
    B = S.board;
    persistLocal();
    buildBoard();
    render();
    if (announce) toast(wasReset ? UI.sync.reset : announce === "undo" ? UI.sync.undo : UI.sync.taken);
  }
  function toast(text: string) {
    const t = $("#toast") as HTMLElement | null;
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    later(() => {
      t.hidden = true;
    }, 4500);
  }
  // every 10s: did the server move on without us (a takeover, a reset, the studio's ״מסך אחורה״)?
  const poll = setInterval(async () => {
    if (!alive || document.hidden || sync.busy()) return;
    const b = await sync.fetchBoot();
    if (!b || !alive || sync.busy()) return;
    const resetMs = b.resetAt ? new Date(b.resetAt).getTime() : 0;
    if (resetMs && (S.createdAt ?? 0) < resetMs) adopt(null, 0, b.resetAt, true);
    else if (b.state && b.version > (S.version ?? 0)) adopt(b.state, b.version, b.resetAt, b.version - (S.version ?? 0) >= 10 ? "undo" : true, b.hasPhoto);
  }, 10_000);

  // ---------- helpers ----------
  const ZB = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, (typeof ZONES)[number]>;
  const IDS = ZONES.map((z) => z.id);
  const isZone = (k: string): k is ZoneId => !!ZB[k as ZoneId];
  const NAME = (k: string) => (ZB[k as ZoneId] || SPECIAL[k as keyof typeof SPECIAL] || { name: "" }).name || "";
  const IN = (k: string) => (ZB[k as ZoneId] ? ZB[k as ZoneId].inName : "ב" + NAME(k));
  const TO = (k: string) => "ל" + NAME(k).replace(/^ה/, ""); // המערה → למערה
  const ICON = (k: string) => `${ASSET}/faces/icon_${k}.png`;
  const TILED = new Set<string>(["cave", "lake", "forest", "observatory", "reef", "safari", "start", "market", "lighthouse", "fog", "goal"]);
  const SCENE_W: Record<ZoneId, number> = { cave: 1280, forest: 1180, observatory: 1280, lake: 1700, reef: 860, safari: 1700 };
  const sceneArt = (z: ZoneId) => `<img class="scene-art${z === "reef" ? " left" : ""}" src="${ASSET}/islands/${z}_scene.png" alt="" style="width:${SCENE_W[z]}px">`;
  const hexPts = (x: number, y: number, s: number) =>
    [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const a = ((60 * i - 30) * Math.PI) / 180;
        return `${(x + Math.cos(a) * s).toFixed(1)},${(y + Math.sin(a) * s).toFixed(1)}`;
      })
      .join(" ");
  const COL: Record<string, string> = { start: "ink", goal: "boat-line", lighthouse: "lighthouse", fog: "fog", market: "market" };
  const colOf = (k: string) => COL[k] || k;
  const deepOf = (k: string) => (isZone(k) ? `var(--${k}-deep)` : k === "goal" ? "var(--ink)" : `var(--${colOf(k)})`);
  // the island's drawing inside the hexagon, in proportion: islands from above, the special faces from the side
  const hexArt = (k: string, s: number, id: string) => {
    const c = colOf(k),
      w = s * 1.52,
      h = s * 1.06;
    return `<clipPath id="${id}"><polygon points="${hexPts(0, 0, s)}"/></clipPath><g clip-path="url(#${id})"><polygon points="${hexPts(0, 0, s)}" fill="var(--${c})" opacity=".13"/><ellipse cy="${(s * 0.24).toFixed(1)}" rx="${(s * 0.78).toFixed(1)}" ry="${(s * 0.14).toFixed(1)}" fill="var(--${c})" opacity=".14"/><image href="${ASSET}/islands/${k}_hex.png" x="${(-w / 2).toFixed(1)}" y="${(-s * 0.8).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/></g>`;
  };
  // the card's back: the logo's blue. On an island: the gold coin and the resource's name. Elsewhere: the logo.
  const hexBack = (k: string, s: number, id: string) =>
    `<radialGradient id="${id}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2E4572"/><stop offset="1" stop-color="#0E1A33"/></radialGradient><polygon points="${hexPts(0, 0, s)}" fill="url(#${id})" stroke="#D9B46A" stroke-width="${(s * 0.03).toFixed(1)}" stroke-linejoin="round"/><polygon points="${hexPts(0, 0, s * 0.88)}" fill="none" stroke="#D9B46A" stroke-width="${(s * 0.012).toFixed(2)}" opacity=".7"/>` +
    (isZone(k)
      ? `<image href="${ASSET}/coins/gold_${k}.png" x="${(-s * 0.42).toFixed(1)}" y="${(-s * 0.62).toFixed(1)}" width="${(s * 0.84).toFixed(1)}" height="${(s * 0.84).toFixed(1)}"/><text y="${(s * 0.5).toFixed(1)}" text-anchor="middle" font-size="${(s * 0.2).toFixed(1)}" font-weight="700" fill="#F3E3B8" font-family="var(--font-sans)">${ZB[k].resource}</text>`
      : `<image href="${ASSET}/logo.png" x="${(-s * 0.62).toFixed(1)}" y="${(-s * 0.62).toFixed(1)}" width="${(s * 1.24).toFixed(1)}" height="${(s * 1.24).toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`);
  const total = () => E.total(S);
  const $ = <T extends Element = HTMLElement>(s: string) => host.querySelector<T>(s);
  const stage = $("#stage")!,
    copy = $("#copy")!,
    extra = $("#extra")!,
    goBtn = $<HTMLButtonElement>("#go")!,
    boardEl = $("#board")!;
  let SCR = 0; // the screen counter: an animation of a previous screen stops when it changes
  const wait = (ms: number) => new Promise<void>((r) => later(r, SHOT ? Math.min(ms, 60) : ms));

  // ---------- the sky of a task moves with the clock: dawn → day → sunset → night with stars ----------
  const SKY_T: [number, string, string][] = [
    [0, "#B9C1DA", "#F2D8C8"],
    [0.16, "#D3E3EF", "#F3EBE4"],
    [0.42, "#D3E3EF", "#EEF2F6"],
    [0.64, "#C7D3E6", "#F1DCC6"],
    [0.78, "#8E88B5", "#E9B79C"],
    [0.9, "#33416E", "#7E6F95"],
    [1, "#15233F", "#1A2C50"],
  ];
  const hx2 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a: string, b: string, u: number) => {
    const A = hx2(a),
      Bc = hx2(b);
    return `rgb(${A.map((v, i) => Math.round(v + (Bc[i] - v) * u)).join(",")})`;
  };
  function skyAt(t: number) {
    t = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < SKY_T.length - 2 && t > SKY_T[i + 1][0]) i++;
    const [t0, a0, b0] = SKY_T[i],
      [t1, a1, b1] = SKY_T[i + 1],
      u = (t - t0) / (t1 - t0);
    $(".sky")!.style.background = `linear-gradient(180deg,${mixc(a0, a1, u)},${mixc(b0, b1, u)})`;
    const k = Math.min(t / 0.86, 1),
      sun = $("#sun")!;
    sun.style.transform = `translate(${1120 - k * 1000}px,${430 - Math.sin(Math.PI * k) * 360}px)`;
    sun.style.opacity = t < 0.86 ? ".95" : "0";
    $("#stars")!.style.opacity = String(Math.max(0, Math.min(1, (t - 0.74) / 0.18)));
  }

  // ---------- the clock ----------
  function remaining(): number | null {
    if (!S.timer) return null;
    return Math.max(0, Math.round((S.timer.end - Date.now()) / 1000));
  }
  function startTimer(min: number) {
    S.timer = { end: Date.now() + min * 60000, total: min * 60 };
  }
  function addTime(min: number) {
    if (S.timer) {
      S.timer.end += min * 60000;
      S.timer.total += min * 60;
    }
    save();
  }
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ---------- graphics ----------
  const SYM: Record<ZoneId, string> = {
    cave: '<path d="M15 4 L26 15 L15 26 L4 15Z"/>',
    lake: '<circle cx="15" cy="15" r="8.5" fill="none" stroke="var(--lake)" stroke-width="4.5"/>',
    forest: '<circle cx="9.5" cy="15" r="6.5"/><circle cx="20.5" cy="15" r="6.5"/>',
    observatory: '<path d="M15 3l3.6 7.6 8.3 1-6.1 5.7 1.6 8.2L15 21.4l-7.4 4.1 1.6-8.2-6.1-5.7 8.3-1z"/>',
    reef: '<path d="M3 7 L15 15 L3 23Z M27 7 L15 15 L27 23Z"/>',
    safari: '<path d="M8 3 H22 V27 L15 21 L8 27Z"/>',
  };
  const coin = (z: ZoneId, s = 36) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="17" fill="var(--${z})" opacity=".6"/><circle cx="20" cy="20" r="17" fill="#fff" stroke="var(--${z})" stroke-width="3"/><g transform="translate(11 11) scale(.6)" fill="var(--${z})">${SYM[z]}</g></svg>`;
  // a metal token in the island's colour - only on the screen where tokens are won
  const metal = (z: ZoneId, s = 64) => `<img src="${ASSET}/coins/coin_${z}.png" width="${s}" height="${s}" alt="" style="display:block;filter:drop-shadow(0 4px 4px #0E1A3355)">`;
  const GCOIN = '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="17" fill="var(--boat-line)" opacity=".7"/><circle cx="20" cy="20" r="17" fill="#fff" stroke="var(--boat-line)" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="var(--boat-line)"/></svg>';
  const CLOCK = '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 16V10M12 2.5h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  const ARROW = '<svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true"><path d="M28 11H4M12 3L3 11l9 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // the forest's key as pictures (the owner, 26.11: ״מקראה ציורית טבלאית ולא מקראה מילולית״): a swatch per colour, a drawn tile per shape
  const SHAPE_SVG: Record<string, string> = {
    square: '<rect x="3" y="3" width="20" height="20" rx="2"/>',
    tri: '<path d="M13 2.5 23.5 23.5H2.5Z"/>',
    rtri: '<path d="M3 3v20.5h20.5Z"/>',
  };
  const legendHTML = (cls = "") => {
    const K = TASKS.forest.key;
    const sw = (c: string) => `<i class="sw" style="background:${c}"></i>`;
    const sh = (s: string) => `<svg class="sw" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="currentColor">${SHAPE_SVG[s] ?? SHAPE_SVG.square}</svg>`;
    return `<div class="legend pic ${cls}"><div class="lrow"><b>${K.color.title}</b>${K.color.items.map((i) => `<span class="lk">${sw(i.c)}${i.label}</span>`).join("")}</div><div class="lrow"><b>${K.shape.title}</b>${K.shape.items.map((i) => `<span class="lk">${sh(i.s)}${i.label}</span>`).join("")}</div></div>`;
  };
  // the reef's graph (the owner, 26.11: ״לא רואים את הגרף הנוצר״): on a white card, in the island's colour, the current count grows live
  const reefGraph = (arr: number[], cur: number, now: number) => {
    const W = 520, H = 140, base = 112, bw = 72, step = 100;
    const bars = [0, 1, 2, 3, 4].map((j) => {
      const x = W - (j + 1) * step + (step - bw) / 2;
      const v = j < cur ? (arr[j] ?? 0) : j === cur ? now : null;
      const h = v == null ? 0 : v > 0 ? Math.max(6, v * 7) : 0;
      const bar =
        v == null
          ? `<rect x="${x}" y="${base - 6}" width="${bw}" height="6" rx="3" fill="currentColor" opacity=".15"/>`
          : `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="8" fill="${j === cur ? "var(--c)" : "var(--cd)"}"${j === cur ? ' stroke="var(--cd)" stroke-width="3" stroke-dasharray="6 5"' : ""}/>`;
      const val = v == null ? "" : `<text x="${x + bw / 2}" y="${base - h - 8}" text-anchor="middle" font-size="22" font-weight="900" fill="currentColor">${v}</text>`;
      return `${bar}${val}<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="18" font-weight="500" fill="currentColor" opacity=".7">${j + 1}</text>`;
    });
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="display:block;color:var(--ink)">${bars.join("")}</svg>`;
  };

  // ---------- the board: the circle's own (one of 60), hexagons ----------
  let BW = 0,
    BH = 0;
  const pos = (i: number): [number, number] => [B.faces[i].c[0] * HS + PAD, B.faces[i].c[1] * HS + PAD + 22];
  const faceIdx = (k: string) => B.faces.findIndex((f) => f.kind === k);
  function hexSVG(f: Face) {
    const k = f.kind,
      [x, y] = pos(f.i),
      s = HS - 3,
      c = colOf(k);
    const long = NAME(k).length > 8;
    return `<g class="hex" data-i="${f.i}" data-k="${k}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" role="button" aria-label="${NAME(k)}"><g class="hi">
    <polygon points="${hexPts(5, 4, s)}" fill="#fff" opacity=".9"/>
    <g class="face"><polygon points="${hexPts(0, 0, s)}" fill="#fff"/>
    ${
      TILED.has(k)
        ? `${hexArt(k, s, "hc-" + f.i)}<polygon points="${hexPts(0, 0, s)}" fill="none" stroke="var(--${k === "start" ? "boat-line" : c})" stroke-width="${k === "start" ? 4 : 3.2}" stroke-linejoin="round"/>
    <rect x="${-s * (long ? 0.66 : 0.5)}" y="${s * 0.45}" width="${s * (long ? 1.32 : 1)}" height="${s * 0.25}" rx="${s * 0.125}" fill="#fff" opacity=".94"/>`
        : `<polygon points="${hexPts(0, 0, s)}" fill="url(#g-${k})" stroke="var(--${k === "start" ? "boat-line" : c})" stroke-width="${k === "start" || k === "goal" ? 4 : 2.8}" stroke-linejoin="round"/>
    <polygon points="${hexPts(0, 0, s * 0.86)}" fill="none" stroke="#fff" stroke-width="1.6"/>
    <image href="${ICON(k)}" x="${-s * 0.52}" y="${-s * 0.64}" width="${s * 1.04}" height="${s * 0.86}" preserveAspectRatio="xMidYMid meet"/>`
    }
    <text y="${s * 0.63}" text-anchor="middle" font-size="${s * (long ? 0.155 : 0.19)}" font-weight="700" fill="${deepOf(k)}" font-family="var(--font-sans)">${NAME(k)}</text></g>
    ${k !== "start" && k !== "goal" ? `<g class="numface">${hexBack(k, s, "nb-" + f.i)}</g>` : ""}
    <g class="water" data-w="${f.i}"><clipPath id="cl-${f.i}"><polygon points="${hexPts(0, 0, s)}"/></clipPath><g clip-path="url(#cl-${f.i})">
      <rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" fill="var(--sea-line)" opacity=".66"/>
      ${[-0.32, 0, 0.32].map((dy) => `<path class="wl" d="M${-s * 1.5} ${s * dy}` + ` q ${s * 0.12} ${-s * 0.1} ${s * 0.24} 0`.repeat(13) + `" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`).join("")}</g></g>
    <polygon class="ring" points="${hexPts(0, 0, s + 7)}"/></g></g>`;
  }
  const KINDS: string[] = [...IDS, "start", "goal", "lighthouse", "fog", "market"];
  function buildBoard() {
    BW = B.w * HS + 2 * PAD;
    BH = B.h * HS + 2 * PAD + 22;
    const defs = KINDS.map((k) => {
      const c = colOf(k);
      return `<linearGradient id="g-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--${c})" stop-opacity="${k === "goal" ? 0.3 : 0.12}"/><stop offset="1" stop-color="var(--${c})" stop-opacity="${k === "goal" ? 0.75 : 0.52}"/></linearGradient>`;
    }).join("");
    boardEl.innerHTML = `<svg viewBox="0 0 ${BW.toFixed(0)} ${BH.toFixed(0)}" width="100%" style="overflow:visible" aria-label="האי שלכם"><defs>${defs}</defs><g id="trail"></g><g id="hexes">${B.faces.map(hexSVG).join("")}</g><g id="boat"><image class="b" href="${ASSET}/scene/boat.png" x="-27" y="-64" width="52" height="67"/></g></svg>`;
  }
  const hex = (i: number) => boardEl.querySelector<SVGGElement>(`.hex[data-i="${i}"]`);
  function placeBoard(mode: "left" | "wide" | "mid" | "hide") {
    const show = mode !== "hide";
    const box = mode === "wide" ? [60, 120, 720, 470] : mode === "mid" ? [270, 110, 740, 470] : [40, 110, 700, 470];
    const w = Math.min(box[2], (box[3] * BW) / BH),
      h = (w * BH) / BW;
    boardEl.style.left = box[0] + (box[2] - w) / 2 + "px";
    boardEl.style.top = box[1] + (box[3] - h) / 2 + "px";
    boardEl.style.width = w + "px";
    boardEl.style.opacity = show ? "1" : "0";
    boardEl.style.pointerEvents = show ? "" : "none";
  }
  function setBoat(i: number, instant = false) {
    const [x, y] = pos(i),
      b = $<SVGGElement>("#boat")!;
    if (instant) b.style.transition = "none";
    b.style.transform = `translate(${x}px,${y - 4}px)`;
    if (instant) {
      b.getBoundingClientRect();
      b.style.transition = "";
    }
  }
  function syncBoard() {
    B.faces.forEach((f) => {
      const h = hex(f.i);
      if (!h) return;
      h.classList.toggle("done", S.visited.includes(f.kind as ZoneId) || S.flipped.includes(f.kind));
      h.querySelector(".water")!.classList.toggle("on", S.flooded.includes(f.i));
      h.classList.remove("can");
      h.style.opacity = "";
    });
    setBoat(S.pos, true);
  }
  function drawTrail(path: number[]) {
    const pts = path.map(pos);
    $("#trail")!.innerHTML = `<polyline class="trail" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
  }

  // ---------- the sky, the sea ----------
  $("#seaHost")!.innerHTML = '<div class="sea sea-img"><div class="wl wl0"></div><div class="wl wl1"></div><div class="wl wl2"></div></div>';
  $("#tide")!.classList.add("img");
  $("#tide")!.innerHTML = "";
  $("#stars")!.innerHTML = Array.from({ length: 46 }, (_, i) => `<i style="left:${(i * 137) % 100}%;top:${(i * 71) % 100}%;animation-delay:-${(i * 0.37) % 2.4}s;transform:scale(${0.6 + (i % 4) * 0.3})"></i>`).join("");
  $("#motes")!.innerHTML = Array.from({ length: 18 }, (_, i) => {
    const s = 8 + ((i * 7) % 22);
    return `<i style="left:${(i * 53) % 100}%;width:${s}px;height:${s}px;animation-duration:${9 + ((i * 3) % 9)}s;animation-delay:-${(i * 1.3) % 9}s"></i>`;
  }).join("");
  const SKIES = [
    ["#EEF2F6", "#D3E3EF"],
    ["#EEF2F6", "#D3E3EF"],
    ["#EDF2F7", "#D0E1EE"],
    ["#EAF0F6", "#CCDEED"],
    ["#F2EFEC", "#D3DFEB"],
    ["#F3EAE3", "#D2DAE8"],
    ["#15233F", "#0E1A33"],
  ];
  function sky(i: number) {
    const [a, b] = SKIES[Math.min(i, 6)];
    const s = $(".sky")!;
    s.style.background = `linear-gradient(172deg,${a},${b})`;
    const sun = $("#sun")!,
      t = Math.min(i, 6) / 6;
    sun.style.transform = `translate(${1060 - t * 980}px,${200 - Math.sin(Math.PI * Math.min(t + 0.15, 1)) * 150 + (t > 0.85 ? 260 : 0)}px)`;
    sun.style.opacity = i >= 6 ? "0" : ".9";
    $("#stars")!.style.opacity = i >= 6 ? "1" : "0";
    stage.classList.toggle("night", i >= 6);
  }

  // ---------- birds: now and then a small flock crosses the sky, right to left ----------
  function birds() {
    if (SHOT || !alive) return;
    const n = 1 + Math.floor(Math.random() * 3),
      y0 = 95 + Math.random() * 110,
      sc = 0.32 + Math.random() * 0.22,
      dur = 15 + Math.random() * 8;
    for (let i = 0; i < n; i++) {
      const f = document.createElement("div");
      f.className = "flyer";
      const k = sc * (1 - i * 0.12);
      f.innerHTML = `<div class="bird" style="transform:scale(${k.toFixed(2)});animation-delay:-${(Math.random() * 0.9).toFixed(2)}s"></div>`;
      f.style.left = 1320 + i * 70 + "px";
      f.style.top = y0 + i * 28 - (i % 2) * 40 + "px";
      f.style.transitionDuration = dur + "s";
      stage.appendChild(f);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          f.style.transform = `translate(${-1700 - i * 70}px, ${-30 + Math.random() * 60}px)`;
        }),
      );
      later(() => f.remove(), dur * 1000 + 500);
    }
    later(birds, 18000 + Math.random() * 22000);
  }
  later(birds, 4000);
  const ROCKS = {
    row: `<img class="rock" src="${ASSET}/scene/stone_3.png" alt="" style="right:-60px;bottom:118px;width:700px">`,
    ready: `<img class="rock" src="${ASSET}/scene/stone_1.png" alt="" style="left:50px;bottom:112px;width:230px"><img class="rock" src="${ASSET}/scene/stone_2.png" alt="" style="right:110px;bottom:118px;width:150px"><img class="rock" src="${ASSET}/scene/stone_0.png" alt="" style="right:230px;bottom:118px;width:210px">`,
  };

  // ---------- the top bar and the bag ----------
  // the owner (26.11): ״התרמיל לא ברור שהוא תרמיל״ - a backpack with its name opens the row of coins
  const BAGICON = '<svg width="24" height="26" viewBox="0 0 30 32" aria-hidden="true"><path d="M10 7V5.5a5 5 0 0 1 10 0V7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><rect x="3.5" y="7" width="23" height="23.5" rx="6.5" fill="currentColor"/><path d="M3.5 15h23" stroke="#fff" stroke-width="2.2" opacity=".55"/><rect x="8.5" y="18.5" width="13" height="8" rx="3" fill="#fff" opacity=".92"/></svg>';
  const bagHTML = () => `<span class="bag" id="bag" aria-label="התרמיל: ${total()} אסימונים"><span class="bagtag">${BAGICON}<small>${UI.bag}</small></span>${IDS.map((z) => `<span class="r" data-r="${z}" style="--rc:var(--${z}-deep)">${coin(z, 34)}<b class="num">${S.tokens[z]}</b></span>`).join("")}<span class="tot num">${total()}</span></span>`;
  const fsHtml = () => (!SHOT && canFs() ? `<button type="button" class="fsbtn${document.fullscreenElement ? "" : " blink"}" title="${fsTitle()}" aria-label="מסך מלא">${fsLabel()}</button>` : "");
  function bar(z?: ZoneId | null) {
    const st = Math.min(S.stage, 6);
    const who = z
      ? `<span class="who"><svg width="54" height="62" viewBox="-31 -35 62 70" aria-hidden="true" style="overflow:visible">${hexArt(z, 31, "bh-" + z)}<polygon points="${hexPts(0, 0, 31)}" fill="none" stroke="var(--${z})" stroke-width="2.5" stroke-linejoin="round"/></svg>${NAME(z)}</span>`
      : `<span class="who"><img src="${ASSET}/logo.png" alt="" style="height:58px">${st ? `<small>שלב ${st} מתוך 6</small>` : ""}</span>`;
    // the circle's number on every screen (the owner, 26.11: ״לראות לאורך כל המשחק איזה מעגל אנחנו״)
    $("#bar")!.innerHTML = who + `<span style="display:flex;align-items:center;gap:16px"><span class="circ">${fill(UI.barCircle, { circle: CIRCLE })}</span>${st ? `<span class="dots" aria-label="שלב ${st} מתוך 6">${[1, 2, 3, 4, 5, 6].map((i) => `<i class="${i <= S.visited.length ? "on" : ""}"></i>`).join("")}</span>` : ""}${bagHTML()}${fsHtml()}</span>`;
  }
  function stageXY(el: Element): [number, number] {
    const r = el.getBoundingClientRect(),
      s = stage.getBoundingClientRect(),
      k = s.width / 1280;
    return [(r.left + r.width / 2 - s.left) / k, (r.top + r.height / 2 - s.top) / k];
  }
  async function flyTokens(z: ZoneId, n: number, from: [number, number] = [640, 420]) {
    // the data is already updated; this is only the animation: the bag's counter rises with every coin
    const end = S.tokens[z];
    const startV = end - n;
    const b = host.querySelector(`.bag .r[data-r="${z}"] b`);
    if (b) b.textContent = String(startV);
    const tot = $(".bag .tot");
    const t0 = total() - n;
    if (tot) tot.textContent = String(t0);
    for (let i = 0; i < n; i++) {
      const target = host.querySelector(`.bag .r[data-r="${z}"]`);
      const [tx, ty] = target ? stageXY(target) : [1100, 40];
      const c = document.createElement("div");
      c.className = "fly";
      c.innerHTML = metal(z, 64);
      c.style.left = from[0] - 29 + i * 26 + "px";
      c.style.top = from[1] - 29 + "px";
      stage.appendChild(c);
      await wait(80);
      c.style.transform = `translate(${tx - (from[0] + i * 26)}px,${ty - from[1]}px) scale(.55) rotate(${200 + i * 40}deg)`;
      later(
        () => {
          c.style.opacity = "0";
          const bb = host.querySelector(`.bag .r[data-r="${z}"] b`);
          if (bb) bb.textContent = String(startV + i + 1);
          const tt = $(".bag .tot");
          if (tt) tt.textContent = String(t0 + i + 1);
          const r = host.querySelector(`.bag .r[data-r="${z}"]`);
          if (r) {
            r.classList.remove("pop");
            void (r as HTMLElement).offsetWidth;
            r.classList.add("pop");
          }
          later(() => c.remove(), 300);
        },
        SHOT ? 0 : 900,
      );
      await wait(260);
    }
  }
  function payToken(): ZoneId | null {
    const z = IDS.slice().sort((a, b) => S.tokens[b] - S.tokens[a])[0];
    if (S.tokens[z] < 1) return null;
    S.tokens[z]--;
    return z;
  }

  // ---------- the frame of a screen ----------
  // Chrome 81 on the conference's tablets (25.11) has no color-mix(): the tints tablet.css mixes from --c / --cd are
  // computed here as well (--c10 ... --c40, --cd70) and the stylesheet names them as fallbacks before each color-mix.
  const cssColor = (name: string) => getComputedStyle(host).getPropertyValue(name).trim();
  const mixHex = (a: string, pct: number, b: string) => {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    if (!hex.test(a) || !hex.test(b)) return b;
    const p = (h: string) => {
      h = h.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    const A = p(a), B = p(b);
    return "#" + A.map((v, i) => Math.round(v * pct + B[i] * (1 - pct)).toString(16).padStart(2, "0")).join("");
  };
  function zoneMode(z: ZoneId | null) {
    stage.classList.toggle("zone", !!z);
    stage.style.setProperty("--c", z ? `var(--${z})` : "var(--ink)");
    stage.style.setProperty("--cd", z ? `var(--${z}-deep)` : "var(--ink)");
    const c = cssColor(z ? `--${z}` : "--ink"), cd = cssColor(z ? `--${z}-deep` : "--ink");
    for (const pct of [10, 12, 15, 26, 35, 40]) stage.style.setProperty(`--c${pct}`, mixHex(c, pct / 100, "#fff"));
    stage.style.setProperty("--cd70", mixHex(cd, 0.7, "#000"));
  }
  function clear() {
    SCR++;
    extra.innerHTML = "";
    copy.innerHTML = "";
    copy.style.cssText = "";
    goBtn.hidden = true;
    goBtn.classList.remove("pulse");
    goBtn.onclick = null;
    boardEl.querySelectorAll<SVGGElement>(".hex").forEach((h) => {
      h.classList.remove("can");
      h.querySelector(".hi")!.classList.remove("drop");
      h.onclick = null;
      h.onkeydown = null;
      h.removeAttribute("tabindex");
    });
    $("#fog")!.classList.remove("on");
    stage.classList.remove("nosea", "scene", "deck", "gatebg");
    $("#trail")!.innerHTML = "";
  }
  function button(label: string, act: () => void, { pulse = false } = {}) {
    goBtn.innerHTML = ARROW + label;
    goBtn.hidden = false;
    goBtn.classList.toggle("pulse", pulse);
    goBtn.onclick = () => {
      goBtn.onclick = null;
      act();
    };
  }
  function onPick(sel: string, fn: (i: number, e: HTMLElement) => void) {
    const inCopy = copy.querySelectorAll<HTMLElement>(sel);
    (inCopy.length ? inCopy : extra.querySelectorAll<HTMLElement>(sel)).forEach((e, i) => (e.onclick = () => fn(i, e)));
  }
  // on an island the confetti is in the island's hues only; at the end, in every colour
  function confetti(n = 90, z: ZoneId | null = null) {
    const box = $("#confetti")!;
    const cols = z
      ? [`var(--${z})`, `var(--${z}-deep)`, `color-mix(in srgb,var(--${z}) 60%,#fff)`, `color-mix(in srgb,var(--${z}) 30%,#fff)`, `color-mix(in srgb,var(--${z}-deep) 70%,#0E1A33)`, "#fff"]
      : ["var(--cave)", "var(--lake)", "var(--forest)", "var(--observatory)", "var(--reef)", "var(--safari)", "#D9B46A", "#F5EEE0"];
    box.innerHTML = Array.from({ length: n }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() * 300 - 150).toFixed(0)}px;--rt:${(Math.random() * 900).toFixed(0)}deg;animation-duration:${2.2 + Math.random() * 1.8}s;animation-delay:${Math.random() * 0.7}s"></i>`).join("");
    later(() => (box.innerHTML = ""), 4800);
  }
  function burst(x: number, y: number, s = 80) {
    const b = document.createElement("div");
    b.className = "burst";
    b.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
    stage.appendChild(b);
    later(() => b.remove(), 1000);
  }
  // ---------- moving between screens ----------
  function go(phase: Phase, extraState: Partial<GameState> = {}) {
    Object.assign(S, extraState);
    S.phase = phase;
    save();
    render();
  }
  function render() {
    if (!alive) return;
    const ph: Phase = S.phase in R ? S.phase : "welcome";
    clear();
    syncBoard();
    sky(S.phase === "finale" || S.phase === "finale2" || S.phase === "invite" ? 6 : Math.min(S.stage, 5));
    R[ph]();
    if (opts.edit) editor?.afterRender();
  }

  // ================================================================
  //  the opening: 3 screens
  // ================================================================
  const R: Record<Phase, () => void> = {
    welcome() {
      const T = UI.welcome;
      zoneMode(null);
      bar();
      placeBoard("left");
      boardEl.querySelectorAll<SVGGElement>(".hex").forEach((h) => (h.style.opacity = ".22"));
      [B.start, B.goal].forEach((i) => (hex(i)!.style.opacity = "1"));
      copy.style.cssText = "right:60px;top:120px;width:470px";
      copy.innerHTML = `<p class="kick in">${fill(T.kick, { circle: CIRCLE })}</p><h1 class="xl in d1">${T.title}</h1>
    <p class="lead in d2">${T.lead}</p>
    <div class="goalbox in d4"><svg width="58" height="58" viewBox="-60 -60 120 120" aria-hidden="true"><polygon points="${hexPts(0, 0, 54)}" fill="#FFF5D6" stroke="var(--boat-line)" stroke-width="5"/><path d="M0 -30l9 18 20 2.5-15 13.5 4 20L0 14l-18 10 4-20-15-13.5 20-2.5z" fill="var(--boat-fill)" stroke="var(--boat-line)" stroke-width="3.5" stroke-linejoin="round"/></svg>
    <div><b>${T.goalTitle}</b><span><br>${T.goal}</span></div></div>`;
      const my = SCR;
      (async () => {
        await wait(1000);
        for (const z of IDS) {
          if (my !== SCR) return;
          const i = faceIdx(z);
          hex(i)!.style.opacity = "1";
          hex(i)!.querySelector(".hi")!.classList.add("drop");
          await wait(220);
        }
        const tour = [...IDS.map(faceIdx), B.goal];
        while (my === SCR && !SHOT && alive) {
          setBoat(B.start, true);
          await wait(600);
          for (const i of tour) {
            if (my !== SCR) return;
            setBoat(i);
            await wait(850);
          }
          await wait(1600);
        }
      })();
      extra.insertAdjacentHTML("beforeend", ROCKS.row);
      button(T.cta, () => go("setup"), { pulse: true });
    },
    setup() {
      const T = UI.setup;
      zoneMode(null);
      bar();
      placeBoard("left");
      copy.style.cssText = "right:60px;top:120px;width:420px";
      copy.innerHTML = `<h1 class="in">${T.title}</h1><p class="lead in d1">${T.lead}</p><p class="small in d2">${T.small}</p>`;
      const my = SCR;
      boardEl.querySelectorAll<SVGGElement>(".hex").forEach((h) => (h.style.opacity = "0"));
      (async () => {
        const order = B.faces.map((f) => f.i).sort((a, b) => pos(a)[0] - pos(b)[0]);
        for (const i of order) {
          if (my !== SCR) return;
          const h = hex(i)!;
          h.style.opacity = "1";
          const hi = h.querySelector(".hi")!;
          hi.classList.remove("drop");
          void hi.getBoundingClientRect();
          hi.classList.add("drop");
          await wait(240);
        }
      })();
      extra.insertAdjacentHTML("beforeend", ROCKS.row);
      button(T.cta, () => go("ready"));
    },
    ready() {
      const T = UI.ready;
      zoneMode(null);
      bar();
      placeBoard("hide");
      copy.style.cssText = "left:0;right:0;top:150px;text-align:center";
      copy.innerHTML = `<p class="kick in">${T.kick}</p><h1 class="xl in d1">${T.title}</h1><p class="lead in d2">${T.lead}</p>`;
      extra.innerHTML = `<img class="anim in d3 bob2" src="${ASSET}/scene/boat.png" alt="" style="left:572px;top:420px;width:136px">`;
      extra.insertAdjacentHTML("afterbegin", ROCKS.ready);
      [...host.querySelectorAll(".bag .r")].forEach((r, i) => later(() => r.classList.add("pop"), 700 + i * 120));
      button(T.cta, () => nextStage(), { pulse: true });
    },

    // ================================================================
    //  a stage: tide → sailing → helper faces on the way → island
    // ================================================================
    tide() {
      const T = UI.tide;
      zoneMode(null);
      bar();
      placeBoard("left");
      const i = S.tideNow?.hit[0] ?? S.flooded[S.flooded.length - 1];
      const k = B.faces[i].kind;
      const w = hex(i)!.querySelector(".water")!;
      w.classList.remove("on");
      const first = !S.seenTide;
      S.seenTide = true;
      save();
      const my = SCR;
      (async () => {
        await wait(500);
        const t = $("#tide")!;
        t.classList.add("up");
        await wait(1500);
        if (my !== SCR) return;
        w.classList.add("on");
        t.classList.remove("up");
        await wait(600);
        if (my !== SCR) return;
        copy.style.cssText = "right:56px;top:116px;width:470px";
        copy.innerHTML = `<p class="kick in" style="color:var(--sea-line);font-weight:900">${fill(T.kick, { n: S.stage })}</p><h1 class="in d1">${T.title}</h1>
      <p class="lead in d2">${fill(T.line, { zone: NAME(k) })}</p>
      ${first ? `<div class="card in d4" style="position:relative;margin-top:22px;padding:18px 22px;box-shadow:0 0 0 2px var(--sea-line),7px 6px 0 var(--sea-line)"><p style="margin:0;font-size:21px">${fill(T.first, { in: IN(k) })}</p></div>` : `<p class="small in d3">${T.later}</p>`}`;
        button(T.cta, () => go("sail"));
      })();
    },
    sail() {
      const T = UI.sail;
      zoneMode(null);
      bar();
      placeBoard("left");
      if (S.wind && !S.effects.includes("wind")) S.effects.push("wind");
      const r = E.reachable(S);
      const t = r.targets,
        far = r.blockedRoute;
      copy.style.cssText = "right:56px;top:116px;width:470px";
      copy.innerHTML = `<p class="kick in">${fill(T.kick, { n: S.stage })}</p><h1 class="in d1">${T.title}</h1>
    <p class="lead in d2">${far ? T.far : S.wind ? T.leadWind : T.lead}</p>
    ${S.stage === 1 ? `<p class="small in d3">${T.first}</p>` : ""}
    ${S.flooded.some((i) => t.includes(i)) ? `<p class="small in d3">${T.flooded}</p>` : ""}
    ${S.wind ? `<p class="small in d3">${T.wind}</p>` : ""}`;
      t.forEach((i) => {
        const h = hex(i)!;
        h.classList.add("can");
        h.setAttribute("tabindex", "0");
        h.onclick = () => ACT.pick(i, far);
        h.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") ACT.pick(i, far);
        };
      });
    },
    sailing() {
      // the boat sails its route; at every helper face on the way it stops
      const T = UI.sail;
      zoneMode(null);
      bar();
      placeBoard("left");
      const sl = S.sail;
      if (!sl) {
        go("sail");
        return;
      }
      const target = sl.path[sl.path.length - 1];
      copy.style.cssText = "right:56px;top:116px;width:470px";
      copy.innerHTML = `<p class="kick in">${T.toKick}</p><h1 class="in d1">${fill(T.toTitle, { to: TO(B.faces[target].kind) })}</h1>`;
      drawTrail([S.pos, ...sl.path.slice(sl.at)]);
      const my = SCR;
      (async () => {
        await wait(300);
        while (sl.at < sl.path.length) {
          if (my !== SCR) return;
          const i = sl.path[sl.at];
          setBoat(i);
          await wait(1150);
          if (my !== SCR) return;
          S.pos = i;
          sl.at++;
          save();
          const k = B.faces[i].kind;
          if (i === target) break;
          if (k === "fog") {
            go("fog");
            return;
          }
          if (k === "lighthouse") {
            go("lighthouse");
            return;
          }
          if (k === "market" && !S.usedHelpers.includes("market")) {
            go("market");
            return;
          }
        }
        S.sail = null;
        arrive(target);
      })();
    },

    // ---------- the helper faces ----------
    fog() {
      const T = UI.fog;
      zoneMode(null);
      bar();
      placeBoard("left");
      $("#fog")!.classList.add("on");
      if (!S.fogRule) {
        const id = S.fogDeck[S.visited.length % S.fogDeck.length];
        S.fogRule = id;
        S.pendingRule = id;
        if (!S.usedHelpers.includes("fog")) S.usedHelpers.push("fog");
        save();
      }
      const r = FOG_CARDS.find((c) => c.id === S.fogRule)!;
      const my = SCR;
      (async () => {
        await wait(1300);
        if (my !== SCR) return;
        extra.innerHTML = `<div class="card in" style="right:60px;top:120px;width:540px"><p style="margin:0 0 6px;font-size:20px;font-weight:700;color:var(--fog)">${T.kick}</p><h2>${T.title}</h2>
      <p>${T.line}</p><p style="font-size:30px;font-weight:900;color:var(--ink);margin-top:14px">${r.title}</p><p style="margin-top:4px">${r.text}</p>
      <p style="margin-top:16px;padding-top:14px;border-top:2px dashed #1D5EB333">${T.bonus}</p></div>`;
        button(T.cta, () => continueSail());
      })();
    },
    lighthouse() {
      const T = UI.lighthouse;
      zoneMode(null);
      bar();
      placeBoard("left");
      const fl = S.flooded.filter((i) => !S.visited.includes(B.faces[i].kind as ZoneId));
      const can = total() > 0;
      const opt = (cost: number, title: string, sub: string, dis = false) => `<button class="opt" type="button" ${dis || !can ? "disabled" : ""}><span class="cost" aria-label="${cost === 1 ? "אסימון אחד" : cost + " אסימונים"}">${GCOIN}</span><span class="gain"><b>${title}</b><small>${sub}</small></span></button>`;
      extra.innerHTML = `<div class="card in" style="right:40px;top:104px;width:540px;padding:22px 26px"><div style="display:flex;align-items:center;gap:14px"><img src="${ICON("lighthouse")}" alt="" style="height:64px"><div><p style="margin:0;font-size:20px;font-weight:700;color:var(--lighthouse)">${T.kick}</p><h2>${T.title}</h2></div></div>
    <p>${T.line}</p>
    <div class="opts">
      ${opt(1, T.time, T.timeSub)}
      ${opt(1, T.dry, fl.length ? fill(T.drySub, { zone: NAME(B.faces[fl[0]].kind) }) : T.dryNone, !fl.length)}
      ${opt(1, T.wind, T.windSub)}
      <button class="opt" type="button" style="justify-content:center;font-weight:700">${T.skip}</button></div></div>`;
      onPick(".opt", (i) => ACT.lighthouse(i));
    },
    lhDone() {
      const T = UI.lighthouse;
      zoneMode(null);
      bar();
      placeBoard("left");
      const line = [T.doneTime, fill(T.doneDry, { zone: NAME(S.lhDried || "cave") }), T.doneWind][S.lhChoice ?? 0];
      extra.innerHTML = `<div class="card in" style="right:40px;top:104px;width:540px;padding:22px 26px"><div style="display:flex;align-items:center;gap:14px"><img src="${ICON("lighthouse")}" alt="" style="height:64px"><h2>${T.doneTitle}</h2></div><p>${line}</p><p class="small" style="font-size:19px">${T.after}</p></div>`;
      button(T.cta, () => continueSail());
    },
    market() {
      const T = UI.market;
      zoneMode(null);
      bar();
      placeBoard("left");
      extra.innerHTML = `<div class="card in" style="right:40px;top:104px;width:540px;padding:22px 26px"><div style="display:flex;align-items:center;gap:14px"><img src="${ICON("market")}" alt="" style="height:60px"><div><p style="margin:0;font-size:20px;font-weight:700;color:var(--market)">${T.kick}</p><h2>${T.title}</h2></div></div>
    <p>${T.why}</p><p>${T.how}</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px">${IDS.map((z) => `<button class="opt mk" type="button" style="min-height:58px;padding:6px 14px;font-size:20px" ${S.tokens[z] >= 2 ? "" : "disabled"}>${coin(z, 30)}<span>2 ${fill(UI.gate.tokensOf, { resource: ZB[z].resource })}</span></button>`).join("")}
    <button class="opt mk" type="button" style="min-height:58px;font-weight:700;font-size:20px">${T.skip}</button></div></div>`;
      onPick(".mk", (i) => ACT.market(i));
    },

    // ---------- flipping the card ----------
    flip() {
      const k = S.flipKind || S.zone || "cave";
      const T = UI.flip;
      zoneMode(null);
      bar();
      placeBoard("hide");
      const c = colOf(k);
      copy.style.cssText = "right:60px;top:170px;width:480px";
      copy.innerHTML = `<p class="kick in">${fill(T.kick, { name: NAME(k) })}</p><h1 class="md in d1">${T.title}</h1><p class="lead in d2">${fill(T.lead, { name: NAME(k) })}</p>`;
      extra.innerHTML = `<div class="flip3d" id="f3" style="left:180px;top:200px"><div class="in3">
    <svg viewBox="-130 -130 260 260" aria-hidden="true"><polygon points="${hexPts(8, 7, 118)}" fill="#0E1A33" opacity=".2"/><polygon points="${hexPts(0, 0, 118)}" fill="#fff"/>${TILED.has(k) ? `${hexArt(k, 118, "ff-" + k)}<polygon points="${hexPts(0, 0, 118)}" fill="none" stroke="var(--${c})" stroke-width="5"/><rect x="-62" y="62" width="124" height="38" rx="19" fill="#fff" opacity=".94"/>` : `<polygon points="${hexPts(0, 0, 118)}" fill="url(#g-${k})" stroke="var(--${c})" stroke-width="5"/><image href="${ICON(k)}" x="-80" y="-80" width="160" height="140"/>`}<text y="88" text-anchor="middle" font-size="${NAME(k).length > 8 ? 20 : 26}"${NAME(k).length > 8 ? ' textLength="116" lengthAdjust="spacingAndGlyphs"' : ""} font-weight="700" fill="${deepOf(k)}" font-family="var(--font-sans)">${NAME(k)}</text></svg>
    <svg class="back" viewBox="-130 -130 260 260" aria-hidden="true"><polygon points="${hexPts(8, 7, 118)}" fill="#0E1A33" opacity=".2"/>${hexBack(k, 118, "fb-" + k)}</svg></div></div>
    <svg class="hand" id="hand" style="left:330px;top:400px" width="90" height="90" viewBox="0 0 60 60" aria-hidden="true"><path d="M22 52 C14 46 10 38 12 30 L14 22 C15 19 19 19 20 22 L21 28 L21 10 C21 6 26 6 26 10 L26 26 L27 8 C27 4 32 4 32 8 L32 26 L33 11 C33 7 38 7 38 11 L38 28 L40 18 C41 14 46 15 45 19 L43 36 C42 46 38 52 32 54Z" fill="#fff" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
      const my = SCR;
      (async () => {
        await wait(900);
        if (my !== SCR) return;
        const f3 = $("#f3")!,
          h = $("#hand")!;
        h.style.transform = "translate(-120px,-120px) rotate(-20deg)";
        await wait(500);
        f3.classList.add("go3");
        h.style.transform = "translate(40px,-60px) rotate(15deg)";
        await wait(1300);
        if (my !== SCR) return;
        burst(300, 320, 160);
      })();
      button(T.cta, () => ACT.flipped(k));
    },

    // ================================================================
    //  an island: gate → how to play → task → result → flip
    // ================================================================
    gate() {
      const z = S.zone!,
        T = UI.gate,
        Z = ZB[z];
      zoneMode(z);
      bar(z);
      placeBoard("hide");
      const fl = S.flooded.includes(S.pos);
      const rule = S.pendingRule && FOG_CARDS.find((c) => c.id === S.pendingRule);
      // the island's opening on the whole screen: a bright sky in the island's hue, the drawing across the bottom
      stage.classList.add("scene");
      extra.innerHTML = sceneArt(z);
      copy.style.cssText = "right:64px;top:104px;width:820px";
      copy.innerHTML = `<p class="kick in" style="font-size:24px">${T.kick}</p><h1 class="xl in d1" style="font-size:92px;white-space:nowrap">${Z.name}</h1>
    <p class="lead in d2" style="font-weight:700;font-size:26px;line-height:1.3">${T.brief[z]}</p>
    <div class="chips in d3"><span class="chip">${coin(z, 34)}<b class="num">${fl ? 2 : 4}</b>${fill(T.tokensOf, { resource: Z.resource })}</span><span class="chip">${CLOCK}<b class="num">${rule && rule.id === "doubleClock" ? 5 : GAME.minutesPerZone}</b>${T.minutes}</span>${rule ? `<span class="chip" style="color:var(--fog)">${T.fogChip} <b style="font-size:20px">${rule.title}</b></span>` : ""}</div>
    ${
      fl || S.dry
        ? `<div class="card in d4" id="drycard" style="position:relative;margin-top:20px;padding:18px 22px">${
            S.dry === "wet"
              ? `<p style="margin:0;font-size:22px">${T.wet}</p>`
              : S.dry === "dry"
                ? `<p style="margin:0;font-size:22px">${T.dried}</p>`
                : `<p style="margin:0;font-size:22px">${fill(T.flooded, { name: Z.name })}</p>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="opt dr" type="button" style="min-height:56px;font-size:21px;font-weight:700" ${total() > 0 ? "" : "disabled"}>${T.dryYes}</button><button class="opt dr" type="button" style="min-height:56px;font-size:21px">${T.dryNo}</button></div>`
          }</div>`
        : ""
    }`;
      if (fl && !S.dry) onPick(".dr", (i) => ACT.dry(i));
      else button(T.cta, () => go("howto"));
    },
    howto() {
      const z = S.zone!,
        H = HOW[z];
      zoneMode(z);
      bar(z);
      placeBoard("hide");
      copy.style.cssText = "right:56px;top:108px;width:560px";
      copy.innerHTML = `<h1 class="md in">${UI.howto.title}</h1>${H.intro ? `<p class="small in d1" style="font-size:20px;opacity:1;background:#ffffff26;border-radius:14px;padding:12px 16px">${H.intro}</p>` : ""}
    <ol class="howto">${H.steps.map((s, i) => `<li data-s="${i}"><span>${i + 1}</span><div>${s}</div></li>`).join("")}</ol>${z === "forest" ? legendHTML("in d4") : H.note ? `<p class="small in d4" style="opacity:.92">${H.note}</p>` : ""}`;
      const my = SCR;
      const lis = [...copy.querySelectorAll(".howto li")];
      const step = (i: number) => lis.forEach((l, j) => l.classList.toggle("on", j <= i));
      if (SHOT) step(9);
      else ANIM[z](my, step).catch(() => {});
      button(UI.howto.cta, () => ACT.startTask());
    },

    // ---------- the task: a clock and the input ----------
    task() {
      const z = S.zone!;
      zoneMode(z);
      bar(z);
      placeBoard("hide");
      // the task happens on the island: the sky moves with the time, the top of the island's drawing peeks from the bottom
      stage.classList.add("deck");
      extra.innerHTML = sceneArt(z).replace("scene-art", "scene-art peek");
      copy.style.cssText = "right:48px;top:112px;width:800px;text-align:right";
      clockUI();
      if (z === "cave") {
        const TU = TASK_UI.cave;
        copy.innerHTML = `<p class="kick in">${TU.kick}</p><h1 class="md in d1">${TU.title}</h1><p class="lead in d2">${TU.lead}</p><div class="in d3" style="margin-top:34px;display:flex;align-items:center;gap:20px">${stepper("ans", S.input ?? 60, 120, false, 5)}<span style="font-size:28px;font-weight:500">${TU.unit}</span></div>`;
        wireSteppers((_id, v) => {
          S.input = v;
          save();
        });
        button(TU.cta, () => ACT.caveDone());
      } else if (z === "lake") {
        const TU = TASK_UI.lake;
        copy.innerHTML = `<p class="kick in">${TU.kick}</p><h1 class="md in d1">${TU.title}</h1><p class="lead in d2">${TU.lead}</p><div class="in d3" style="margin-top:34px">${stepper("ans", S.input ?? 0, 8)}</div>`;
        wireSteppers((_id, v) => {
          S.input = v;
          save();
        });
        button(TU.cta, () => ACT.lakeDone());
      } else if (z === "forest") {
        const TU = TASK_UI.forest;
        const i = S.forestStep || 0;
        const st = TASKS.forest.statements;
        if (i < 3) {
          copy.innerHTML = `<p class="kick in">${fill(TU.kick, { i: i + 1 })}</p><p class="in d1" style="font-size:46px;font-weight:900;line-height:1.15;margin:0">״${st[i]}״</p>${legendHTML("in d2")}`;
          button(i < 2 ? TU.next : TU.last, () => go("task", { forestStep: i + 1 }));
        } else {
          const ph = S.creations.photo || (restoredHasPhoto ? photoPath(boot.event.slug, CIRCLE) : null);
          copy.innerHTML = `<h1 class="md in">${TU.photoTitle}</h1><p class="lead in d1">${TU.photoLead}</p>
        <label class="in d2" id="cam" style="margin-top:28px;width:420px;height:240px;border-radius:20px;background:${ph ? `#fff url(${ph}) center/cover` : "#0E1A33"};display:grid;place-items:center;color:#fff;font-size:22px;position:relative;overflow:hidden;cursor:pointer">${ph ? `<span style="position:absolute;bottom:10px;inset-inline-start:12px;background:#fff;color:var(--ink);font-weight:900;border-radius:999px;padding:4px 12px;font-size:18px">${TU.saved}</span>` : `<span>${CLOCK.replace("30", "0")}${TU.camera}</span>`}<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        ${ph ? `<button class="opt in d3" type="button" id="retake" style="margin-top:14px;min-height:52px;font-size:20px;width:max-content">${TU.retake}</button>` : ""}`;
          const inp = copy.querySelector<HTMLInputElement>("[data-photo]")!;
          inp.addEventListener("change", async () => {
            if (inp.files && inp.files[0]) {
              const photo = await compressPhoto(inp.files[0]);
              S.creations.photo = photo;
              restoredHasPhoto = false;
              pushCreations(photo);
              render();
              enterFs();
            }
          });
          const rt = $("#retake");
          if (rt)
            rt.onclick = (e) => {
              e.preventDefault();
              inp.click();
            };
          if (ph) button(TU.use, () => ACT.forestDone());
          else button(TU.shoot, () => inp.click());
        }
      } else if (z === "observatory") {
        const TU = TASK_UI.observatory;
        const q = S.obs || [2, 2, 2, 2];
        const sum = () => q.reduce((a, b) => a + b, 0);
        copy.innerHTML = `<p class="kick in">${TU.kick}</p><h1 class="md in d1">${TU.title}</h1>
      <div class="in d2" style="margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:16px 26px;width:620px">${TU.q.map((t, i) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#ffffff26;border-radius:16px;padding:10px 14px"><b style="font-size:24px">${t}</b>${stepper("q" + i, q[i], 8, true)}</div>`).join("")}</div><p class="lead in d3" id="sum" style="font-weight:700">${fill(TU.sum, { n: sum() })}</p>`;
        // the owner (25.11): ״שולחים״ with fewer than 8 cards counted gave ״כל הכבוד״ and one token, and read like a bug.
        // Now the first tap asks (״רק N מתוך 8. לשלוח בכל זאת?״) and only the second one sends; a change of the count resets that.
        const cta = () => {
          if (sum() === 8 || S.obsConfirm) button(TU.cta, () => ACT.obsDone());
          else
            button(fill(TU.notAll, { n: sum() }), () => {
              S.obsConfirm = true;
              save();
              cta();
            });
        };
        wireSteppers((id, v) => {
          q[+id.slice(1)] = v;
          S.obs = q;
          S.obsConfirm = false;
          save();
          $("#sum")!.textContent = fill(TU.sum, { n: sum() });
          cta();
        });
        cta();
      } else if (z === "reef") {
        const TU = TASK_UI.reef;
        const i = S.reefIdx || 0;
        const st = TASKS.reef.statements;
        const arr = S.creations.standing;
        copy.innerHTML = `<p class="kick in">${fill(TU.kick, { i: i + 1 })}</p><p class="in d1" style="font-size:44px;font-weight:900;line-height:1.15;margin:0">״${st[i]}״</p>
      <div class="in d2" style="display:flex;align-items:center;gap:20px;margin-top:30px"><span style="font-size:28px;font-weight:500">${TU.count}</span>${stepper("ans", S.input ?? 0, 12)}</div>
      <div class="legend reefg in d3"><div class="gt">${TU.graph}</div><div id="rgraph">${reefGraph(arr, i, S.input ?? 0)}</div></div>`;
        wireSteppers((_id, v) => {
          S.input = v;
          save();
          const g = $("#rgraph");
          if (g) g.innerHTML = reefGraph(arr, i, v);
        });
        button(i < 4 ? TU.next : TU.last, () => ACT.reefNext());
      } else if (z === "safari") {
        const TU = TASK_UI.safari;
        copy.innerHTML = `<p class="kick in">${TU.kick}</p><p class="in d1" style="font-size:34px;font-weight:700;line-height:1.25;margin:0;background:#ffffff26;border-radius:18px;padding:16px 20px">${TASKS.safari.scenarios[S.safariIdx]}</p>
      <p class="lead in d2">${TU.lead}</p>
      <div class="in d3 senrow" style="margin-top:14px"><span class="senpre">${TU.start}</span><input class="tline" id="sen" maxlength="60" placeholder="${TU.ph}" aria-label="${TU.ph}" value="${(S.sentence || "").replace(/"/g, "&quot;")}"></div>
      <p class="small in d4" id="wc"></p>`;
        const inp = $<HTMLInputElement>("#sen")!;
        const upd = () => {
          const n = inp.value.trim() ? inp.value.trim().split(/\s+/).length : 0;
          $("#wc")!.textContent = fill(TU.wc, { n });
          $("#wc")!.style.fontWeight = n > 5 ? "900" : "300";
          S.sentence = inp.value;
          persistLocal();
          if (n > 0 && n <= 5) button(TU.cta, () => ACT.safariDone());
          else goBtn.hidden = true;
        };
        inp.oninput = upd;
        upd();
      }
    },

    // ---------- the result ----------
    result() {
      const z = S.zone!,
        T = UI.result,
        g = S.lastGain!;
      zoneMode(z);
      bar(z);
      placeBoard("hide");
      copy.style.cssText = "right:64px;top:104px;width:640px";
      copy.innerHTML = `<h1 class="xl in" style="font-size:84px">${g.timeup ? T.timeup : g.ok ? T.win : T.ok}</h1><p class="lead in d1" style="font-size:30px">${g.detail}</p>
    <div class="coinrow" aria-hidden="true">${Array.from({ length: Math.min(g.n, 6) }, (_, i) => `<span style="animation-delay:${0.35 + i * 0.14}s">${metal(z, 86)}</span>`).join("")}</div>
    <p class="in d2" style="font-size:44px;font-weight:900;margin:8px 0 0"><span class="num">+${g.n}</span> ${fill(UI.gate.tokensOf, { resource: ZB[z].resource })}${g.flooded ? ` <span style="font-size:22px;font-weight:300">${T.flooded}</span>` : ""}</p>
    ${g.first ? `<div class="card in d4" style="position:relative;margin-top:22px;padding:16px 20px"><p style="margin:0;font-size:20px">${T.first}</p></div>` : ""}
    ${g.fogAsk ? `<div class="card in d5" id="fogq" style="position:relative;margin-top:18px;padding:14px 20px"><p style="margin:0;font-size:21px">${fill(T.fog, { rule: g.fogAsk })}</p>${g.fogDone == null ? `<div style="display:flex;gap:10px;margin-top:10px"><button class="opt fr" type="button" style="min-height:52px;font-size:20px;font-weight:700">${T.fogYes}</button><button class="opt fr" type="button" style="min-height:52px;font-size:20px">${T.fogNo}</button></div>` : ""}</div>` : ""}`;
      stage.classList.add("scene");
      extra.innerHTML = sceneArt(z);
      const my = SCR;
      if (!g.shown) {
        g.shown = true;
        save();
        (async () => {
          await wait(500);
          if (my !== SCR) return;
          confetti(g.ok ? 110 : 40, z);
          burst(640, 420, 240);
          await flyTokens(z, g.n, [640, 420]);
        })();
      }
      if (g.fogAsk && g.fogDone == null) onPick(".fr", (i) => ACT.fogCheck(i));
      else button(T.cta, () => go("flip", { flipKind: z }));
    },

    // ================================================================
    //  the end
    // ================================================================
    finale() {
      const T = UI.finale;
      zoneMode(null);
      bar();
      placeBoard("left");
      copy.style.cssText = "right:56px;top:130px;width:470px";
      copy.innerHTML = `<p class="kick in">${T.kick}</p><h1 class="in d1">${T.title}</h1>`;
      const my = SCR;
      (async () => {
        await wait(900);
        const path = pathTo(S.pos, B.goal);
        drawTrail([S.pos, ...path]);
        for (const i of path) {
          if (my !== SCR) return;
          setBoat(i);
          await wait(900);
        }
        S.pos = B.goal;
        save();
        const h = hex(B.goal);
        if (h) {
          const [x, y] = stageXY(h);
          burst(x, y, 260);
        }
        confetti(160);
      })();
      button(T.cta, () => ACT.finish());
    },
    finale2() {
      // arriving at the gate of אי השפיות: the forest, the gate opens, then the count
      const T = UI.finale;
      zoneMode(null);
      bar();
      placeBoard("hide");
      stage.classList.add("nosea", "gatebg");
      stage.classList.remove("night");
      const sum = total();
      extra.innerHTML = `<div class="gate-wrap"><img src="${ASSET}/scene/gate_open.png" alt=""><div class="leaf l"><img src="${ASSET}/scene/door_r.png" alt=""></div><div class="leaf r"><img src="${ASSET}/scene/door_l.png" alt=""></div></div>`;
      copy.style.cssText = "left:60px;right:60px;top:84px;text-align:center";
      copy.innerHTML = `<p class="kick in" style="color:#15233F;opacity:1;font-weight:700">${T.kick2}</p><h1 class="in d1" style="font-size:64px;color:#15233F">${T.title2}</h1><p class="num in d2" id="cu" style="font-size:104px;font-weight:700;margin:0;line-height:1">0</p>`;
      const side = (zs: ZoneId[]) => `<div class="gchips">${zs.map((z) => `<span class="chip" style="color:var(--${z}-deep)">${coin(z, 32)}<b class="num">${S.tokens[z]}</b>${ZB[z].resource}</span>`).join("")}</div>`;
      extra.insertAdjacentHTML("beforeend", `<div class="gside in d3" style="right:70px">${side(IDS.slice(0, 3))}</div><div class="gside in d3" style="left:70px">${side(IDS.slice(3))}</div>${S.bonusList.length ? `<p class="gbonus in d4">${S.bonusList.map((b) => `${b.t} <b>+${b.n}</b>`).join(" · ")}</p>` : ""}`);
      const my = SCR;
      (async () => {
        await wait(900);
        if (my !== SCR) return;
        const g = $(".gate-wrap");
        if (g) g.classList.add("open");
        await wait(1100);
        const cu = $("#cu")!;
        for (let i = 0; i <= sum; i++) {
          if (my !== SCR) return;
          cu.textContent = String(i);
          await wait(45);
        }
        confetti(120);
      })();
      button(T.cta2, () => go("invite"));
    },
    invite() {
      // a dignified end in the logo's colours: night, a blue-gold card, the logo above
      const T = UI.finale;
      zoneMode(null);
      bar();
      placeBoard("hide");
      stage.classList.add("nosea");
      const tier = GAME.tiers.find((t) => t.id === E.tierIdFor(total()))!;
      copy.style.cssText = "left:0;right:0;top:96px;display:grid;place-items:center";
      copy.innerHTML = `<img class="in" src="${ASSET}/logo.png" alt="" style="width:150px;margin-bottom:-40px;position:relative;z-index:2;filter:drop-shadow(0 8px 16px #0008)">
    <div class="invite-card in d1"><p class="k" style="margin-top:40px">${fill(T.invite, { circle: CIRCLE })}</p><h2>${tier.title}</h2><p>${tier.line}</p>
    <div class="rule"></div><p>${T.stage}</p><p class="fine" style="margin-top:12px">${T.hidden}</p></div>`;
      later(() => confetti(70), 600);
    },
  };

  function nextStage() {
    S.stage += 1;
    S.zone = null;
    S.input = null;
    S.dry = null;
    S.timer = null;
    if (S.stage > 6) {
      S.stage = 6;
      go("finale");
      return;
    }
    if (GAME.tideStages.includes(S.stage)) {
      const t = E.rollTide(S);
      if (t.hit && t.hit.length) {
        go("tide", { tideNow: t });
        return;
      }
    }
    go("sail");
  }

  // the route: the shortest way, around the fog when possible
  function bfs(from: number, maxD = 99, avoid: number[] = []) {
    const d: Record<number, number> = { [from]: 0 },
      prev: Record<number, number> = {},
      q = [from];
    while (q.length) {
      const c = q.shift()!;
      if (d[c] >= maxD) continue;
      for (const n of B.faces[c].adj) {
        if (n in d) continue;
        if (avoid.includes(n) && n !== B.goal) continue;
        d[n] = d[c] + 1;
        prev[n] = c;
        q.push(n);
      }
    }
    return { d, prev };
  }
  function pathTo(from: number, to: number): number[] {
    const fog = faceIdx("fog");
    for (const avoid of [[fog], []]) {
      const { d, prev } = bfs(
        from,
        99,
        avoid.filter((a) => a !== to),
      );
      if (to in d) {
        const p = [to];
        while (p[0] !== from) p.unshift(prev[p[0]]);
        return p.slice(1);
      }
    }
    return [to];
  }
  function continueSail() {
    if (!S.sail) return;
    go("sailing");
  }
  function arrive(i: number) {
    const k = B.faces[i].kind as ZoneId;
    S.pos = i;
    S.zone = k;
    S.target = i;
    S.input = null;
    S.dry = null;
    S.forestStep = 0;
    S.reefIdx = 0;
    S.obs = [2, 2, 2, 2];
    S.obsConfirm = false;
    go("gate");
  }

  // the explainer animations, one per island (the left side of the screen)
  const box = (html: string) => {
    extra.innerHTML = `<div class="anim" id="ab" style="left:40px;top:120px;width:620px;height:500px">${html}</div>`;
    return $("#ab")!;
  };
  type Step = (i: number) => void;
  const ANIM: Record<ZoneId, (my: number, step: Step) => Promise<void>> = {
    async cave(my, step) {
      const b = box(
        HOW.cave.facts.map((f) => `<div class="mcard txt down" style="left:267px;top:190px"><div class="f">${f}</div><div class="k"></div></div>`).join("") +
          [0, 1, 2].map((i) => `<div class="p" style="left:${70 + i * 200}px;top:420px"><i></i><b></b></div><div class="p" style="left:${120 + i * 200}px;top:420px"><i></i><b></b></div>`).join("") +
          `<div id="calc" style="position:absolute;left:150px;top:30px;width:320px;text-align:center;font-size:30px;font-weight:900;color:#fff;opacity:0;transition:opacity .5s"></div>`,
      );
      const cards = [...b.querySelectorAll<HTMLElement>(".mcard")];
      while (my === SCR && alive) {
        step(0);
        cards.forEach((c) => {
          c.classList.add("down");
          c.style.left = "267px";
          c.style.top = "190px";
        });
        $("#calc")!.style.opacity = "0";
        await wait(900);
        if (my !== SCR) return;
        for (let i = 0; i < 6; i++) {
          const c = cards[i];
          c.style.left = 40 + (i % 3) * 200 + (i > 2 ? 50 : 0) + "px";
          c.style.top = (i > 2 ? 230 : 100) + "px";
          await wait(170);
        }
        await wait(700);
        step(1);
        for (const c of cards) {
          if (my !== SCR) return;
          c.classList.remove("down");
          await wait(650);
          c.classList.add("down");
        }
        step(2);
        await wait(500);
        const k = $("#calc");
        if (!k) return;
        k.innerHTML = '60 − 15 − 10 − 20 = <span style="color:var(--boat-fill)">?</span>';
        k.style.opacity = "1";
        await wait(3600);
      }
    },
    async lake(my, step) {
      const nums = [9, 2, 12, 6, 11, 4, 10, 7];
      const b = box(
        `<div class="axis" style="left:20px;top:330px;width:580px;height:8px"></div><span class="axl" style="right:10px;top:350px">${HOW.lake.axisLow}</span><span class="axl" style="left:10px;top:350px">${HOW.lake.axisHigh}</span>` +
          nums.map((n) => `<div class="mcard" style="left:267px;top:60px"><div class="f">${n}</div><div class="k"></div></div>`).join("") +
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<div class="p" style="left:${30 + i * 74}px;top:430px"><i></i><b></b></div>`).join(""),
      );
      const cards = [...b.querySelectorAll<HTMLElement>(".mcard")],
        sorted = nums.map((n, i) => [n, i] as [number, number]).sort((a, c) => a[0] - c[0]);
      while (my === SCR && alive) {
        step(0);
        cards.forEach((c, i) => {
          c.classList.remove("down");
          c.style.left = 24 + i * 74 + "px";
          c.style.top = "60px";
        });
        await wait(1600);
        if (my !== SCR) return;
        step(1);
        for (const c of cards) {
          c.classList.add("down");
          await wait(160);
        }
        await wait(1600);
        if (my !== SCR) return;
        step(2);
        for (let r = 0; r < 8; r++) {
          const i = sorted[r][1];
          cards[i].style.left = 522 - r * 72 + "px";
          cards[i].style.top = "196px";
          await wait(320);
        }
        await wait(900);
        if (my !== SCR) return;
        step(3);
        for (let r = 0; r < 8; r++) {
          cards[sorted[r][1]].classList.remove("down");
          await wait(330);
        }
        await wait(2600);
      }
    },
    async forest(my, step) {
      const T: [string, string][] = [
        ["#26AAE1", "sq"],
        ["#E53935", "tri"],
        ["#FDD835", "rt"],
        ["#26AAE1", "tri"],
        ["#26AAE1", "sq"],
        ["#FDD835", "sq"],
        ["#E53935", "rt"],
        ["#26AAE1", "rt"],
        ["#FDD835", "tri"],
      ];
      const shp = (c: string, s: string) => `<svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true">${s === "sq" ? `<rect x="6" y="6" width="58" height="58" fill="${c}" stroke="#fff" stroke-width="4"/>` : s === "tri" ? `<path d="M35 6 L64 64 L6 64Z" fill="${c}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>` : `<path d="M6 6 L64 64 L6 64Z" fill="${c}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>`}</svg>`;
      const spots = [
        [270, 210],
        [340, 210],
        [200, 210],
        [270, 140],
        [270, 280],
        [340, 140],
        [200, 280],
        [410, 210],
        [130, 210],
      ];
      const b = box(T.map(([c, s], i) => `<div class="tile" style="left:${30 + i * 64}px;top:420px">${shp(c, s)}</div>`).join("") + `<div id="flash" style="position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .15s;border-radius:20px"></div>`);
      const tiles = [...b.querySelectorAll<HTMLElement>(".tile")];
      while (my === SCR && alive) {
        step(0);
        tiles.forEach((t) => (t.style.transform = ""));
        await wait(1300);
        for (let i = 0; i < tiles.length; i++) {
          if (my !== SCR) return;
          step(i < 2 ? 1 : 2);
          const t = tiles[i],
            [x, y] = spots[i];
          t.style.transform = `translate(${x - (30 + i * 64)}px,${y - 420}px) scale(.98)`;
          await wait(560);
        }
        step(3);
        await wait(500);
        const f = $("#flash");
        if (!f) return;
        f.style.opacity = ".9";
        await wait(140);
        f.style.opacity = "0";
        await wait(2800);
      }
    },
    async observatory(my, step) {
      const H = HOW.observatory;
      const b = box(
        `<div class="axis" id="ax1" style="left:20px;top:245px;width:580px;height:8px;transform:scaleX(0)"></div><div class="axis" id="ax2" style="left:306px;top:20px;width:8px;height:460px;transform:scaleY(0)"></div>
      <span class="axl" style="right:0;top:262px">${H.likely}</span><span class="axl" style="left:0;top:262px">${H.unlikely}</span><span class="axl" id="l1" style="left:322px;top:16px;opacity:0">טוב</span><span class="axl" id="l2" style="left:322px;top:452px;opacity:0">רע</span>` +
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<div class="mcard" style="left:${20 + i * 74}px;top:-130px;width:64px;height:86px"><div class="f" style="font-size:28px">★</div><div class="k"></div></div>`).join(""),
      );
      const cards = [...b.querySelectorAll<HTMLElement>(".mcard")],
        xs = [500, 420, 120, 380, 60, 520, 200, 260],
        ys = [90, 340, 120, 360, 330, 160, 380, 70];
      while (my === SCR && alive) {
        $("#ax1")!.style.transform = "scaleX(0)";
        $("#ax2")!.style.transform = "scaleY(0)";
        $("#l1")!.style.opacity = "0";
        $("#l2")!.style.opacity = "0";
        cards.forEach((c, i) => {
          c.style.left = 20 + i * 74 + "px";
          c.style.top = "-130px";
        });
        step(0);
        await wait(300);
        $("#ax1")!.style.transform = "scaleX(1)";
        await wait(1100);
        if (my !== SCR) return;
        step(1);
        for (let i = 0; i < 8; i++) {
          cards[i].style.left = xs[i] + "px";
          cards[i].style.top = "206px";
          await wait(330);
        }
        await wait(800);
        if (my !== SCR) return;
        step(2);
        $("#ax2")!.style.transform = "scaleY(1)";
        $("#l1")!.style.opacity = "1";
        $("#l2")!.style.opacity = "1";
        await wait(1100);
        if (my !== SCR) return;
        step(3);
        for (let i = 0; i < 8; i++) {
          cards[i].style.top = ys[i] + "px";
          await wait(260);
        }
        await wait(2800);
      }
    },
    async reef(my, step) {
      const b = box(
        `<div class="card" id="say" style="left:20px;top:30px;width:580px;padding:16px 22px;font-size:24px;font-weight:700;opacity:0;transition:opacity .4s">״${TASKS.reef.statements[1]}״</div>` +
          Array.from({ length: 11 }, (_, i) => `<div class="p" style="left:${20 + i * 54}px;top:310px"><i></i><b></b></div>`).join("") +
          `<div id="cnt" style="position:absolute;left:250px;top:150px;font-size:80px;font-weight:900;color:#fff;opacity:0;transition:opacity .4s" class="num"></div>`,
      );
      const ps = [...b.querySelectorAll<HTMLElement>(".p")],
        up = [0, 2, 3, 5, 6, 8, 9];
      while (my === SCR && alive) {
        ps.forEach((p) => p.classList.remove("up"));
        $("#cnt")!.style.opacity = "0";
        $("#say")!.style.opacity = "0";
        step(0);
        await wait(400);
        $("#say")!.style.opacity = "1";
        await wait(1700);
        if (my !== SCR) return;
        step(1);
        for (const i of up) {
          ps[i].classList.add("up");
          await wait(150);
        }
        await wait(1100);
        if (my !== SCR) return;
        step(2);
        const c = $("#cnt")!;
        c.style.opacity = "1";
        for (let n = 1; n <= up.length; n++) {
          c.textContent = String(n);
          await wait(220);
        }
        await wait(2200);
      }
    },
    async safari(my, step) {
      const bubs = [...HOW.safari.bubbles, "זה חוסך זמן", "אבל מי מחליט?", gx("אני רוצה לבחור", "אני רוצה לבחור")];
      const b = box(
        `<div class="card" id="sc" style="left:20px;top:20px;width:580px;padding:18px 22px;font-size:21px;line-height:1.35;opacity:0;transition:opacity .4s">${TASKS.safari.scenarios[S.safariIdx]}</div>` +
          bubs.map((t, i) => `<div class="bub" style="position:absolute;left:${40 + (i % 3) * 190}px;top:${170 + Math.floor(i / 3) * 90}px;background:#fff;color:var(--cd);border-radius:20px 20px ${i % 2 ? "4px 20px" : "20px 4px"};padding:10px 16px;font-size:20px;font-weight:500;opacity:0;transform:scale(.6);transition:.4s cubic-bezier(.3,.8,.3,1.4)">${t}</div>`).join("") +
          `<div id="sen" style="position:absolute;left:20px;top:390px;width:580px;background:#fff;border-radius:16px;padding:16px 20px;font-size:26px;font-weight:900;color:var(--ink);opacity:0;transition:opacity .5s"><span style="font-weight:300">${TASK_UI.safari.start} </span><span id="tw"></span></div>`,
      );
      const bs = [...b.querySelectorAll<HTMLElement>(".bub")];
      const w = gx("עוצרים לבחור.", "עוצרות לבחור.");
      while (my === SCR && alive) {
        $("#sc")!.style.opacity = "0";
        bs.forEach((x) => {
          x.style.opacity = "0";
          x.style.transform = "scale(.6)";
        });
        $("#sen")!.style.opacity = "0";
        $("#tw")!.textContent = "";
        step(0);
        await wait(300);
        $("#sc")!.style.opacity = "1";
        await wait(1700);
        if (my !== SCR) return;
        step(1);
        for (const x of bs) {
          x.style.opacity = "1";
          x.style.transform = "none";
          await wait(420);
        }
        await wait(700);
        if (my !== SCR) return;
        step(2);
        $("#sen")!.style.opacity = "1";
        for (let i = 1; i <= w.length; i++) {
          if (my !== SCR) return;
          $("#tw")!.textContent = w.slice(0, i);
          await wait(80);
        }
        await wait(2600);
      }
    },
  };

  // ---------- the task's controls ----------
  function stepper(id: string, v: number, max = 99, sm = false, big = 0) {
    return `<div class="stepper${sm ? " sm" : ""}" data-id="${id}" data-max="${max}">${big ? `<button type="button" data-d="-${big}" aria-label="פחות ${big}" style="font-size:24px;font-weight:900">−${big}</button>` : ""}<button type="button" data-d="-1" aria-label="פחות"${big ? ' style="font-size:30px;font-weight:700"' : ""}>${big ? "−1" : "−"}</button><output class="num" id="${id}">${v}</output><button type="button" data-d="1" aria-label="יותר"${big ? ' style="font-size:30px;font-weight:700"' : ""}>${big ? "+1" : "+"}</button>${big ? `<button type="button" data-d="${big}" aria-label="יותר ${big}" style="font-size:24px;font-weight:900">+${big}</button>` : ""}</div>`;
  }
  function wireSteppers(onChange: (id: string, v: number) => void) {
    copy.querySelectorAll<HTMLElement>(".stepper").forEach((s) =>
      s.querySelectorAll<HTMLButtonElement>("button").forEach(
        (b) =>
          (b.onclick = () => {
            const o = s.querySelector("output")!;
            o.textContent = String(Math.max(0, Math.min(+s.dataset.max!, +o.textContent! + +b.dataset.d!)));
            onChange(s.dataset.id!, +o.textContent);
          }),
      ),
    );
  }
  function clockUI() {
    const T = UI.task;
    extra.insertAdjacentHTML(
      "beforeend",
      `<div class="clock" id="clk">${CLOCK}<span class="num" id="time"></span></div>
    <button class="tool" id="bank" type="button" style="top:166px" hidden>${CLOCK}${T.bank}</button>
    ${S.extraMin ? `<button class="tool" id="ext" type="button" style="top:226px">${CLOCK}${T.ext}</button>` : ""}`,
    );
    $("#bank")!.onclick = () => ACT.bank();
    const ext = $("#ext");
    if (ext) ext.onclick = () => ACT.ext();
    tickClock();
  }
  function tickClock() {
    const r = remaining();
    const t = $("#time");
    if (r == null || !t) return;
    t.textContent = mmss(r);
    const b = $("#bank");
    if (b && r <= 60 && S.bankLeft >= GAME.timeBankStep && b.hidden) {
      b.hidden = false;
      b.classList.add("hint");
    }
    if (r <= 30) $("#clk")!.classList.add("low");
    else $("#clk")!.classList.remove("low");
    if (stage.classList.contains("deck") && S.timer) skyAt(1 - r / Math.max(S.timer.total, 1));
  }

  // ================================================================
  //  actions
  // ================================================================
  function award(n: number, { ok = true, detail = "", timeup = false } = {}) {
    const z = S.zone!;
    const fl = S.flooded.includes(S.pos);
    if (fl && n > 1) n = Math.max(1, Math.round(n / 2));
    S.tokens[z] += n;
    const fogAsk = S.pendingRule && !timeup ? FOG_CARDS.find((c) => c.id === S.pendingRule)!.title : null;
    S.lastGain = { n, ok, detail, timeup, flooded: fl, first: S.firstWin, fogAsk, fogDone: null, shown: false };
    S.firstWin = false;
    S.timer = null;
    if (!S.visited.includes(z)) S.visited.push(z);
    S.flooded = S.flooded.filter((i) => i !== S.pos);
    if (timeup) S.stats.timeouts++;
    if (!fogAsk) S.pendingRule = null;
    go("result");
  }
  async function compressPhoto(file: File): Promise<string> {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const m = 640,
      k = Math.min(1, m / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = img.width * k;
    c.height = img.height * k;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return c.toDataURL("image/jpeg", 0.72);
  }
  function fakePhoto(): string {
    // a stand-in for the photo: tiles side by side, no overlap
    const c = document.createElement("canvas");
    c.width = 560;
    c.height = 420;
    const x = c.getContext("2d")!;
    x.fillStyle = "#d9d2c4";
    x.fillRect(0, 0, 560, 420);
    const cols = TASKS.forest.key.color.items.map((i) => i.c);
    const r = E.rng(S.seed + 9);
    const s = 52,
      cols0 = 7,
      rows0 = 5,
      ox = 280 - (cols0 * s) / 2,
      oy = 210 - (rows0 * s) / 2;
    const cells: [number, number][] = [];
    for (let a = 0; a < cols0; a++)
      for (let b = 0; b < rows0; b++) {
        const d = Math.hypot(a - 3, (b - 2) * 1.2);
        if (d < 3.1) cells.push([a, b]);
      }
    cells.forEach(([a, b]) => {
      const px = ox + a * s,
        py = oy + b * s;
      const t = Math.floor(r() * 3);
      x.fillStyle = cols[Math.floor(r() * 3)];
      x.strokeStyle = "#0004";
      x.lineWidth = 2;
      x.beginPath();
      if (t === 0) x.rect(px + 2, py + 2, s - 4, s - 4);
      else if (t === 1) {
        x.moveTo(px + s / 2, py + 3);
        x.lineTo(px + s - 3, py + s - 3);
        x.lineTo(px + 3, py + s - 3);
      } else {
        x.moveTo(px + 3, py + 3);
        x.lineTo(px + 3, py + s - 3);
        x.lineTo(px + s - 3, py + s - 3);
      }
      x.closePath();
      x.fill();
      x.stroke();
    });
    return c.toDataURL("image/jpeg", 0.8);
  }

  const ACT = {
    pick: (i: number, far: boolean) => {
      if (far) payToken();
      const path = pathTo(S.pos, i);
      if (S.wind) {
        S.wind = false;
        S.effects = S.effects.filter((e) => e !== "wind");
      }
      S.sail = { path, at: 0 };
      go("sailing");
    },
    lighthouse: (i: number) => {
      if (!S.usedHelpers.includes("lighthouse")) S.usedHelpers.push("lighthouse");
      if (i === 3) {
        continueSail();
        return;
      }
      if (!payToken()) {
        continueSail();
        return;
      }
      if (i === 0) S.extraMin = (S.extraMin || 0) + 3;
      if (i === 1) {
        const fl = S.flooded.filter((x) => !S.visited.includes(B.faces[x].kind as ZoneId));
        if (fl.length) {
          S.flooded = S.flooded.filter((x) => x !== fl[0]);
          S.lhDried = B.faces[fl[0]].kind;
          S.stats.dried++;
        }
      }
      if (i === 2) S.wind = true;
      go("lhDone", { lhChoice: i });
    },
    market: (i: number) => {
      if (i >= 6) {
        continueSail();
        return;
      }
      const z = IDS[i];
      if (S.tokens[z] < 2) return;
      S.tokens[z] -= 2;
      IDS.filter((x) => x !== z).forEach((x) => S.tokens[x]++);
      if (!S.usedHelpers.includes("market")) S.usedHelpers.push("market");
      go("flip", { flipKind: "market" });
    },
    flipped: (k: string) => {
      if (k === "market") {
        if (!S.flipped.includes("market")) S.flipped.push("market");
        S.flipKind = null;
        continueSail();
        return;
      }
      if (!S.flipped.includes(k)) S.flipped.push(k);
      S.flipKind = null;
      S.zone = null;
      nextStage();
    },
    dry: (i: number) => {
      if (i === 0) {
        if (!payToken()) return;
        S.flooded = S.flooded.filter((x) => x !== S.pos);
        S.stats.dried++;
        S.dry = "dry";
      } else S.dry = "wet";
      go("gate");
    },
    startTask: () => {
      const rule = S.pendingRule;
      startTimer(rule === "doubleClock" ? 5 : GAME.minutesPerZone);
      S.input = null;
      go("task");
    },
    bank: () => {
      if (S.bankLeft < GAME.timeBankStep) return;
      S.bankLeft -= GAME.timeBankStep;
      S.bankUsed = true;
      addTime(GAME.timeBankStep);
      const b = $("#bank");
      if (b) b.hidden = true;
      tickClock();
    },
    ext: () => {
      addTime(S.extraMin || 3);
      S.extraMin = 0;
      save();
      const e = $("#ext");
      if (e) e.remove();
      tickClock();
    },
    caveDone: () => {
      const T = TASK_UI.cave;
      const v = S.input ?? 60;
      const ok = v === TASKS.cave.answer;
      award(ok ? 4 : 1, { ok, detail: ok ? T.right : T.wrong });
    },
    lakeDone: () => {
      const T = TASK_UI.lake;
      const v = S.input ?? 0;
      const n = TASKS.lake.reward[Math.min(v, TASKS.lake.reward.length - 1)];
      award(n, { ok: v <= 1, detail: v === 0 ? T.right : T.wrong });
    },
    forestDone: () => {
      pushCreations();
      award(4, { ok: true, detail: TASK_UI.forest.right });
    },
    obsDone: () => {
      const T = TASK_UI.observatory;
      const q = S.obs || [0, 0, 0, 0];
      const ok = q.reduce((a, b) => a + b, 0) === 8;
      S.quad = { likelyGood: q[0], unlikelyGood: q[1], likelyBad: q[2], unlikelyBad: q[3] };
      award(ok ? 4 : 1, { ok, detail: ok ? T.right : T.wrong });
    },
    reefNext: () => {
      const i = S.reefIdx || 0;
      S.creations.standing[i] = S.input ?? 0;
      S.input = 0;
      pushCreations();
      if (i < 4) go("task", { reefIdx: i + 1 });
      else award(4, { ok: true, detail: TASK_UI.reef.right });
    },
    safariDone: () => {
      S.creations.sentence = (S.sentence || "").trim();
      pushCreations();
      award(4, { ok: true, detail: TASK_UI.safari.right });
    },
    fogCheck: (i: number) => {
      const g = S.lastGain!;
      g.fogDone = i === 0;
      if (i === 0) {
        S.tokens[S.zone!] += GAME.bonuses.fog;
        g.n += GAME.bonuses.fog;
      }
      S.pendingRule = null;
      S.fogRule = null;
      save();
      render();
      if (i === 0) flyTokens(S.zone!, 1, [640, 420]);
    },
    timeup: () => {
      if (S.zone === "reef") pushCreations();
      award(1, { ok: false, timeup: true, detail: UI.result.timeupLine });
    },
    finish: () => {
      S.bonusList = [];
      const low = () => IDS.slice().sort((a, b) => S.tokens[a] - S.tokens[b])[0];
      if (IDS.every((z) => S.tokens[z] >= GAME.bonuses.balancedMin)) {
        S.tokens[low()] += GAME.bonuses.balanced;
        S.bonusList.push({ t: UI.finale.balanced, n: GAME.bonuses.balanced });
        S.bonusBalanced = true;
      }
      if (!S.bankUsed) {
        S.tokens[low()] += GAME.bonuses.bankUnused;
        S.bonusList.push({ t: UI.finale.bank, n: GAME.bonuses.bankUnused });
        S.bonusBank = true;
      }
      S.stage = 7;
      S.pos = B.goal;
      S.finishedAt = Date.now();
      go("finale2");
    },
    fakePhoto: () => {
      const photo = fakePhoto();
      S.creations.photo = photo;
      restoredHasPhoto = false;
      pushCreations(photo);
      render();
    },
  };

  // ---------- the live clock ----------
  const clockTimer = setInterval(() => {
    if (!alive) return;
    const r = remaining();
    if (r == null) return;
    if (S.phase === "task") tickClock();
    if (r <= 0 && S.phase === "task") {
      S.timer = null;
      ACT.timeup();
    }
  }, 500);

  // ---------- scale ----------
  // The soft keyboard (the owner's Lenovo, 25.11: ״המקלדת נפתחת והתצוגה מתקטנת״) shrinks the window; the stage must
  // not shrink with it. While a text field has the focus the scale stays, and the stage is only lifted so the field
  // sits above the keyboard; the next resize without a focused field fits the whole picture again.
  let lastScale = 0, lift = 0;
  const typing = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && host.contains(a) ? a : null;
  };
  function fit() {
    const vv = window.visualViewport;
    // the visual viewport can lag the window by a frame on resize - take the smaller of the two
    const w = innerWidth, h = Math.min(innerHeight, vv ? vv.height : innerHeight) - (opts.edit ? 56 : 0);
    const field = typing();
    if (field && lastScale) {
      // measured while already lifted: add the current lift back, or every second call would undo the first.
      // The big button under the field (״זה המשפט שלנו״) must stay above the keyboard too (the owner, 25.11).
      // In full screen Chrome 81 keeps the window the same size while the keyboard covers it (no resize at all), so
      // when the window has not shrunk the keyboard is assumed to take the lower 55%: the field and the button are
      // lifted into the top 45% as soon as the field is touched.
      const shrunk = h < innerHeight - 50 || h < 0.8 * (screen.height || innerHeight);
      const avail = shrunk ? h : Math.round(h * 0.45);
      const r = field.getBoundingClientRect();
      const goEl = $("#go") as HTMLElement | null;
      const bottom = goEl && !goEl.hidden ? Math.max(r.bottom, goEl.getBoundingClientRect().bottom) : r.bottom;
      lift = Math.max(0, bottom + lift + 24 - avail);
      stage.style.transform = `translate(-50%, -50%) translateY(${-lift}px) scale(${lastScale})`;
      return;
    }
    lift = 0;
    lastScale = Math.min(w / 1280, h / 720);
    // centred by its own middle (left/top 50%): a grid cell narrower than 1280 pushed the stage to one side (25.11)
    stage.style.transform = `translate(-50%, -50%) scale(${lastScale})`;
  }
  const onResize = () => {
    fit();
    later(fit, 150);
  };
  addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  host.addEventListener("focusin", () => {
    fit();
    later(fit, 350);
  });
  host.addEventListener("focusout", () => later(fit, 100));
  fit();
  // Full screen (Android Chrome tablets; the class mirrors the kit's html.full). Asked for on a touch's pointerup -
  // not pointerdown, which is no user activation in Chrome and was refused in silence. The camera app of the forest
  // photo drops it (the owner, 25.11), so the next touch asks again, unless the operator left full screen on purpose
  // with the corner button, which also brings it back.
  // the installed app (display-mode: fullscreen WITHOUT a fullscreen element) needs none of this; a page the API put in full screen matches that media query too, so the element is checked
  const pwa = () => !!window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches && !document.fullscreenElement;
  const canFs = () => !!document.documentElement.requestFullscreen && !pwa();
  let wantFs = true;
  const enterFs = () => {
    if (wantFs && canFs() && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  };
  host.addEventListener("pointerup", enterFs);
  // the button lives in the top bar next to the bag (the owner, 25.11: ״באותה שורה של האסימונים ושיראו אותו״); the
  // bar is re-rendered by bar(), so the markup comes from fsHtml() and the clicks are delegated
  const fsLabel = () => (document.fullscreenElement ? "⤡" : "⤢");
  const fsTitle = () => (document.fullscreenElement ? "יציאה ממסך מלא" : "מסך מלא");
  const toggleFs = () => {
    if (document.fullscreenElement) {
      wantFs = false;
      document.exitFullscreen?.().catch(() => {});
    } else {
      wantFs = true;
      enterFs();
    }
  };
  const barEl = $("#bar") as HTMLElement;
  barEl.addEventListener("pointerup", (e) => {
    if ((e.target as HTMLElement).closest(".fsbtn")) e.stopPropagation();
  });
  barEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".fsbtn")) {
      e.stopPropagation();
      toggleFs();
    }
  });
  const paintFs = () => {
    host.classList.toggle("full", !!document.fullscreenElement);
    const b = host.querySelector(".fsbtn") as HTMLElement | null;
    if (b) {
      b.textContent = fsLabel();
      b.title = fsTitle();
      // not in full screen: the button blinks until someone taps it (the owner, 25.11)
      b.classList.toggle("blink", !document.fullscreenElement);
    }
  };
  const onFs = () => paintFs();
  document.addEventListener("fullscreenchange", onFs);
  // back from the camera app (the forest photo): ask again at once - the browser may refuse without a touch, and then
  // the blinking button and the next touch take care of it
  const onBack = () => {
    if (!document.hidden) later(enterFs, 300);
  };
  document.addEventListener("visibilitychange", onBack);
  paintFs();

  // ---------- the demo tools (outside the stage), ?dev=1 only ----------
  let devbar: HTMLElement | null = null;
  if (opts.dev && !SHOT) {
    devbar = document.createElement("div");
    devbar.className = "devbar";
    devbar.innerHTML = `<span style="color:#fff9">מעגל ${CIRCLE}</span><button data-d="reset">משחק חדש</button><button data-d="time">דילוג על השעון</button><select data-d="jump"><option>קפיצה...</option>${Object.keys(R)
      .map((k) => `<option>${k}</option>`)
      .join("")}</select>`;
    host.appendChild(devbar);
    devbar.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.d;
      if (a === "reset") {
        // a new game that the server accepts: it carries on from the current version
        const v = S.version ?? 0;
        S = fresh();
        S.version = v;
        restoredHasPhoto = false;
        B = S.board;
        buildBoard();
        go("welcome");
      }
      if (a === "time" && S.timer) S.timer.end = Date.now() + 3000;
    });
    devbar.querySelector("select")!.addEventListener("change", (e) => {
      const p = (e.target as HTMLSelectElement).value as Phase;
      if (!R[p]) return;
      if (["gate", "howto", "task", "result"].includes(p) && !S.zone) {
        S.zone = "cave";
        S.pos = faceIdx("cave");
        S.stage = Math.max(1, S.stage);
      }
      if (p === "task" && !S.timer) startTimer(10);
      if (p === "result" && !S.lastGain) S.lastGain = { n: 4, ok: true, detail: "", timeup: false, flooded: false, first: false, fogAsk: null, fogDone: null, shown: false };
      go(p);
    });
  }

  // ---------- the owner's editor (26.11): marks → editable spans, saves, the bar on top ----------
  let editor: { afterRender(): void; destroy(): void } | null = null;
  if (opts.edit && !SHOT) {
    host.classList.add("editing");
    let bar: ReturnType<typeof createEditBar> | null = null;
    const originalOf = (path: string): string => {
      let v: unknown = C0;
      for (const k of path.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
      return typeof v === "string" ? v : "";
    };
    const jump = (p: Phase, z: ZoneId) => {
      try {
        if (["gate", "howto", "task", "result", "flip"].includes(p)) {
          S.zone = z;
          S.pos = faceIdx(z);
          S.stage = Math.max(1, S.stage);
          S.flipKind = z;
          if (!S.visited.includes(z)) S.visited = [...S.visited, z];
        }
        if (p === "task" && !S.timer) startTimer(10);
        if (p === "result") {
          const TU = TASK_UI[z] as { right: string; wrong?: string };
          if (!S.lastGain || (S.lastGain.detail !== TU.right && S.lastGain.detail !== TU.wrong)) S.lastGain = { n: 4, ok: true, detail: TU.right, timeup: false, flooded: false, first: false, fogAsk: null, fogDone: null, shown: false };
        }
        if (p === "sail") S.sail = null;
        go(p);
      } catch (e) {
        console.error("edit jump", p, e);
      }
    };
    let decorating = false;
    const deco = () => {
      if (decorating) return;
      decorating = true;
      try {
        decorate(stage);
        decorate(goBtn);
      } finally {
        decorating = false;
      }
    };
    const mo = new MutationObserver(() => later(deco, 30));
    mo.observe(host, { childList: true, subtree: true, characterData: true });
    const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    host.addEventListener("input", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-path]");
      if (!el) return;
      const path = el.dataset.path!;
      const t = saveTimers.get(path);
      if (t) clearTimeout(t);
      saveTimers.set(
        path,
        setTimeout(() => {
          const text = readEditable(el);
          const original = originalOf(path);
          const sid = screenId(S.phase, S.zone);
          const was = EDIT_STORE.edits.has(path);
          const now = text !== original;
          if (now) EDIT_STORE.edits.set(path, text);
          else EDIT_STORE.edits.delete(path);
          const st = EDIT_STORE.screens.get(sid) ?? { visited: true, edited: 0 };
          st.edited = Math.max(0, st.edited + (now && !was ? 1 : !now && was ? -1 : 0));
          EDIT_STORE.screens.set(sid, st);
          bar?.update(S.phase, S.zone);
          void putRow({ kind: "text", key: path, text: now ? text : null, original, screen: sid });
        }, 600),
      );
    });
    editor = {
      afterRender() {
        deco();
        const sid = screenId(S.phase, S.zone);
        if (!EDIT_STORE.screens.has(sid)) {
          EDIT_STORE.screens.set(sid, { visited: true, edited: 0 });
          void putRow({ kind: "screen", key: sid, text: "visited", screen: sid });
        }
        bar?.update(S.phase, S.zone);
      },
      destroy() {
        mo.disconnect();
        bar?.destroy();
      },
    };
    void loadStore().then((st) => {
      if (!alive) return;
      for (const [k, v] of st.edits) EDIT_STORE.edits.set(k, v);
      for (const [k, v] of st.screens) EDIT_STORE.screens.set(k, v);
      EDIT_STORE.note = st.note;
      bar = createEditBar(host, EDIT_STORE, jump, (text) => void putRow({ kind: "note", key: "general", text }));
      render();
    });
  }

  // ---------- start ----------
  buildBoard();
  // fonts.ready never settles while a network filter holds the font files (the owner's office tablet, 25.11: the map drawn, no words, no button).
  // The words matter more than the typeface: draw after 1.5s whatever the fonts are doing (font-display: swap brings Rag Sans in when it lands).
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    if (!alive) return;
    render();
  });
  // the server learns we are here (and gets anything saved offline earlier)
  sync.queue(payload(), S.creations.photo && !restoredHasPhoto && !boot.hasPhoto ? S.creations.photo : null);

  const handle: TabletHandle = {
    get S() {
      return S;
    },
    go,
    render,
    destroy() {
      alive = false;
      SCR++;
      clearInterval(clockTimer);
      clearInterval(poll);
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      sync.destroy();
      removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      host.removeEventListener("pointerup", enterFs);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onBack);
      devbar?.remove();
      editor?.destroy();
      if (window.HK && window.HK.go === go) delete window.HK;
    },
  };
  window.HK = {
    get S() {
      return S;
    },
    set S(v: GameState) {
      S = v;
      B = S.board;
      buildBoard();
    },
    go,
    render,
    ACT: ACT as unknown as Record<string, (...a: never[]) => void>,
    R,
  };
  return handle;
}
