// The diagnosis between the two "Advanced GenAI & Agentic AI for Developers"
// tracks. Both syllabi share a cover; the difference (the owner, 20/10):
//   advanced    - "מתקדם מאוד": already works in AI dev / took advanced courses,
//                 confident with the material, coverage matters more than drills.
//   foundations - "מהבסיס - כולל תרגול": wants to learn AI dev from the start,
//                 the basics matter to her.
// Each answer carries a score; the SUM decides (computed server-side in
// actions.ts - the client only displays). Friendly tone by request.

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
    title: "כמה את מרגישה בבית עם כתיבת קוד שעובד מול מודל שפה (API של Claude / OpenAI וכדומה)?",
    options: [
      { label: "כתבתי ואני זורמת עם זה — זה חלק מהעבודה שלי", score: 2 },
      { label: "התנסיתי קצת, עדיין מגששת", score: 1 },
      { label: "עוד לא יצא לי — ובדיוק בשביל זה אני כאן", score: 0 },
    ],
  },
  {
    id: "concepts",
    title: "מושגים כמו RAG, Embeddings ו-MCP —",
    options: [
      { label: "עובדת איתם או מכירה אותם היטב", score: 2 },
      { label: "קראתי ושמעתי, אבל לא התנסיתי לעומק", score: 1 },
      { label: "חדשים לי לגמרי — ובדיוק בשביל זה באתי ללמוד", score: 0 },
    ],
  },
  {
    id: "agents",
    title: "יצא לך לבנות סוכן AI או זרימת עבודה רב-שלבית שמפעילה כלים?",
    options: [
      { label: "כן, בניתי בעצמי", score: 2 },
      { label: "שיחקתי עם דוגמאות או ראיתי מקרוב", score: 1 },
      { label: "עדיין לא", score: 0 },
    ],
  },
  {
    id: "pace",
    title: "מה חשוב לך יותר בקורס?",
    hint: "אין תשובה נכונה — זו שאלה של סגנון.",
    options: [
      { label: "להספיק כמה שיותר חומר מתקדם, גם אם הקצב מהיר", score: 2 },
      { label: "שילוב — קצת מזה וקצת מזה", score: 1 },
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

export const TRACKS: Record<
  Recommendation,
  { badge: string; name: string; blurb: string; syllabus: string; file: string }
> = {
  advanced: {
    badge: "מתקדם מאוד",
    name: "Advanced GenAI & Agentic AI for Developers — המסלול המתקדם",
    blurb:
      "את כבר חיה את העולם הזה — המסלול המתקדם נבנה בדיוק בשבילך: קצב מהיר, מקסימום חומר, בלי לעצור לתרגול. MCP בקונטיינרים, Microsoft Agent Framework, Google ADK 2.0, LangChain/LangGraph, ניטור עם LangFuse והנדסת טוקנים.",
    syllabus: "/ai-course/syllabus-advanced.pdf",
    file: "hightecourse-ai-advanced-syllabus.pdf",
  },
  foundations: {
    badge: "מהבסיס — כולל תרגול",
    name: "Advanced GenAI & Agentic AI for Developers — מהבסיס, כולל תרגול",
    blurb:
      "המסלול הזה בונה אותך שלב-שלב: יסודות LLM וסוכנים, Prompt Engineering, MCP, Skills & Rules, סוכני-משנה ו-RAG — עם תרגול מעשי בכל פרק, כדי שהבסיס יישב חזק ותצאי בטוחה בחומר.",
    syllabus: "/ai-course/syllabus-foundations.pdf",
    file: "hightecourse-ai-foundations-syllabus.pdf",
  },
};
