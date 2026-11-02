// The employers' portal of the hackathon projects (the owner, 1/11: ״פורטל שיווקי נח… עבור
// מעסיקים שירצו לראות את הפרויקטים שהוגשו להאקתון״). The data is STATIC: the printed booklet's
// approved texts (the blurb = ״מה שמעבר לאתגר״, the technologies line, one personal quote per
// member, the Hebrew spellings) plus every submission's links - built by tools/showcase-build.mjs
// from media/hackathon-2026/catalog + production. A text change goes through the booklet files
// and a rebuild, never by hand here. Nothing judged (scores, the AI review) is in this file.
import data from "@/data/hackathon-2026-projects.json";

export type ChallengeKey = "strauss" | "virology" | "phoenix";
export const CHALLENGE_ORDER: ChallengeKey[] = ["strauss", "virology", "phoenix"];
export const SHOWCASE_PATH = "/hackathon-2026/projects";

/** Every source we hold for the demo video: the Drive mirror and the uploaded file stream through our own domain; the participant's own link is external. */
export interface ShowcaseVideo {
  drive?: string;
  storage?: string;
  link?: string;
}

export interface ShowcaseProject {
  /** The first 8 characters of the team key - the public id of the project (unique across the 60). */
  k8: string;
  teamKey: string;
  challenge: ChallengeKey;
  members: { id: string; name: string }[];
  /** ״מה שמעבר לאתגר״ - the booklet's text. */
  blurb: string;
  tech: string[];
  quotes: { id: string; name: string; quote: string }[];
  productUrl: string | null;
  video: ShowcaseVideo | null;
  image: string | null;
  caption: string | null;
  submittedAt: string | null;
}

export interface ChallengeInfo {
  key: ChallengeKey;
  /** The booklet's title of the challenge. */
  title: string;
  short: string;
  org: string;
  emoji: string;
  logos: string[];
  /** The booklet's one-paragraph description. */
  blurb: string;
  /** The booklet's ״שלושה סוגים של AI״ label. */
  pattern: string;
  /** Card tint + hard-shadow colour, in the challenge's own hue. */
  tint: string;
  shadow: string;
}

/** The printed booklet's words (26-27/10), verbatim. */
export const CHALLENGE_INFO: Record<ChallengeKey, ChallengeInfo> = {
  strauss: {
    key: "strauss",
    title: "יועץ הרכב של שטראוס",
    short: "שטראוס",
    org: "קבוצת שטראוס",
    emoji: "🚗",
    logos: ["/hackathon-2026/logo-strauss.png"],
    blurb:
      "סוכן שיחה שעוזר לעובדות שטראוס לבחור רכב: מנהל שיחה בשפה טבעית, אוסף רק את מה שחסר, מחשב בקוד מה יקרה לנטו של החודש הבא, ושואל את נציג התחבורה במקום לנחש.",
    pattern: "סוכן עם כלים וחישוב בקוד",
    tint: "bg-tint-mint/40",
    shadow: "#CFE6D8",
  },
  virology: {
    key: "virology",
    title: "המעבדה המרכזית לנגיפים - טפסי התחייבות",
    short: "המעבדה המרכזית לנגיפים",
    org: "משרד הבריאות · המרכז הרפואי שיבא",
    emoji: "🧬",
    // the lab's logo only (the owner, 2/11: ״תוריד את הלוגו של משרד הבריאות״)
    logos: ["/hackathon-2026/logo-virology.png"],
    blurb:
      "עשרות טפסי התחייבות סרוקים ביום, בכתב יד ובחותמות. המערכות קוראות אותם, ממלאות שבעה שדות מובנים, מסמנות בכנות את מה שלא בטוח, ומשאירות את ההחלטה לבודקת - ואז מייצאות לאקסל של המעבדה.",
    pattern: "קריאת מסמכים עם בקרה אנושית",
    tint: "bg-white",
    shadow: "#F3C6DD",
  },
  phoenix: {
    key: "phoenix",
    title: "הבוט של הפניקס",
    short: "הפניקס",
    org: "קבוצת הפניקס",
    emoji: "🔥",
    logos: ["/hackathon-2026/logo-phoenix.png"],
    blurb:
      "בוט שעונה ללקוחות הפניקס רק מתוך אתר הפניקס: מאתר את הקטע הנכון, עונה בשפה פשוטה, מצטט מקור, ויודע להגיד ״לא כתוב באתר״ במקום להמציא.",
    pattern: "תשובות מתוך גוף ידע (RAG)",
    tint: "bg-tint-warm/50",
    shadow: "#F7D9B8",
  },
};

export const PROJECTS: ShowcaseProject[] = data.projects as unknown as ShowcaseProject[];
export const COUNTS: { projects: number; people: number; challenges: number; institutions?: number } = data.counts;

/** One row of the numbers dashboard: a name, how many projects, and (for a link) the filter value. */
export interface StatRow {
  name: string;
  count: number;
}

