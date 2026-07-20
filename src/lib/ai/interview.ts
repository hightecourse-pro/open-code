import { geminiJson, geminiText, type GeminiTurn } from "./gemini";
import type { InterviewAgent, InterviewDifficulty } from "@/types/database";

const AGENT_PERSONA: Record<InterviewAgent, string> = {
  hr: "את מגייסת HR חמה ומקצועית. את שואלת על מוטיבציה, רקע, עבודת צוות, התמודדות עם אתגרים וציפיות.",
  tech: "את מובילת צוות טכנית. את שואלת שאלות טכניות מותאמות לרמה — מושגי יסוד, חשיבה, פתרון בעיות וקוד.",
  friendly: "את מנטורית תומכת שמעבירה ראיון אימון רך ומחזק, ועוזרת למתאמנת להרגיש בנוח ולהשתפר.",
};

const DIFFICULTY: Record<InterviewDifficulty, string> = {
  basic: "רמה בסיסית — שאלות פתיחה ידידותיות, בלי לחץ.",
  standard: "רמה סטנדרטית לג'וניורית.",
  hard: "רמה מאתגרת — העמיקי עם שאלות המשך.",
};

export interface InterviewConfig {
  agent: InterviewAgent;
  difficulty: InterviewDifficulty;
  tech: string[];
}

export interface Turn {
  role: "agent" | "candidate";
  text: string;
}

function systemPrompt(cfg: InterviewConfig): string {
  const tech = cfg.tech.length ? cfg.tech.join(", ") : "כללי";
  return `את מראיינת בסימולטור ראיונות של "קוד פתוח" — קהילה לג'וניוריות בפיתוח.
${AGENT_PERSONA[cfg.agent]}
טכנולוגיות הראיון: ${tech}. ${DIFFICULTY[cfg.difficulty]}

כללים:
- עברית, לשון נקבה, קול חם ומקצועי.
- שאלה אחת בכל פעם. אחרי תשובה — תגובה קצרה (משפט) ואז שאלת ההמשך.
- אל תכתבי משוב מסכם או ציונים במהלך הראיון; המשוב יגיע בסוף בנפרד.
- החזירי אך ורק את ההודעה הבאה שלך כמראיינת, בלי הקדמות מטא.`;
}

/** Interviewer's next message given the conversation so far. */
export async function interviewReply(
  apiKey: string,
  cfg: InterviewConfig,
  turns: Turn[]
): Promise<string> {
  // Start from a user kickoff so roles alternate validly (agent→model).
  const contents: GeminiTurn[] = [
    { role: "user", text: "בואי נתחיל את הראיון." },
    ...turns.map((t): GeminiTurn => ({
      role: t.role === "agent" ? "model" : "user",
      text: t.text,
    })),
  ];

  return geminiText({
    apiKey,
    system: systemPrompt(cfg),
    contents,
    maxOutputTokens: 1024,
  });
}

export interface InterviewFeedback {
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

const FEEDBACK_SCHEMA = {
  type: "OBJECT",
  properties: {
    overall_score: { type: "INTEGER" },
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["overall_score", "summary", "strengths", "improvements"],
};

export async function interviewFeedback(
  apiKey: string,
  _cfg: InterviewConfig,
  turns: Turn[]
): Promise<InterviewFeedback> {
  const transcript = turns
    .map((t) => `${t.role === "agent" ? "מראיינת" : "מועמדת"}: ${t.text}`)
    .join("\n");

  return geminiJson<InterviewFeedback>({
    apiKey,
    system: `את מלווה מקצועית של "קוד פתוח". נתחי את הראיון ותני משוב מחזק ושימושי בעברית, בלשון נקבה.
overall_score: 0–100. summary: פסקה מסכמת חמה. strengths: 2–4 חוזקות. improvements: 2–4 נקודות לשיפור מנוסחות בעדינות.`,
    contents: [{ role: "user", text: `תמליל הראיון:\n${transcript}` }],
    jsonSchema: FEEDBACK_SCHEMA,
    maxOutputTokens: 2048,
  });
}
