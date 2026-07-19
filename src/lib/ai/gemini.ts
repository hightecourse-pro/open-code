// Minimal Google Gemini (Generative Language API) client over REST.
// The API key is the member's own BYO key, passed per request — never stored
// in env. We surface quota/invalid-key conditions as typed errors so the UI
// can prompt the member to add another key.

export class QuotaError extends Error {}
export class InvalidKeyError extends Error {}

// Try newest-first: Google retires old models (gemini-2.0-flash's free quota
// was zeroed out), so a single hard-coded model starts failing with 429/404
// for every member. Fall through the chain on quota/not-found and only give
// up if every model failed.
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiRole = "user" | "model";
export interface GeminiTurn {
  role: GeminiRole;
  text?: string;
  /** Optional inline file (e.g. a CV PDF) sent alongside the text. */
  inlineData?: { mimeType: string; data: string };
}

interface GenerateOptions {
  apiKey: string;
  system?: string;
  contents: GeminiTurn[];
  maxOutputTokens?: number;
  /** When set, request JSON output constrained to this responseSchema. */
  jsonSchema?: unknown;
}

async function generateWithModel(model: string, opts: GenerateOptions): Promise<string> {
  const body: Record<string, unknown> = {
    contents: opts.contents.map((c) => ({
      role: c.role,
      parts: [
        ...(c.inlineData
          ? [{ inline_data: { mime_type: c.inlineData.mimeType, data: c.inlineData.data } }]
          : []),
        ...(c.text ? [{ text: c.text }] : []),
      ],
    })),
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      ...(opts.jsonSchema
        ? { responseMimeType: "application/json", responseSchema: opts.jsonSchema }
        : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const res = await fetch(
    `${BASE}/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (res.status === 429) throw new QuotaError("Gemini quota exhausted");
  if (res.status === 400 || res.status === 403) {
    const text = await res.text();
    if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|invalid/i.test(text)) {
      throw new InvalidKeyError("Gemini key invalid");
    }
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 160)}`);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

async function generate(opts: GenerateOptions): Promise<string> {
  let lastError: unknown;
  let sawQuota = false;
  for (const model of MODELS) {
    try {
      return await generateWithModel(model, opts);
    } catch (e) {
      // An invalid key fails the same way on every model — stop immediately.
      if (e instanceof InvalidKeyError) throw e;
      if (e instanceof QuotaError) sawQuota = true;
      lastError = e;
    }
  }
  if (sawQuota) throw new QuotaError("Gemini quota exhausted on all models");
  throw lastError instanceof Error ? lastError : new Error("Gemini failed");
}

/** Free-form text generation. */
export function geminiText(opts: GenerateOptions): Promise<string> {
  return generate(opts);
}

/** Structured JSON generation, validated/parsed against the caller's type. */
export async function geminiJson<T>(opts: GenerateOptions & { jsonSchema: unknown }): Promise<T> {
  const raw = await generate(opts);
  return JSON.parse(raw) as T;
}

/** Lightweight validity probe used when a member adds a key. */
export async function verifyGeminiKey(apiKey: string): Promise<boolean> {
  try {
    await generate({ apiKey, contents: [{ role: "user", text: "say ok" }], maxOutputTokens: 5 });
    return true;
  } catch (e) {
    if (e instanceof InvalidKeyError) return false;
    // Quota or transient errors mean the key itself is plausibly valid.
    return !(e instanceof Error && /Gemini 4\d\d/.test(e.message));
  }
}
