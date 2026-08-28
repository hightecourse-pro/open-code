// Minimal Google Gemini (Generative Language API) client over REST.
// The API key is the member's own BYO key, passed per request — never stored
// in env. We surface quota/invalid-key conditions as typed errors so the UI
// can prompt the member to add another key.

export class QuotaError extends Error {}
export class InvalidKeyError extends Error {}
// The model returned no usable text — almost always the newer flash models
// spending the whole output budget on internal "thinking" and hitting
// MAX_TOKENS before writing the answer. Transient: retried like a 503.
export class EmptyResponseError extends Error {}

// Try newest-first: Google retires old models (gemini-2.0-flash shut down
// 1/6/2026; the 2.5 line is on its way out for 16/10/2026 — the AI tools
// went dark when the whole old chain died), so a single hard-coded model
// starts failing with 429/404 for every member. Fall through the chain on
// quota/not-found and only give up if every model failed.
const MODELS = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
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
        ? {
            responseMimeType: "application/json",
            responseSchema: opts.jsonSchema,
            // Gemini 3.x flash "thinks" by default, and thinking tokens are
            // drawn from maxOutputTokens — so a structured-JSON call could burn
            // the whole budget thinking and return an empty body (finishReason
            // MAX_TOKENS). That surfaced to members as "משהו השתבש" on every CV
            // check while their key was fine. Structured extraction/scoring
            // doesn't need the scratchpad, so turn it off and leave the budget
            // for the answer.
            thinkingConfig: { thinkingBudget: 0 },
          }
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
    // Match only genuine key/permission failures. A bare /invalid/ used to be
    // here and swallowed request-shape 400s ("Invalid JSON payload", "Invalid
    // value at responseSchema") as bad-key errors — flagging a working key and
    // hiding the real cause.
    if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|API_KEY_SERVICE_BLOCKED/i.test(text)) {
      throw new InvalidKeyError("Gemini key invalid");
    }
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 160)}`);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  // An empty body is a real failure, not an empty answer — returning "" here
  // let JSON.parse blow up two layers away with no clue why. Name it so the
  // chain can fall through to the next model and the logs say what happened.
  if (!text) {
    throw new EmptyResponseError(
      `Gemini ${model} returned no text (finishReason=${candidate?.finishReason ?? "unknown"})`
    );
  }
  return text;
}

// Google's free tier fails transiently all the time — 503 "model overloaded",
// brief network blips. Without a quiet retry those surface to the member as an
// alert she reads as a broken key, and her very next attempt works.
const TRANSIENT_RETRY_DELAY_MS = 1200;

async function generate(opts: GenerateOptions): Promise<string> {
  let lastError: unknown;
  let sawQuota = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let sawTransient = false;
    for (const model of MODELS) {
      try {
        return await generateWithModel(model, opts);
      } catch (e) {
        // An invalid key fails the same way on every model — stop immediately.
        if (e instanceof InvalidKeyError) throw e;
        if (e instanceof QuotaError) sawQuota = true;
        else sawTransient = true;
        lastError = e;
      }
    }
    // Quota-only failures are not retried: a per-minute 429 won't clear in a
    // second, and hammering it spends more of the very quota that ran out.
    if (!sawTransient || attempt > 0) break;
    await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAY_MS));
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
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A truncated or malformed JSON body is the model misbehaving, not the
    // member's key — regenerate once before giving up.
    return JSON.parse(await generate(opts)) as T;
  }
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