export interface ShowcaseStats {
  /** Distinct technologies across the booklet's technology lines. */
  tech: number;
  /** Technologies per project, rounded. */
  avgTech: number;
  byChallenge: { key: ChallengeKey; count: number }[];
  topTech: StatRow[];
  /** Projects built by one member / by a pair. */
  solo: number;
  pairs: number;
  /** Projects whose product runs on an AI model (a project can use several). */
  models: StatRow[];
  /** Where the live systems run, by the product URL's host. */
  hosts: StatRow[];
  /** Projects with a live system in the cloud / with a demo video. */
  live: number;
  videos: number;
}

const HOSTS: [RegExp, string][] = [
  [/onrender\.com$/i, "Render"],
  [/vercel\.app$/i, "Vercel"],
  [/streamlit\.app$/i, "Streamlit"],
  [/railway\.app$/i, "Railway"],
];
const MODELS: [RegExp, string][] = [
  [/gemini/i, "Gemini"],
  [/^claude$/i, "Claude"],
  [/openai|gpt/i, "OpenAI / GPT"],
];

function buildStats(): ShowcaseStats {
  const tech = new Map<string, number>();
  for (const p of PROJECTS) for (const t of p.tech) tech.set(t, (tech.get(t) ?? 0) + 1);
  const hosts = new Map<string, number>();
  for (const p of PROJECTS) {
    let host = "";
    try {
      host = p.productUrl ? new URL(p.productUrl).hostname : "";
    } catch {
      host = "";
    }
    const name = HOSTS.find(([re]) => re.test(host))?.[1] ?? "אחר";
    hosts.set(name, (hosts.get(name) ?? 0) + 1);
  }
  const hostRows = [...hosts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === "אחר" ? 1 : b.name === "אחר" ? -1 : b.count - a.count));
  const techTotal = PROJECTS.reduce((n, p) => n + p.tech.length, 0);
  return {
    tech: tech.size,
    avgTech: Math.round(techTotal / Math.max(1, PROJECTS.length)),
    byChallenge: CHALLENGE_ORDER.map((key) => ({ key, count: PROJECTS.filter((p) => p.challenge === key).length })),
    topTech: topTech(10),
    solo: PROJECTS.filter((p) => p.members.length === 1).length,
    pairs: PROJECTS.filter((p) => p.members.length > 1).length,
    models: MODELS.map(([re, name]) => ({ name, count: PROJECTS.filter((p) => p.tech.some((t) => re.test(t))).length })).filter((r) => r.count > 0),
    hosts: hostRows,
    live: PROJECTS.filter((p) => !!p.productUrl).length,
    videos: PROJECTS.filter((p) => !!p.video).length,
  };
}

/** The numbers dashboard's figures - computed once from the static dataset. */
export const STATS: ShowcaseStats = buildStats();

export const isChallengeKey = (v: unknown): v is ChallengeKey => typeof v === "string" && (CHALLENGE_ORDER as string[]).includes(v);

export function projectByK8(k8: string): ShowcaseProject | null {
  return PROJECTS.find((p) => p.k8 === k8) ?? null;
}

export function projectsOf(challenge: ChallengeKey): ShowcaseProject[] {
  return PROJECTS.filter((p) => p.challenge === challenge);
}

/** The team as the booklet names it: ״רבקה סבו + שני לבין״. */
export function teamName(p: ShowcaseProject): string {
  return p.members.map((m) => m.name).join(" + ");
}

export function hasStream(p: ShowcaseProject): boolean {
  return !!(p.video?.drive || p.video?.storage);
}

/** The technologies by how many projects used them. */
export function topTech(n = 14): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of PROJECTS) for (const t of p.tech) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Search text: lower-case, no Hebrew/Latin quote marks, no diacritics, one space between words. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[״׳"'`’‘]/g, "")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[\/,.;:()\[\]{}|+·-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const haystacks = new Map<string, string>();
/** Everything a free-text search may hit: names, technologies, the blurb, the quotes, the challenge, the id. */
export function haystackOf(p: ShowcaseProject): string {
  const hit = haystacks.get(p.k8);
  if (hit) return hit;
  const c = CHALLENGE_INFO[p.challenge];
  const h = normalize(
    [p.k8, ...p.members.map((m) => m.name), ...p.tech, p.blurb, ...p.quotes.map((q) => q.quote), c.title, c.short, c.org, c.pattern, c.key].join(" "),
  );
  haystacks.set(p.k8, h);
  return h;
}

/** Every word of the query must appear somewhere in the project. */
export function matchesQuery(p: ShowcaseProject, q: string): boolean {
  const words = normalize(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const h = haystackOf(p);
  return words.every((w) => h.includes(w));
}

export interface ShowcaseFilter {
  challenge?: ChallengeKey | "" | null;
  q?: string | null;
  tech?: string[] | null;
}

export function filterProjects(list: ShowcaseProject[], f: ShowcaseFilter): ShowcaseProject[] {
  const tech = (f.tech ?? []).map(normalize).filter(Boolean);
  return list.filter((p) => {
    if (f.challenge && p.challenge !== f.challenge) return false;
    if (tech.length) {
      const mine = p.tech.map(normalize);
      if (!tech.every((t) => mine.includes(t))) return false;
    }
    return matchesQuery(p, f.q ?? "");
  });
}
