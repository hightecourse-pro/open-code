// ============================================================================
// The game engine of המסע לאי השפיות: the board (one of 60 fixed shapes), the
// tide, sailing, scoring. No DOM, no texts - runs on the tablet, on the hall
// screen (to redraw a circle's board from its seed) and in the checks.
// Ported from the hand-over kit's engine.js (22.11).
// ============================================================================
import { BOARDS } from "./boards";
import { FOG_IDS, RULES, SAFARI_SCENARIOS, ZONE_IDS, type FaceKind, type FogId, type ZoneId } from "./content";

// ---------- seeded randomness (a board can be rebuilt) ----------
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
function shuffle<T>(r: () => number, a: readonly T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** The numbers printed on the back of every hexagon (fixed - they are printed). */
export const FACE_NUM: Record<FaceKind, number> = { start: 1, cave: 2, lake: 3, forest: 4, observatory: 5, reef: 6, safari: 7, lighthouse: 8, fog: 9, market: 10, goal: 11, bank: 12 };

export type Pt = [number, number];
export interface Face {
  i: number;
  shape: "hex";
  q: number;
  r: number;
  pts: Pt[];
  adj: number[];
  kind: FaceKind;
  num: number;
  c: Pt;
}
export interface Board {
  seed: number;
  layout: number;
  faces: Face[];
  w: number;
  h: number;
  start: number;
  goal: number;
  bankNum: number;
}

// ---------- geometry: a pointy-top hex grid in axial coordinates ----------
const DIRS: Pt[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const kq = (q: number, r: number) => q + "," + r;
function hexCorners(q: number, r: number): Pt[] {
  const cx = Math.sqrt(3) * (q + r / 2),
    cy = 1.5 * r;
  return [...Array(6)].map((_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [cx + Math.cos(a), cy + Math.sin(a)] as Pt;
  });
}
function centroid(p: Pt[]): Pt {
  let x = 0,
    y = 0;
  p.forEach((q) => {
    x += q[0];
    y += q[1];
  });
  return [x / p.length, y / p.length];
}
// a 60° turn on the hex grid (keeps the hexagons pointy)
const rot60 = ([q, r]: Pt): Pt => {
  const z = r,
    y = -q - r;
  return [-z, -y];
};

function bfs(adj: number[][], from: number, blocked = new Set<number>()): number[] {
  const dist = new Array<number>(adj.length).fill(Infinity);
  dist[from] = 0;
  const q = [from];
  while (q.length) {
    const v = q.shift()!;
    for (const w of adj[v])
      if (dist[w] === Infinity && !blocked.has(w)) {
        dist[w] = dist[v] + 1;
        q.push(w);
      }
  }
  return dist;
}

// ---------- the board: one of the 60 fixed shapes ----------
// Circle N gets board N (no two circles share a shape). The seed only draws which island sits on which hexagon.
export const BOARD_COUNT = BOARDS.length;
export function makeBoard(seed: number, circle?: number): Board {
  const r = rng(seed);
  const idx = circle ? (circle - 1) % BOARDS.length : seed % BOARDS.length;
  const B = BOARDS[idx];
  // the turn that gives the widest board (the tablet's width, the floor)
  let best: { k: number; cells: Pt[]; asp: number } | null = null;
  for (let k = 0; k < 6; k++) {
    let cells = B.cells.map((c) => c.slice() as Pt);
    for (let j = 0; j < k; j++) cells = cells.map(rot60);
    const xs = cells.map(([q, rr]) => Math.sqrt(3) * (q + rr / 2)),
      ys = cells.map(([, rr]) => 1.5 * rr);
    const asp = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys) + 1);
    if (!best || asp > best.asp) best = { k, cells, asp };
  }
  const key = (c: readonly number[]) => kq(c[0], c[1]);
  const orig = B.cells.map(key);
  const at = (c: readonly number[]) => orig.indexOf(key(c));
  const cells = best!.cells;
  const idxMap = new Map(cells.map((c, i) => [kq(c[0], c[1]), i]));
  const adj = cells.map(([q, rr]) => DIRS.map(([a, b]) => idxMap.get(kq(q + a, rr + b))).filter((v): v is number => v !== undefined));
  const faces = cells.map(([q, rr], i) => ({ i, shape: "hex" as const, q, r: rr, pts: hexCorners(q, rr), adj: adj[i], kind: "start" as FaceKind, num: 0, c: [0, 0] as Pt }));
  const start = at(B.start),
    goal = at(B.goal);
  faces[start].kind = "start";
  faces[goal].kind = "goal";
  const zs = shuffle(r, B.zones.map(at));
  ZONE_IDS.forEach((z, k) => {
    faces[zs[k]].kind = z;
  });
  const hk = shuffle(r, ["lighthouse", "fog", "market"] as const);
  B.helpers.map(at).forEach((i, k) => {
    faces[i].kind = hk[k];
  });
  faces.forEach((f) => {
    f.num = FACE_NUM[f.kind];
  });
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  faces.forEach((f) =>
    f.pts.forEach(([x, y]) => {
      minx = Math.min(minx, x);
      miny = Math.min(miny, y);
      maxx = Math.max(maxx, x);
      maxy = Math.max(maxy, y);
    }),
  );
  faces.forEach((f) => {
    f.pts = f.pts.map(([x, y]) => [x - minx, y - miny] as Pt);
    f.c = centroid(f.pts);
  });
  return { seed, layout: idx + 1, faces, w: maxx - minx, h: maxy - miny, start, goal, bankNum: FACE_NUM.bank };
}

