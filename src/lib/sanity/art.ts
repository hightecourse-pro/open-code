// ============================================================================
// The drawings in the illustrator's language (the kit's art.js): a thin
// coloured line and the same shape filled white, shifted a little (an offset
// print). SVG strings, for the hall screen and the studio (set as innerHTML).
// ============================================================================
import { COLORS, RESOURCE_OF, ZONE_IDS, isZoneId, type FaceKind, type ZoneId } from "./content";
import type { Face } from "./engine";

export const ASSETS = "/sanity";
export const NAMES: Record<FaceKind, string> = { cave: "המערה", lake: "האגם", forest: "היער", observatory: "מצפה הכוכבים", reef: "ריף האלמוגים", safari: "הספארי", start: "התחלה", goal: "אי השפיות", lighthouse: "המגדלור", fog: "הערפל", market: "שוק החליפין", bank: "הבנק" };
export const nameOf = (id: string): string => (NAMES as Record<string, string>)[id] ?? id;
let n = 0;
const uid = (p = "g") => `${p}${++n}`;

/** A shape with a white offset: d = path, c = the line's colour. */
export function offsetPath(d: string, c: string, { sw = 3, dx = 5, dy = 4, fill = "#fff", fillOpacity = 1 } = {}): string {
  return `<path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" transform="translate(${dx} ${dy})"/>` + `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function cloud(w = 220, op = 0.7): string {
  const d = "M30 70 C10 70 6 44 26 40 C24 18 52 10 64 26 C72 4 112 4 118 30 C140 22 160 40 150 58 C166 62 162 80 146 80 L36 80 C28 80 26 72 30 70Z";
  return `<svg viewBox="0 0 170 90" width="${w}" aria-hidden="true"><path d="${d}" fill="#fff" fill-opacity="${op}"/></svg>`;
}

// ---------- the resources' symbols (as on the illustrator's tags) ----------
const SYM: Record<ZoneId, (c: string) => string> = {
  cave: (c) => `<path d="M50 30 L70 50 L50 70 L30 50Z" fill="${c}"/>`,
  lake: (c) => `<circle cx="50" cy="50" r="17" fill="none" stroke="${c}" stroke-width="8"/>`,
  forest: (c) => `<circle cx="40" cy="50" r="11" fill="${c}"/><circle cx="60" cy="50" r="11" fill="${c}"/>`,
  observatory: (c) => `<path d="M50 28 L56 43 L72 44 L60 54 L64 70 L50 61 L36 70 L40 54 L28 44 L44 43Z" fill="${c}"/>`,
  reef: (c) => `<path d="M30 36 L50 50 L30 64Z M70 36 L50 50 L70 64Z" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="50" r="5" fill="${c}"/>`,
  safari: (c) => `<path d="M38 28 L62 28 L62 72 L50 62 L38 72Z" fill="${c}"/>`,
};
export function symbol(id: ZoneId, size = 40, c: string = COLORS[id]): string {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${SYM[id] ? SYM[id](c) : ""}</svg>`;
}

/** A token: a white coin with a coloured rim and a thickness on the side. */
export function token(id: ZoneId, size = 50): string {
  const c = COLORS[id];
  return `<svg viewBox="0 0 100 106" width="${size}" height="${size * 1.06}" role="img" aria-label="${RESOURCE_OF[id] ?? ""}">
    <circle cx="50" cy="57" r="44" fill="${c}" opacity=".85"/><circle cx="50" cy="50" r="44" fill="#fff" stroke="${c}" stroke-width="4"/>
    <circle cx="50" cy="50" r="33" fill="color-mix(in srgb, ${c} 8%, #fff)" stroke="${c}" stroke-width="1.6"/>
    <g transform="translate(18 18) scale(.64)">${SYM[id](c)}</g></svg>`;
}

