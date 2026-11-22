// ============================================================================
// The simulation (the kit's sim.js): 30 virtual circles ״play״ fast, so the
// hall screen and the reveal can be seen without tablets. Runs in the studio's
// browser and hands rows to the studio API ({action:"sim"}) every tick.
// ============================================================================
import { ZONE_IDS, type ZoneId } from "@/lib/sanity/content";
import { newGame, reachable, rollTide, type GameState, type Phase, type Snapshot, type Tokens } from "@/lib/sanity/engine";
import { TILE } from "@/lib/sanity/creations";

const SENTENCES = ["עוצרות להקשיב", "בוחרות מה חשוב", "מחזיקות ידיים", "שומרות על הלב", "נושמות לאט", "זוכרות מי אנחנו", "מדליקות נרות", "מקשיבות לשקט", "בונות בית", "שואלות שאלות", "חושבות לבד", "יוצרות ביחד", "עוצרות לשבת", "מסתכלות בעיניים", "כותבות בעצמנו", "מאמינות באדם", "בוחרות לאט", "שומרות זמן", "לא מוותרות", "רואות את האדם", "מחבקות חזק", "מגדלות ילדים", "סומכות על הלב", "צוחקות ביחד", "קמות מחדש", "מחפשות אמת", "נותנות מקום", "יודעות לעצור", "נשארות אנושיות", "שרות ביחד"];

/** A fake forest photo: tiles side by side on a floor (a JPEG data URL). */
export function fakeTilePhoto(seed: number): string {
  let s = seed * 9301 + 49297;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const c = document.createElement("canvas");
  c.width = 480;
  c.height = 360;
  const x = c.getContext("2d")!;
  x.fillStyle = ["#d8d0c2", "#cfc6b6", "#ddd6ca"][seed % 3];
  x.fillRect(0, 0, 480, 360);
  const sz = 40;
  let px = 240,
    py = 180;
  for (let i = 0; i < 30; i++) {
    x.fillStyle = TILE[Math.floor(r() * 3)];
    const t = Math.floor(r() * 3);
    px += (r() - 0.5) * 2 * sz;
    py += (r() - 0.5) * 2 * sz * 0.8;
    px = Math.max(50, Math.min(430, px));
    py = Math.max(50, Math.min(310, py));
    x.beginPath();
    if (t === 0) x.rect(px - sz / 2, py - sz / 2, sz, sz);
    else if (t === 1) {
      x.moveTo(px, py - sz / 2);
      x.lineTo(px + sz / 2, py + sz / 2);
      x.lineTo(px - sz / 2, py + sz / 2);
    } else {
      x.moveTo(px - sz / 2, py - sz / 2);
      x.lineTo(px - sz / 2, py + sz / 2);
      x.lineTo(px + sz / 2, py + sz / 2);
    }
    x.closePath();
    x.fill();
  }
  return c.toDataURL("image/jpeg", 0.7);
}

export interface SimRow {
  circle: number;
  snapshot: Snapshot;
  creations?: { standing: number[]; sentence: string; photo?: string | null };
}

interface SimCircle {
  g: GameState;
  circle: number;
  stage: number;
  phase: Phase;
  zone: string;
  tokens: Tokens;
  visited: ZoneId[];
  floods: number;
  dried: number;
  timeouts: number;
  pace: number;
  progress: number;
  standing: number[];
  sentence: string;
  photo: string | null;
  finishedAt: number | null;
}