// ---------- the game's state ----------
export type Phase = "welcome" | "setup" | "ready" | "tide" | "sail" | "sailing" | "fog" | "lighthouse" | "lhDone" | "market" | "flip" | "gate" | "howto" | "task" | "result" | "finale" | "finale2" | "invite";
export type Tokens = Record<ZoneId, number>;
export interface LastGain {
  n: number;
  ok: boolean;
  detail: string;
  timeup: boolean;
  flooded: boolean;
  first: boolean;
  fogAsk: string | null;
  fogDone: boolean | null;
  shown: boolean;
}
export interface GameState {
  v: 1;
  circle: number;
  seed: number;
  board: Board;
  stage: number; // 0 = the opening, 1..6 stages, 7 = the end
  pos: number;
  visited: ZoneId[]; // islands completed
  flooded: number[];
  floodCount: Record<number, number>;
  sunk: number[];
  usedHelpers: string[];
  skipUsed: boolean;
  tokens: Tokens;
  effects: string[];
  log: unknown[];
  bankLeft: number;
  bankUsed: boolean;
  pendingRule: FogId | null;
  doubleNext: boolean;
  shieldNext: boolean;
  windNext: boolean;
  lakeOrder: number[];
  safariIdx: number;
  fogDeck: FogId[];
  creations: { standing: number[]; sentence: string; photo: string | null };
  stats: { dried: number; floods: number; timeouts: number };
  phase: Phase;
  // the tablet's own fields (the kit's fresh())
  firstWin: boolean;
  extraMin: number;
  wind: boolean;
  fogRule: FogId | null;
  dry: "dry" | "wet" | null;
  flipped: string[];
  bonusList: { t: string; n: number }[];
  sail: { path: number[]; at: number } | null;
  seenTide: boolean;
  timer: { end: number; total: number } | null;
  zone: ZoneId | null;
  input: number | null;
  target?: number;
  forestStep?: number;
  reefIdx?: number;
  obs?: number[];
  /** the observatory's ״שולחים״ was tapped once with fewer than 8 cards counted - the next tap sends (the owner, 25.11) */
  obsConfirm?: boolean;
  lastGain?: LastGain;
  lhChoice?: number;
  lhDried?: string;
  tideNow?: { hit: number[]; calm?: boolean; shielded?: boolean } | null;
  sentence?: string;
  quad?: Record<string, number>;
  finishedAt?: number | null;
  flipKind?: string | null;
  bonusBalanced?: boolean;
  bonusBank?: boolean;
  bonusHall?: boolean;
  /** Server sync (the rewrite): a monotonic counter per save, and when this game was born (an event reset after it discards it). */
  version: number;
  createdAt: number;
}

export function newGame(circle: number, seed: number = (Date.now() ^ (circle * 7919)) >>> 0): GameState {
  const board = makeBoard(seed, circle);
  const r = rng(seed + 17);
  const tokens = Object.fromEntries(ZONE_IDS.map((z) => [z, 1])) as Tokens;
  return {
    v: 1,
    circle,
    seed,
    board,
    stage: 0,
    pos: board.start,
    visited: [],
    flooded: [],
    floodCount: {},
    sunk: [],
    usedHelpers: [],
    skipUsed: false,
    tokens,
    effects: [],
    log: [],
    bankLeft: RULES.timeBankMinutes,
    bankUsed: false,
    pendingRule: null,
    doubleNext: false,
    shieldNext: false,
    windNext: false,
    lakeOrder: shuffle(r, [0, 1, 2]),
    safariIdx: Math.floor(r() * SAFARI_SCENARIOS),
    fogDeck: shuffle(r, FOG_IDS),
    creations: { standing: [], sentence: "", photo: null },
    stats: { dried: 0, floods: 0, timeouts: 0 },
    phase: "welcome",
    firstWin: true,
    extraMin: 0,
    wind: false,
    fogRule: null,
    dry: null,
    flipped: [],
    bonusList: [],
    sail: null,
    seenTide: false,
    timer: null,
    zone: null,
    input: null,
    version: 0,
    createdAt: Date.now(),
  };
}

export const total = (s: Pick<GameState, "tokens">): number => Object.values(s.tokens).reduce((a, b) => a + b, 0);
export const faceOf = (s: GameState, kind: FaceKind): Face | undefined => s.board.faces.find((f) => f.kind === kind);
export const isZone = (k: string): k is ZoneId => (ZONE_IDS as readonly string[]).includes(k);