/** A face of a board for the map views. */
export function faceSVG(face: Face, scale: number, { state = "", showIcon = true, label = false } = {}): string {
  const k = face.kind;
  const c = COLORS[k] || "#0062AF";
  const pts = face.pts.map(([x, y]) => `${(x * scale).toFixed(1)},${(y * scale).toFixed(1)}`).join(" ");
  const [cx, cy] = [face.c[0] * scale, face.c[1] * scale];
  const inner = face.pts
    .map(([x, y]) => {
      const ix = face.c[0] + (x - face.c[0]) * 0.86,
        iy = face.c[1] + (y - face.c[1]) * 0.86;
      return `${(ix * scale).toFixed(1)},${(iy * scale).toFixed(1)}`;
    })
    .join(" ");
  const gid = uid("fg");
  const flooded = state.includes("flood"),
    done = state.includes("done"),
    sunk = state.includes("sunk"),
    grayscale = state.includes("gray");
  let body = `<defs><linearGradient id="${gid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity=".07"/><stop offset="1" stop-color="${c}" stop-opacity=".42"/></linearGradient></defs>`;
  body += `<polygon points="${pts}" fill="#fff"/><polygon points="${pts}" fill="url(#${gid})"/>`;
  body += `<polygon points="${pts}" fill="none" stroke="${c}" stroke-width="${Math.max(3, scale * 0.06)}" stroke-linejoin="round"/>`;
  body += `<polygon points="${inner}" fill="none" stroke="#fff" stroke-width="${Math.max(1.5, scale * 0.02)}"/>`;
  if (done) {
    body += `<text x="${cx}" y="${cy + scale * 0.22}" text-anchor="middle" font-size="${scale * 0.62}" font-weight="700" fill="${c}" font-family="Rag Sans">${face.num}</text>`;
  } else if (showIcon) {
    const xs = face.pts.map((p) => p[0] * scale),
      ys = face.pts.map((p) => p[1] * scale),
      cid = uid("fc");
    body += `<clipPath id="${cid}"><polygon points="${pts}"/></clipPath><image href="${ASSETS}/islands/${k}_tile.jpg" x="${Math.min(...xs)}" y="${Math.min(...ys)}" width="${Math.max(...xs) - Math.min(...xs)}" height="${Math.max(...ys) - Math.min(...ys)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/><polygon points="${pts}" fill="none" stroke="${c}" stroke-width="${Math.max(3, scale * 0.06)}" stroke-linejoin="round"/>`;
  }
  if (label && showIcon && !done) body += `<rect x="${cx - scale * 0.5}" y="${cy + scale * 0.46}" width="${scale}" height="${scale * 0.24}" rx="${scale * 0.12}" fill="#fff" opacity=".92"/>`;
  if (label) body += `<text x="${cx}" y="${cy + scale * 0.62}" text-anchor="middle" font-size="${scale * 0.2}" font-weight="700" fill="${c}" font-family="Rag Sans">${nameOf(k)}</text>`;
  if (flooded) body += `<polygon points="${pts}" fill="#26AAE1" fill-opacity=".55"/>` + wavesIn(cx, cy, scale);
  if (sunk) body = `<polygon points="${pts}" fill="#26AAE1" fill-opacity=".18" stroke="#26AAE1" stroke-dasharray="6 6" stroke-width="2"/>`;
  return `<g class="map-face" data-i="${face.i}" style="filter:${grayscale && !done ? "grayscale(.75) opacity(.7)" : "none"}">${body}</g>`;
}
function wavesIn(cx: number, cy: number, s: number): string {
  let g = "";
  [-0.22, 0.02, 0.26].forEach((dy) => {
    let d = `M${cx - s * 0.36} ${cy + s * dy}`;
    for (let i = 0; i < 4; i++) d += ` q ${s * 0.09} ${-s * 0.08} ${s * 0.18} 0`;
    g += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${s * 0.035}" stroke-linecap="round"/>`;
  });
  return g;
}

