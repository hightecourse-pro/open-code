// ============================================================================
// The hidden creations (the kit's creations.js): the standing counts become a
// melody, the sentences a song, the forest photo a geometric shape (the
// circle's logo), and the shapes a kaleidoscope. All in the browser - WebAudio,
// canvas - no server. Imported by client components only.
// ============================================================================

export interface CreationInput {
  circle: number;
  standing?: number[];
  sentence?: string;
  photo?: string | null;
}

// ---------------------------------------------------------------
// 1. the melody
// ---------------------------------------------------------------
// how many stood (0–12) → a note of the pentatonic scale (always sounds right)
const PENTA = [0, 2, 4, 7, 9];
export function noteFor(count: number, max = 12): number {
  const deg = Math.round((Math.max(0, Math.min(max, count)) / max) * 12); // 0..12
  const oct = Math.floor(deg / 5),
    step = deg % 5;
  return 60 + oct * 12 + PENTA[step]; // MIDI, C4 = 60
}
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// the chords of the accompaniment: I – vi – IV – V (C major)
const PROG = [
  [48, 55, 64],
  [45, 52, 60],
  [41, 48, 57],
  [43, 50, 59],
];

export interface Note {
  t: number;
  d: number;
  m: number;
  v: number;
  hand: "l" | "r";
  circle?: number;
}
export interface Score {
  notes: Note[];
  length: number;
  order: { circle: number; start: number }[];
  sections: { kind: "chorus" | "verse"; start: number }[];
  beat: number;
}

