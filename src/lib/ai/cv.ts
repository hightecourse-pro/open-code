import { geminiJson } from "./gemini";

export interface CvInsight {
  type: "good" | "warn" | "bad" | "tip";
  title: string;
  detail: string;
}

export interface CvAnalysis {
  score: number;
  summary: string;
  insights: CvInsight[];
  job_fit: { score: number; matched: string[]; missing: string[] } | null;
}

// Gemini responseSchema (OpenAPI subset).
const SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    summary: { type: "STRING" },
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["good", "warn", "bad", "tip"] },
          title: { type: "STRING" },
          detail: { type: "STRING" },
        },
        required: ["type", "title", "detail"],
      },
    },
    job_fit: {
      type: "OBJECT",
      nullable: true,
      properties: {
        score: { type: "INTEGER" },
        matched: { type: "ARRAY", items: { type: "STRING" } },
        missing: { type: "ARRAY", items: { type: "STRING" } },
      },
    },
  },
  required: ["score", "summary", "insights"],
};

const SYSTEM = `את מלווה מקצועית חמה ותומכת של "קוד פתוח" — קהילה לג'וניוריות בפיתוח.
את עוברת על קורות חיים של מתכנתת ג'וניורית ונותנת משוב מקצועי, כן ומחזק, בגישה של אחות גדולה.
כל הפלט בעברית, בלשון נקבה. בלי להתנשא ובלי לרכך יותר מדי — משוב שימושי שיעזור לה להשתפר.
score: ציון כללי 0–100. summary: פסקה חמה ומעודדת. insights: 4–7 תובנות (type: good/warn/bad/tip + title + detail).
job_fit: אם סופק תיאור משרה — score התאמה 0–100, matched (מתאים), missing (חסר); אחרת null.`;

export async function analyzeCv(
  apiKey: string,
  cvText: string,
  jobDescription?: string
): Promise<CvAnalysis> {
  const user = jobDescription
    ? `קורות החיים:\n${cvText}\n\n---\nתיאור המשרה (לבדיקת התאמה):\n${jobDescription}`
    : `קורות החיים:\n${cvText}`;

  return geminiJson<CvAnalysis>({
    apiKey,
    system: SYSTEM,
    contents: [{ role: "user", text: user }],
    jsonSchema: SCHEMA,
    maxOutputTokens: 2048,
  });
}

/** Analyze a CV uploaded as a PDF file (base64), instead of pasted text. */
export async function analyzeCvPdf(
  apiKey: string,
  pdfBase64: string,
  jobDescription?: string
): Promise<CvAnalysis> {
  const user = jobDescription
    ? `קורות החיים מצורפים כקובץ PDF. נתחי אותם.\n\n---\nתיאור המשרה (לבדיקת התאמה):\n${jobDescription}`
    : `קורות החיים מצורפים כקובץ PDF. נתחי אותם.`;

  return geminiJson<CvAnalysis>({
    apiKey,
    system: SYSTEM,
    contents: [
      { role: "user", text: user, inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    ],
    jsonSchema: SCHEMA,
    maxOutputTokens: 2048,
  });
}