export class Sim {
  st: SimCircle[] = [];
  speed: number;
  constructor(circles = 30, speed = 1) {
    this.speed = speed;
    for (let n = 1; n <= circles; n++) {
      const tokens = Object.fromEntries(ZONE_IDS.map((z) => [z, 1])) as Tokens;
      const g = newGame(n, 7000 + n);
      this.st.push({ g, circle: n, stage: 0, phase: "welcome", zone: "start", tokens, visited: [], floods: 0, dried: 0, timeouts: 0, pace: 0.6 + Math.random() * 0.8, progress: Math.random() * -2, standing: [], sentence: "", photo: null, finishedAt: null });
    }
  }
  /** One step of every circle; returns what changed, for the API. */
  tick(): SimRow[] {
    const bias = [6, 7, 8, 3, 6]; // a leaning per statement of the reef
    const rows: SimRow[] = [];
    this.st.forEach((c) => {
      if (c.stage >= 7) return;
      c.progress += c.pace * 0.22 * this.speed;
      const stage = Math.max(0, Math.min(7, Math.floor(c.progress)));
      let creations: SimRow["creations"] | undefined;
      if (stage > c.stage) {
        // the previous island ends
        if (c.stage >= 1 && c.zone && c.zone !== "start" && (ZONE_IDS as readonly string[]).includes(c.zone)) {
          const z = c.zone as ZoneId;
          const ok = Math.random() > 0.12;
          const flooded = Math.random() < 0.25;
          let gain = ok ? 4 : 1;
          if (flooded && ok) gain = 2;
          if (z === "lake" && ok && Math.random() < 0.4) gain = 5;
          c.tokens[z] += gain;
          c.visited.push(z);
          if (!ok) c.timeouts++;
          if (z === "reef") {
            c.standing = bias.map((b) => Math.max(0, Math.min(12, Math.round(b + (Math.random() - 0.5) * 6))));
            creations = { standing: c.standing, sentence: c.sentence, photo: null };
          }
          if (z === "safari") {
            c.sentence = SENTENCES[(c.circle * 7) % SENTENCES.length];
            creations = { standing: c.standing, sentence: c.sentence, photo: null };
          }
          if (z === "forest") {
            c.photo = fakeTilePhoto(c.circle);
            creations = { standing: c.standing, sentence: c.sentence, photo: c.photo };
          }
        }
        c.stage = stage;
        if (stage >= 1 && stage <= 6) {
          const G = c.g;
          G.stage = stage;
          G.visited = c.visited.slice();
          rollTide(G);
          const r = reachable(G);
          const ti = r.targets[Math.floor(Math.random() * r.targets.length)];
          if (ti !== undefined) {
            G.pos = ti;
            c.zone = G.board.faces[ti].kind;
          }
          c.phase = "task";
          if ([2, 4].includes(stage)) c.floods++;
          if (Math.random() < 0.1) c.dried++;
        }
        if (stage === 7) {
          c.g.pos = c.g.board.goal;
          c.finishedAt = Date.now();
          c.zone = "goal";
          c.phase = "invite";
          if (Math.random() < 0.5) {
            c.tokens.lake++;
            c.tokens.observatory++;
          }
        }
      }
      const total = Object.values(c.tokens).reduce((a, b) => a + b, 0);
      const frac = c.progress - Math.floor(c.progress);
      const inTask = c.stage >= 1 && c.stage <= 6;
      const remaining = inTask ? Math.round((1 - frac) * 600) : null;
      const here = c.g.board.faces[c.g.pos].kind;
      const snapshot: Snapshot = {
        circle: c.circle,
        stage: c.stage,
        phase: c.phase,
        zone: here,
        zoneTarget: (ZONE_IDS as readonly string[]).includes(c.zone) ? (c.zone as ZoneId) : null,
        here,
        tokens: c.tokens,
        total,
        visited: c.visited,
        floods: c.floods,
        dried: c.dried,
        timeouts: c.timeouts,
        effects: 0,
        finished: c.stage >= 7,
        standingCount: c.standing.length,
        hasSentence: !!c.sentence,
        hasPhoto: !!c.photo,
        seed: c.g.seed,
        pos: c.g.pos,
        finishedAt: c.finishedAt,
        flooded: c.g.flooded,
        sunk: [],
        usedHelpers: [],
        bank: 10,
        timerEnd: remaining != null ? Date.now() + remaining * 1000 : null,
        timerTotal: remaining != null ? 600 : null,
        t: Date.now(),
      };
      rows.push(creations ? { circle: c.circle, snapshot, creations } : { circle: c.circle, snapshot });
    });
    return rows;
  }
  get done(): boolean {
    return this.st.every((c) => c.stage >= 7);
  }
}
