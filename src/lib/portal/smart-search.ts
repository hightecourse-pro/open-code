// Natural-language candidate search: "בוגרת בוטקאמפ עם React ואנגלית שוטפת"
// becomes a structured filter over the employer-visible profile fields.
//
// Runs on the community's shared key pool (admin-managed), never on a
// member's personal key.

import { geminiJson } from "@/lib/ai/gemini";
import { withPoolKey } from "@/lib/ai/system-keys";
import type { CandidateDetail } from "./types";

export interface SmartQuery {
  /** question key → values that must match (OR within, AND across). */
  filters: Record<string, string[]>;
  /** Anything the model couldn't map to a field. */
  freeText: string;
  /** One line, in Hebrew, explaining how the query was understood. */
  interpretation: string;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    filters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          values: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["key", "values"],
      },
    },
    freeText: { type: "STRING" },
    interpretation: { type: "STRING" },
  },
  required: ["filters", "freeText", "interpretation"],
};

export type SmartResult =
  | { ok: true; query: SmartQuery }
  | { ok: false; reason: "no_key" | "exhausted" | "error" };

/**
 * Turn a recruiter's sentence into filters. The model is given the real field
 * names and the values that actually occur in the data, so it can only
 * produce filters that mean something.
 */
export async function interpretQuery(
  text: string,
  fieldCatalogue: { key: string; label: string; values: string[] }[]
): Promise<SmartResult> {
  const catalogue = fieldCatalogue
    .map((f) => `- ${f.key} ("${f.label}"): ${f.values.slice(0, 40).join(" | ") || "טקסט חופשי"}`)
    .join("\n");

  const system = `את מנוע חיפוש של פורטל מועמדות. תפקידך להמיר בקשה בשפה חופשית (עברית) לפילטרים מובנים.
השדות הזמינים והערכים הקיימים בפועל:
${catalogue}

כללים:
- החזירי רק מפתחות (key) מהרשימה למעלה. אל תמציאי מפתחות.
- הערכים ב-values חייבים להיות מהערכים שמופיעים ברשימה של אותו שדה (התאמה מדויקת), אלא אם השדה הוא טקסט חופשי.
- מה שלא ניתן למפות לשדה — שימי ב-freeText.
- interpretation: משפט אחד בעברית שמסביר איך הבנת את הבקשה.`;

  const result = await withPoolKey((apiKey) =>
    geminiJson<{
      filters: { key: string; values: string[] }[];
      freeText: string;
      interpretation: string;
    }>({
      apiKey,
      system,
      contents: [{ role: "user", text }],
      jsonSchema: SCHEMA,
      maxOutputTokens: 1024,
    })
  );

  if (!result.ok) return { ok: false, reason: result.reason };

  const filters: Record<string, string[]> = {};
  const allowed = new Set(fieldCatalogue.map((f) => f.key));
  for (const f of result.data.filters ?? []) {
    if (!allowed.has(f.key)) continue; // never trust a made-up field
    const values = (f.values ?? []).filter((v) => typeof v === "string" && v.trim());
    if (values.length) filters[f.key] = values;
  }

  return {
    ok: true,
    query: {
      filters,
      freeText: result.data.freeText ?? "",
      interpretation: result.data.interpretation ?? "",
    },
  };
}

/** The distinct values that actually exist, so the model filters on reality. */
export function buildFieldCatalogue(
  candidates: CandidateDetail[]
): { key: string; label: string; values: string[] }[] {
  const byKey = new Map<string, { label: string; values: Set<string> }>();
  for (const c of candidates) {
    for (const f of c.fields) {
      const entry = byKey.get(f.key) ?? { label: f.label, values: new Set<string>() };
      if (f.kind === "chips") f.values.forEach((v) => entry.values.add(v));
      byKey.set(f.key, entry);
    }
  }
  return [...byKey.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    values: [...v.values].sort((a, b) => a.localeCompare(b, "he")),
  }));
}
