// The diagnosis between the two "Advanced GenAI & Agentic AI for Developers"
// tracks of the Hightecourse 2026 syllabus (the owner, 20/10):
//   advanced    - "מתקדם מאוד": no drills, the point is to cover more ground;
//                 for someone already deep in AI development.
//   foundations - "מהבסיס - כולל תרגול": advanced too, but starts from the
//                 basics with hands-on exercises; for someone not yet deep in it.
// Each answer carries a score; the SUM decides (computed server-side in
// actions.ts - the client only displays). Friendly tone by request.
//
// Wording rules: hyphens, never em dashes; Latin terms stand alone (no
// brackets or slashes between them) so RTL lines never scramble.

export interface QuizOption {
  label: string;
  score: 0 | 1 | 2;
}

export interface QuizQuestion {
  id: string;
  title: string;
  hint?: string;
  options: QuizOption[];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "llm_code",
    title: "כמה את מרגישה בבית בכתיבת קוד שעובד מול מודל שפה?",
    hint: "למשל דרך ה-API של Claude או OpenAI.",
    options: [
      { label: "כתבתי ואני זורמת עם זה - זה חלק מהעבודה שלי", score: 2 },
      { label: "התנסיתי קצת, עדיין מגששת", score: 1 },
      { label: "עוד לא יצא לי - ובדיוק בשביל זה אני כאן", score: 0 },
    ],
  },
  {
    id: "concepts",
    title: "איך את עם מושגים כמו RAG, Embeddings ו-MCP?",
    options: [
      { label: "עובדת איתם או מכירה אותם היטב", score: 2 },
      { label: "קראתי ושמעתי, אבל לא התנסיתי לעומק", score: 1 },
      { label: "חדשים לי לגמרי - ובדיוק בשביל זה באתי ללמוד", score: 0 },
    ],
  },
  {
    id: "agents",
    title: "יצא לך לבנות סוכן AI, או תהליך רב-שלבי שמפעיל כלים?",
    options: [
      { label: "כן, בניתי בעצמי", score: 2 },
      { label: "שיחקתי עם דוגמאות או ראיתי מקרוב", score: 1 },
      { label: "עדיין לא", score: 0 },
    ],
  },
  {
    id: "pace",
    title: "מה חשוב לך יותר בקורס?",
    hint: "אין תשובה נכונה - זו שאלה של סגנון.",
    options: [
      { label: "להספיק כמה שיותר חומר מתקדם, גם אם הקצב מהיר", score: 2 },
      { label: "שילוב - קצת מזה וקצת מזה", score: 1 },
      { label: "לבנות בסיס חזק, צעד-צעד, עם תרגול", score: 0 },
    ],
  },
  {
    id: "learning",
    title: "כשאת פוגשת טכנולוגיה חדשה, מה הכי מתאר אותך?",
    options: [
      { label: "צוללת פנימה לבד ומשלימה פערים תוך כדי תנועה", score: 2 },
      { label: "תלוי בנושא ובמצב הרוח", score: 1 },
      { label: "אוהבת הדרכה מסודרת ותרגול מובנה", score: 0 },
    ],
  },
];

export type Recommendation = "advanced" | "foundations";

export const COURSE_TITLE = "Advanced GenAI & Agentic AI for Developers";

export interface Track {
  /** The rotated yellow circle on the syllabus page, line by line. */
  badgeLines: string[];
  badge: string;
  subtitle: string;
  summary: string;
  /** Syllabus topics, in the syllabus' own (English) words. */
  topics: string[];
  prerequisites: string[] | null;
  syllabus: string;
  file: string;
}

