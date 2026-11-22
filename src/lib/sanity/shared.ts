// ============================================================================
// המסע לאי השפיות · the shapes that travel between the server and the three
// screens (tablet, hall, studio). No server imports - usable from either side.
// ============================================================================
import type { Gender } from "./content";
import type { GameState, Snapshot } from "./engine";

export type HallScene = "auto" | "map" | "focus" | "compare" | "race" | "stats" | "grand";
export const HALL_SCENES: readonly HallScene[] = ["auto", "map", "focus", "compare", "race", "stats", "grand"] as const;

/** One run of the game, as every screen sees it. */
export interface EventInfo {
  slug: string;
  name: string;
  circles: number;
  gender: Gender;
  active: boolean;
  startedAt: string | null;
  resetAt: string | null;
  hallScene: HallScene;
  focusCircle: number | null;
  compare: [number, number] | null;
  reveal: boolean;
  createdAt: string;
}

/** A circle's hidden creations, without the photo itself (fetched from /api/sanity/photo/<slug>/<circle>?v=<photoAt>). */
export interface CreationMeta {
  circle: number;
  standing: number[];
  sentence: string;
  quad: Record<string, number> | null;
  hasPhoto: boolean;
  photoAt: string | null;
}

/** The hall screen's feed (and the studio's picture of the floor). */
export interface HallView {
  event: EventInfo | null;
  circles: Snapshot[];
  creations: CreationMeta[];
  /** The server's clock, so a screen with a wrong clock still counts the timers right. */
  now: number;
}

/** What the tablet gets when it opens its address. */
export interface TabletBootstrap {
  event: { slug: string; name: string; gender: Gender; circles: number };
  circle: number;
  state: GameState | null;
  version: number;
  resetAt: string | null;
  hasPhoto: boolean;
  now: number;
}

/** What the tablet sends on every change of its game. */
export interface TabletSave {
  version: number;
  state: GameState;
  snapshot: Snapshot;
  creations?: { standing: number[]; sentence: string; quad: Record<string, number> | null };
  /** A JPEG data URL (~60KB) - sent once, when the forest photo is taken. */
  photo?: string | null;
}
export type TabletSaveResult = { ok: true; version: number; now: number } | { ok: false; stale: true; state: GameState | null; version: number; resetAt: string | null } | { ok: false; error: string };

/** The studio's whole picture. */
export interface StudioView {
  events: EventInfo[];
  active: string | null;
  hall: HallView;
  /** The tablets' addresses of the active event - for whoever may manage the event only. */
  tokens: { circle: number; token: string }[];
  sunoConfigured: boolean;
  now: number;
}

export const TOKEN_RE = /^[a-f0-9]{12}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const tabletPath = (token: string) => `/sanity/t/${token}`;
export const photoPath = (slug: string, circle: number, v?: string | null) => `/api/sanity/photo/${slug}/${circle}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