// The hall's score. Every circle = 5 notes (5 statements of the reef) = a musical sentence of 2 bars: 4 quarters + a long note.
// The chorus = the hall's average per statement, in wide bars with full chords.
// Structure: opening (chorus) → a verse of 6 circles → chorus → verse → ... → a double chorus at the end.
export function buildScore(circles: CreationInput[], { beat = 0.5, perVerse = 6 } = {}): Score {
  const notes: Note[] = [];
  let t = 0;
  const order: Score["order"] = [];
  const sections: Score["sections"] = [];
  const L = circles.filter((c) => c.standing && c.standing.length);
  const N = 5;
  const avg = [...Array(N)].map((_, i) => {
    const v = L.map((c) => c.standing![i]).filter((x) => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 6;
  });
  const bar = (chord: number[], len = 4, v = 0.22) => chord.forEach((m, k) => notes.push({ t: t + k * 0.02, d: beat * len * 0.97, m, v, hand: "l" }));
  const chorus = (times = 1) => {
    for (let r = 0; r < times; r++) {
      sections.push({ kind: "chorus", start: t });
      const lens = [2, 2, 2, 2, 8];
      avg.forEach((v, i) => {
        if (i % 2 === 0 || i === 4) bar(PROG[(i >> 1) % PROG.length], i === 4 ? 8 : 4, 0.26);
        notes.push({ t, d: beat * lens[i] * 0.95, m: noteFor(v), v: 0.62, hand: "r" });
        notes.push({ t, d: beat * lens[i] * 0.95, m: noteFor(v) - 12, v: 0.3, hand: "r" });
        t += beat * lens[i];
      });
    }
  };
  chorus(1);
  L.forEach((c, ci) => {
    if (ci > 0 && ci % perVerse === 0) chorus(1);
    if (ci % perVerse === 0) sections.push({ kind: "verse", start: t });
    order.push({ circle: c.circle, start: t });
    const ph = c.standing!.slice(0, N);
    const lens = [1, 1, 1, 1, 4];
    bar(PROG[(ci * 2) % PROG.length]);
    ph.forEach((v, i) => {
      if (i === 4) bar(PROG[(ci * 2 + 1) % PROG.length]);
      notes.push({ t, d: beat * lens[i] * 0.95, m: noteFor(v), v: 0.55, hand: "r", circle: c.circle });
      t += beat * lens[i];
    });
  });
  if (L.length) chorus(2);
  return { notes, length: t + 2, order, sections, beat };
}

// a simple soft-piano synth
function voice(ctx: BaseAudioContext, dest: AudioNode, { t, d, m, v }: Note) {
  const f = midiToHz(m);
  const g = ctx.createGain();
  g.connect(dest);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.012);
  g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
  (
    [
      [1, "triangle", 1],
      [2, "sine", 0.35],
      [3, "sine", 0.12],
    ] as [number, OscillatorType, number][]
  ).forEach(([mul, type, amp]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mul;
    const og = ctx.createGain();
    og.gain.value = amp;
    o.connect(og);
    og.connect(g);
    o.start(t);
    o.stop(t + d + 0.7);
  });
}
function reverb(ctx: BaseAudioContext) {
  const len = ctx.sampleRate * 2.2,
    buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const c = ctx.createConvolver();
  c.buffer = buf;
  return c;
}
function graph(ctx: BaseAudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);
  const rv = reverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  rv.connect(wet);
  wet.connect(master);
  const bus = ctx.createGain();
  bus.connect(dry);
  bus.connect(rv);
  return bus;
}
export interface Player {
  ctx: AudioContext;
  stop(): void;
  t0: number;
}
export function playScore(score: Score, { onCircle }: { onCircle?: (circle: number) => void } = {}): Player {
  const ctx = new AudioContext();
  const bus = graph(ctx);
  const t0 = ctx.currentTime + 0.15;
  score.notes.forEach((n) => voice(ctx, bus, { ...n, t: t0 + n.t }));
  const timers = score.order.map((o) => setTimeout(() => onCircle && onCircle(o.circle), (o.start + 0.15) * 1000));
  return {
    ctx,
    stop() {
      timers.forEach(clearTimeout);
      ctx.close();
    },
    t0,
  };
}
export async function renderWav(score: Score): Promise<Blob> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * score.length), sr);
  const bus = graph(ctx);
  score.notes.forEach((n) => voice(ctx, bus, n));
  const buf = await ctx.startRendering();
  return wavBlob(buf);
}
function wavBlob(buf: AudioBuffer): Blob {
  const n = buf.length,
    ch = buf.numberOfChannels,
    out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v * 32767, true);
      o += 2;
    }
  return new Blob([out], { type: "audio/wav" });
}
// MIDI (for GarageBand / Logic / MuseScore)
export function midiBlob(score: Score): Blob {
  const tpq = 480,
    bpm = 60 / score.beat;
  const toTick = (s: number) => Math.round(s * (bpm / 60) * tpq);
  const evs: [number, number, number, number][] = [];
  score.notes.forEach((n) => {
    const chn = n.hand === "r" ? 0 : 1;
    evs.push([toTick(n.t), 0x90 | chn, n.m, Math.round(n.v * 127)]);
    evs.push([toTick(n.t + n.d), 0x80 | chn, n.m, 0]);
  });
  evs.sort((a, b) => a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0));
  const bytes: number[] = [];
  const vlq = (v: number) => {
    const b = [v & 0x7f];
    while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80);
    return b;
  };
  const us = Math.round(60e6 / bpm);
  bytes.push(0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255);
  let last = 0;
  evs.forEach(([t, s, a, b]) => {
    bytes.push(...vlq(t - last), s, a, b);
    last = t;
  });
  bytes.push(0, 0xff, 0x2f, 0);
  const hdr = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (tpq >> 8) & 255, tpq & 255];
  const trk = [0x4d, 0x54, 0x72, 0x6b, (bytes.length >> 24) & 255, (bytes.length >> 16) & 255, (bytes.length >> 8) & 255, bytes.length & 255];
  return new Blob([new Uint8Array([...hdr, ...trk, ...bytes])], { type: "audio/midi" });
}
/** A word for the melody's mood (goes into the Suno prompt). */
export function describeMelody(circles: CreationInput[]): string {
  const all = circles.flatMap((c) => c.standing || []);
  if (!all.length) return "";
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  return avg > 7 ? "hopeful, rising, communal" : avg > 4.5 ? "warm, reflective, gently rising" : "intimate, thoughtful, tender";
}