export const TRACKS: Record<Recommendation, Track> = {
  advanced: {
    badgeLines: ["מתקדם", "מאוד"],
    badge: "מתקדם מאוד",
    subtitle: "המסלול המתקדם מאוד",
    summary: "קצב מהיר, מקסימום חומר, בלי לעצור לתרגול - למי שכבר חיה את העולם הזה ורוצה להגיע רחוק יותר.",
    topics: [
      "From GenAI to Agentic AI",
      "Agentic RAG",
      "MCP Server: build, secure, containerize",
      "Microsoft Agent Framework orchestration",
      "Agent Skills for .NET",
      "Google ADK 2.0",
      "LangFuse: LLM observability",
      "LangChain, LangGraph & LangSmith",
      "LLM token optimization",
    ],
    prerequisites: null,
    syllabus: "/ai-course/syllabus-advanced.pdf",
    file: "hightecourse-ai-advanced-syllabus.pdf",
  },
  foundations: {
    badgeLines: ["מהבסיס -", "כולל תרגול"],
    badge: "מהבסיס - כולל תרגול",
    subtitle: "המסלול מהבסיס - כולל תרגול",
    summary: "בונה אותך שלב אחר שלב מהיסודות, עם תרגול מעשי בכל פרק - כדי שהבסיס יישב חזק ותצאי בטוחה בחומר.",
    topics: [
      "LLM & Agent foundations",
      "Prompt engineering + lab",
      "MCP + core exercise",
      "Skills & Rules",
      "Subagents",
      "AGENTS.md & evaluations",
      "RAG, Vector search & GraphRAG + exercise",
      "LLM Wiki",
      "Wrap-up: an end-to-end agentic process",
    ],
    prerequisites: ["Node.js", "npm", "TypeScript", "Docker Desktop"],
    syllabus: "/ai-course/syllabus-foundations.pdf",
    file: "hightecourse-ai-foundations-syllabus.pdf",
  },
};

/** The track for a full set of scores: 0-10, a clear high is the fast track,
 *  a clear low is foundations, and the middle goes by what she wants from the
 *  course (the pace question). Pure - the server action calls it. */
export function recommendFor(scores: Record<string, number>): { score: number; recommendation: Recommendation } {
  const score = QUESTIONS.reduce((sum, q) => sum + (scores[q.id] ?? 0), 0);
  const recommendation: Recommendation =
    score >= 7 ? "advanced" : score <= 4 ? "foundations" : (scores["pace"] ?? 0) === 2 ? "advanced" : "foundations";
  return { score, recommendation };
}

/** Scores by question id (what the server stores) from the picked option indexes. */
export function scoresOf(picked: Record<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  QUESTIONS.forEach((q, i) => {
    const opt = q.options[picked[i]];
    if (opt) out[q.id] = opt.score;
  });
  return out;
}

/** One friendly sentence on why this track, from her own answers. Display only. */
export function reasonFor(rec: Recommendation, scores: Record<string, number>): string {
  const skill = (scores.llm_code ?? 0) + (scores.concepts ?? 0) + (scores.agents ?? 0);
  const pace = scores.pace ?? 0;
  if (rec === "advanced") {
    const a = skill >= 5 ? "כבר יש לך ניסיון מעשי עם מודלים וסוכנים" : "יש לך בסיס טוב בעולם הזה";
    const b = pace === 2 ? "ואת רוצה להספיק כמה שיותר" : pace === 1 ? "ושילוב של קצב וחומר מתאים לך" : "ואת מוכנה לקצב מהיר";
    return `${a}, ${b} - המסלול המתקדם ייתן לך את המקסימום.`;
  }
  const a = skill <= 2 ? "העולם הזה עוד חדש לך" : skill <= 4 ? "את מכירה חלק מהמושגים, אבל עוד לא לעומק" : "יש לך כבר ניסיון";
  const b = pace === 0 ? "ואת רוצה לבנות בסיס חזק עם תרגול" : pace === 1 ? "ושילוב של הסבר ותרגול מתאים לך" : "ותרגול מובנה יעשה לך סדר";
  return `${a}, ${b} - המסלול מהבסיס ייתן לך בדיוק את זה, בלי לדלג על שלבים.`;
}