// ---------- line icons (3px) with a white offset ----------
const ICONS: Record<string, string> = {
  pair: "M34 30 a10 10 0 1 1 -0.1 0z M66 30 a10 10 0 1 1 -0.1 0z M16 78 c0 -16 8 -26 18 -26 s18 10 18 26 M48 78 c0 -16 8 -26 18 -26 s18 10 18 26",
  group: "M50 24 a9 9 0 1 1 -0.1 0z M22 38 a8 8 0 1 1 -0.1 0z M78 38 a8 8 0 1 1 -0.1 0z M34 78 c0 -16 7 -26 16 -26 s16 10 16 26 M8 80 c0 -12 6 -20 14 -20 s12 4 14 8 M92 80 c0 -12 -6 -20 -14 -20 s-12 4 -14 8",
  screen: "M12 20 h76 v48 h-76z M40 82 h20 M50 68 v14 M22 52 q8 -14 16 0 t16 0 t16 0",
  check: "M50 14 a36 36 0 1 1 -0.1 0z M34 50 l12 12 l22 -24",
  wave: "M50 14 a36 36 0 1 1 -0.1 0z M24 54 q6.5 -10 13 0 t13 0 t13 0 t13 0",
  clock: "M50 14 a36 36 0 1 1 -0.1 0z M50 26 v24 h16",
  star: "M50 14 a36 36 0 1 1 -0.1 0z M50 30 l6 13 l14 1 l-11 9 l4 14 l-13 -8 l-13 8 l4 -14 l-11 -9 l14 -1z",
  sail: "M50 14 a36 36 0 1 1 -0.1 0z M48 28 v34 h-18z M52 34 l16 28 h-16z M30 68 h40",
  flag: "M50 14 a36 36 0 1 1 -0.1 0z M38 70 v-42 M38 30 h28 l-6 9 l6 9 h-28",
  camera: "M14 32 h18 l6 -10 h24 l6 10 h18 v46 h-72z M50 40 a14 14 0 1 1 -0.1 0z",
  speech: "M18 22 h64 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-38 l-16 14 v-14 h-10 a8 8 0 0 1 -8 -8 v-34 a8 8 0 0 1 8 -8z M30 40 h40 M30 54 h28",
  tiles: "M14 60 h28 v28 h-28z M48 88 l16 -28 l16 28z M30 54 l14 -26 l14 26z M58 52 h28 v-28z",
  timer: "M50 26 a32 32 0 1 1 -0.1 0z M42 12 h16 M50 12 v14 M50 58 v-18 M50 58 l12 8",
  bag: "M30 34 c-14 18 -18 52 20 54 c38 -2 34 -36 20 -54z M34 34 c4 -8 28 -8 32 0 M36 22 c6 6 22 6 28 0 l-6 12 h-16z",
  hand: "M38 88 v-50 a6 6 0 0 1 12 0 v24 v-34 a6 6 0 0 1 12 0 v34 v-28 a6 6 0 0 1 12 0 v30 v-18 a6 6 0 0 1 12 0 v26 c0 18 -10 30 -28 30 h-6 c-12 0 -18 -6 -24 -14 l-14 -20 a6 6 0 0 1 10 -6 z",
  sheets: "M20 30 l20 -12 l20 12 v22 l-20 12 l-20 -12z M40 34 l20 -12 l20 12 v22 l-20 12 l-20 -12z",
  cards: "M22 28 h34 v48 h-34z M34 22 h34 v48 h-34z M46 16 h34 v48 h-34z",
};
export function icon(name: string, size = 80, c = "#0062AF", sw = 3.2): string {
  const d = ICONS[name];
  if (!d) return "";
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${offsetPath(d, c, { sw, dx: 4, dy: 3.5 })}</svg>`;
}

export const logo = (w = 220): string => `<img src="${ASSETS}/logo.png" width="${w}" alt="המסע לאי השפיות">`;

/** A preposition before a name: ל + הערפל = לערפל, ב + המערה = במערה. */
export const prep = (p: string, name: string): string => p + String(name).replace(/^ה(?=[א-ת])/, "");

export const zoneIds = ZONE_IDS;
export const isZone = isZoneId;