// ---------------------------------------------------------------
// 2. the song
// ---------------------------------------------------------------
export const SENTENCE_START = "בעולם שרץ מהר, אנחנו";
export const SONG_TITLE = "בעולם שרץ מהר";
const clean = (s: string | undefined) => (s || "").replace(/[״"׳']/g, "").replace(/\s+/g, " ").trim();
export interface Song {
  lines: { circle: number; text: string }[];
  chorus: string[];
  verses: { circle: number; text: string }[][];
  title: string;
  start: string;
}
export function buildSong(circles: CreationInput[]): Song {
  const lines = circles.filter((c) => clean(c.sentence)).map((c) => ({ circle: c.circle, text: clean(c.sentence) }));
  // the chorus: the 3 shortest, strongest lines
  const ranked = [...lines].sort((a, b) => a.text.split(" ").length - b.text.split(" ").length);
  const chorusLines = ranked.slice(0, Math.min(3, ranked.length));
  const rest = lines.filter((l) => !chorusLines.includes(l));
  const verses: Song["verses"] = [];
  for (let i = 0; i < rest.length; i += 4) verses.push(rest.slice(i, i + 4));
  const chorus = [SENTENCE_START, ...chorusLines.map((l) => `אנחנו ${l.text}`), SENTENCE_START];
  return { lines, chorus, verses, title: SONG_TITLE, start: SENTENCE_START };
}
export function lyricsText(song: Song, { tags = true } = {}): string {
  const out: string[] = [];
  const V = (i: number) => (tags ? `[Verse ${i}]` : `בית ${i}`);
  const C = tags ? "[Chorus]" : "פזמון";
  if (tags) out.push("[Intro]", "");
  song.verses.forEach((v, i) => {
    out.push(V(i + 1));
    v.forEach((l) => out.push(`אנחנו ${l.text}`));
    out.push("");
    if (i % 2 === 1 || i === song.verses.length - 1) {
      out.push(C);
      song.chorus.forEach((l) => out.push(l));
      out.push("");
    }
  });
  if (!song.verses.length) {
    out.push(C);
    song.chorus.forEach((l) => out.push(l));
    out.push("");
  }
  if (tags) {
    out.push("[Bridge]", "כל מעגל, קול אחד", "כל קול, שיר אחד", "", "[Final Chorus]");
    song.chorus.forEach((l) => out.push(l));
    out.push("", "[Outro]", song.start + "...");
  }
  return out.join("\n");
}
// ready prompts for Suno (3 styles); the words are planted automatically
export const SUNO_STYLES = [
  { id: "ballad", name: "בלדה חמה", style: "heartfelt Hebrew acoustic ballad, warm female vocals, soft female choir in chorus, piano and strings, gentle build, uplifting ending, {mood}, 84 bpm, C major, intimate, emotional, clear Hebrew diction" },
  { id: "anthem", name: "המנון אולם", style: "uplifting Hebrew pop anthem, powerful female lead vocals, big female choir, piano, warm strings, hand claps, stadium sing-along chorus, {mood}, 100 bpm, C major, celebratory, modern Israeli production" },
  { id: "soul", name: "נשמה שקטה", style: "soulful Jewish niggun-inspired song in Hebrew, female vocals with harmony, nylon guitar, soft piano, light percussion, Shabbat atmosphere, {mood}, 76 bpm, C major, spiritual, calm, tender" },
] as const;
export function sunoPack(circles: CreationInput[], styleId = "ballad") {
  const song = buildSong(circles);
  const st = SUNO_STYLES.find((s) => s.id === styleId) || SUNO_STYLES[0];
  const mood = describeMelody(circles) || "warm";
  return { title: song.title, style: st.style.replace("{mood}", mood), lyrics: lyricsText(song), exclude: "male vocals, rap, heavy drums, distortion, explicit", song };
}

// ---------------------------------------------------------------
// 3. photo → a geometric shape (the circle's logo)
// ---------------------------------------------------------------
/** The forest tiles' colours: blue (for), red (against), yellow (depends) - content.ts TASKS.forest.key. */
export const TILE = ["#26AAE1", "#E53935", "#FDD835"];
const hex2rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAL = TILE.map(hex2rgb);
function classify([r, g, b]: number[]): number {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  const sat = mx ? (mx - mn) / mx : 0;
  if (sat < 0.32 || mx < 60) return -1; // the floor, a shadow
  let best = -1,
    bd = 1e9;
  PAL.forEach((p, i) => {
    const d = (p[0] - r) ** 2 * 0.9 + (p[1] - g) ** 2 * 1.2 + (p[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return bd < 30000 ? best : -1;
}
export async function photoToLogo(src: string, { cells = 14 } = {}): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const W = 168,
    H = Math.round((W * img.height) / img.width);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, W, H);
  const px = x.getImageData(0, 0, W, H).data;
  const cw = W / cells,
    ch = cw * 0.866;
  const rows = Math.floor(H / ch);
  const tris: { pts: number[][]; col: string }[] = [];
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cells * 2; q++) {
      // alternating triangles (a triangular grid): like the magnetic tiles
      const up = (q + r) % 2 === 0;
      const x0 = (q / 2) * cw,
        y0 = r * ch;
      const pts = up
        ? [
            [x0, y0 + ch],
            [x0 + cw / 2, y0],
            [x0 + cw, y0 + ch],
          ]
        : [
            [x0, y0],
            [x0 + cw, y0],
            [x0 + cw / 2, y0 + ch],
          ];
      const votes = [0, 0, 0, 0];
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3,
        cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      for (let k = 0; k < 9; k++) {
        const sx = Math.round(cx + ((k % 3) - 1) * cw * 0.16),
          sy = Math.round(cy + (Math.floor(k / 3) - 1) * ch * 0.16);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const i = (sy * W + sx) * 4;
        votes[classify([px[i], px[i + 1], px[i + 2]]) + 1]++;
      }
      const win = votes.indexOf(Math.max(...votes)) - 1;
      if (win >= 0 && votes[win + 1] >= 4) tris.push({ pts, col: TILE[win] });
    }
  if (!tris.length) return null;
  let mnx = 1e9,
    mny = 1e9,
    mxx = -1e9,
    mxy = -1e9;
  tris.forEach((t) =>
    t.pts.forEach(([a, b]) => {
      mnx = Math.min(mnx, a);
      mny = Math.min(mny, b);
      mxx = Math.max(mxx, a);
      mxy = Math.max(mxy, b);
    }),
  );
  const s = 200 / Math.max(mxx - mnx, mxy - mny);
  const ox = (220 - (mxx - mnx) * s) / 2,
    oy = (220 - (mxy - mny) * s) / 2;
  const poly = tris.map((t) => `<polygon points="${t.pts.map(([a, b]) => `${((a - mnx) * s + ox).toFixed(1)},${((b - mny) * s + oy).toFixed(1)}`).join(" ")}" fill="${t.col}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">${poly}</svg>`;
}
/** A shape for a circle without a photo (built from its graph, so no circle is missing from the kaleidoscope). */
export function logoFromNumbers(nums: number[] | undefined, seed = 1): string {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let poly = "";
  const n = nums && nums.length ? nums : [4, 6, 8, 5, 7, 3, 9, 6];
  n.forEach((v, i) => {
    const a0 = (i / n.length) * Math.PI * 2,
      a1 = ((i + 1) / n.length) * Math.PI * 2;
    const rr = 40 + v * 5.5;
    const p = [
      [110, 110],
      [110 + Math.cos(a0) * rr, 110 + Math.sin(a0) * rr],
      [110 + Math.cos(a1) * rr, 110 + Math.sin(a1) * rr],
    ];
    poly += `<polygon points="${p.map((q) => q.map((x) => x.toFixed(1)).join(",")).join(" ")}" fill="${TILE[Math.floor(r() * 3)]}" stroke="#fff" stroke-width="2"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">${poly}</svg>`;
}
export const svgUrl = (svg: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

// ---------------------------------------------------------------
// 4. the kaleidoscope (canvas). Takes the circles' logos one by one.
// ---------------------------------------------------------------
export class Kaleido {
  c: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
  imgs: { im: HTMLImageElement; born: number }[] = [];
  run = false;
  bg = "#0E1A33";
  constructor(canvas: HTMLCanvasElement) {
    this.c = canvas;
    this.x = canvas.getContext("2d")!;
  }
  async add(svg: string) {
    const im = new Image();
    im.src = svgUrl(svg);
    await im.decode().catch(() => {});
    this.imgs.push({ im, born: performance.now() });
  }
  start() {
    if (this.run) return;
    this.run = true;
    const loop = (ts: number) => {
      if (!this.run) return;
      this.draw(ts);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() {
    this.run = false;
  }
  draw(ts: number) {
    const { c, x } = this;
    const W = c.width,
      H = c.height,
      R = Math.hypot(W, H) / 2;
    const N = 12; // 12 slices
    x.fillStyle = this.bg;
    x.fillRect(0, 0, W, H);
    if (!this.imgs.length) return;
    const t = ts / 1000;
    x.save();
    x.translate(W / 2, H / 2);
    for (let k = 0; k < N; k++) {
      x.save();
      x.rotate((k * Math.PI * 2) / N + t * 0.05);
      if (k % 2) x.scale(1, -1);
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, R, -Math.PI / N, Math.PI / N);
      x.closePath();
      x.clip();
      this.imgs.forEach((o, i) => {
        const age = Math.min(1, (ts - o.born) / 1500);
        const ring = (i % 6) + 1;
        const sz = 110 + (i % 3) * 36;
        const dist = ring * 0.15 * R + Math.sin(t * 0.4 + i) * 30;
        x.globalAlpha = age;
        x.save();
        x.translate(dist, ((i * 37) % 60) - 30);
        x.rotate(t * 0.25 + i);
        x.drawImage(o.im, -sz / 2, -sz / 2, sz, sz);
        x.restore();
      });
      x.restore();
    }
    x.restore();
    x.globalAlpha = 1;
    const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 0.5);
    g.addColorStop(0, "#ffffff22");
    g.addColorStop(1, "#ffffff00");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
}