// The tide: stages 2 and 4 only. One hexagon each time, among the islands not visited yet; nothing ever sinks.
export const isTideStage = (stage: number): boolean => RULES.tideStages.includes(stage);
export function rollTide(s: GameState): { hit: number[]; calm?: boolean; shielded?: boolean } {
  if (!isTideStage(s.stage)) return { hit: [], calm: true };
  if (s.effects.includes("shield")) {
    s.effects.splice(s.effects.indexOf("shield"), 1);
    return { hit: [], shielded: true };
  }
  const r = rng(s.seed + s.stage * 101);
  const elig = s.board.faces.filter((f) => isZone(f.kind) && !s.visited.includes(f.kind as ZoneId) && f.i !== s.pos && !s.flooded.includes(f.i));
  const hit = shuffle(r, elig).slice(0, RULES.floodsPerTide);
  hit.forEach((f) => {
    s.floodCount[f.i] = (s.floodCount[f.i] || 0) + 1;
    s.stats.floods++;
    s.flooded.push(f.i);
  });
  return { hit: hit.map((f) => f.i) };
}

// Possible destinations: islands not visited yet, up to maxSteps, through faces that did not sink.
export function reachable(s: GameState): { targets: number[]; dist: number[]; blockedRoute: boolean; steps: number } {
  const steps = s.effects.includes("wind") ? RULES.maxSteps + 1 : RULES.maxSteps;
  const adj = s.board.faces.map((f) => f.adj);
  const blocked = new Set(s.sunk);
  const dist = bfs(adj, s.pos, blocked);
  const open = s.board.faces.filter((f) => isZone(f.kind) && !s.visited.includes(f.kind as ZoneId));
  let inRange = open.filter((f) => dist[f.i] <= steps && dist[f.i] > 0);
  // look ahead: offer only a destination from which every island can still be completed in sails of up to 2 steps
  const D = s.board.faces.map((f) => bfs(adj, f.i, blocked));
  const solvable = (from: number, left: number[]): boolean => !left.length || left.some((z) => D[from][z] <= RULES.maxSteps && solvable(z, left.filter((x) => x !== z)));
  const safe = inRange.filter((f) => solvable(f.i, open.filter((o) => o.i !== f.i).map((o) => o.i)));
  if (safe.length) inRange = safe;
  let blockedRoute = false;
  if (!inRange.length) {
    blockedRoute = true;
    const m = Math.min(...open.map((f) => dist[f.i]));
    inRange = open.filter((f) => dist[f.i] === m || m === Infinity);
  }
  return { targets: inRange.map((f) => f.i), dist, blockedRoute, steps };
}

export function rewardFor(s: GameState, zoneId: ZoneId, base: number): number {
  const f = faceOf(s, zoneId)!;
  let n = base;
  if (s.doubleNext && base >= 4) n = 5;
  if (s.flooded.includes(f.i)) n = Math.max(1, Math.ceil(n / 2));
  return n;
}

export type TierId = "full" | "matter" | "tired";
export function tierIdFor(n: number): TierId {
  if (n >= RULES.tiers[0]) return "full";
  if (n >= RULES.tiers[1]) return "matter";
  return "tired";
}

/** What the hall screen shows of a circle - the kit's snapshot() plus the timer's end so the hall counts down itself. */
export interface Snapshot {
  circle: number;
  stage: number;
  phase: Phase;
  zone: FaceKind;
  zoneTarget: ZoneId | null;
  here: FaceKind;
  tokens: Tokens;
  total: number;
  visited: ZoneId[];
  floods: number;
  dried: number;
  timeouts: number;
  effects: number;
  finished: boolean;
  standingCount: number;
  hasSentence: boolean;
  hasPhoto: boolean;
  seed: number;
  pos: number;
  finishedAt: number | null;
  flooded: number[];
  sunk: number[];
  usedHelpers: string[];
  bank: number;
  timerEnd: number | null;
  timerTotal: number | null;
  t: number;
}
export function snapshot(s: GameState, extra: Partial<Snapshot> = {}): Snapshot {
  const here = s.board.faces[s.pos].kind;
  return {
    circle: s.circle,
    stage: s.stage,
    phase: s.phase,
    zone: here,
    zoneTarget: s.zone ?? null,
    here,
    tokens: s.tokens,
    total: total(s),
    visited: s.visited,
    floods: s.stats.floods,
    dried: s.stats.dried,
    timeouts: s.stats.timeouts,
    effects: s.effects.length,
    finished: s.stage >= 7,
    standingCount: s.creations.standing.length,
    hasSentence: !!s.creations.sentence,
    hasPhoto: !!s.creations.photo,
    seed: s.seed,
    pos: s.pos,
    finishedAt: s.finishedAt ?? null,
    flooded: s.flooded,
    sunk: s.sunk,
    usedHelpers: s.usedHelpers,
    bank: s.bankLeft,
    timerEnd: s.timer ? s.timer.end : null,
    timerTotal: s.timer ? s.timer.total : null,
    t: Date.now(),
    ...extra,
  };
}
