// Minimal Google Gemini (Generative Language API) client over REST.
// The API key is the member's own BYO key, passed per request — never stored
// in env. We surface quota/invalid-key conditions as typed errors so the UI
// can prompt the member to add another key.

export class QuotaError extends Error {}
export class InvalidKeyError extends Error {}
// A 400/403 that is NOT a key problem — the request itself was rejected
// ("Invalid JSON payload", unsupported field on this model). Deterministic per
// model: worth trying the next model in the chain, but re-sending the same
// request in later retry rounds just burns 8-26s per call for the same answer.
export class RequestShapeError extends Error {}
// The model returned no usable text — almost always the newer flash models
// spending the whole output budget on internal "thinking" and hitting
// MAX_TOKENS before writing the answer. Transient: retried like a 503.
export class EmptyResponseError extends Error {}

// Try newest-first: Google retires old models (gemini-2.0-flash shut down
// 1/6/2026; the 2.5 line is on its way out for 16/10/2026 — the AI tools
// went dark when the whole old chain died), so a single hard-coded model
// starts failing with 429/404 for every member. Fall through the chain on
// quota/not-found and only give up if every model failed.
// The lite tier sits on separate capacity — when a "high demand" 503 storm
// takes out the main flash models (29/8: flash-latest 503ing for minutes,
// each failed call burning 8-26s), the lite models usually still answer.
const MODELS = [
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
];
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

  // A single call must never hang open-endedly: members sit behind filtered
  // networks that quietly drop long connections, and one stuck attempt used to
  // stall the whole chain. 55s comfortably covers a slow free-tier generation.
  const res = await fetch(
    `${BASE}/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
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
    throw new RequestShapeError(`Gemini ${res.status}: ${text.slice(0, 160)}`);
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
// alert she reads as a broken key, and her very next attempt works. A 503
// storm outlives a 1.2s pause, so the later waits are longer.
const TRANSIENT_RETRY_DELAYS_MS = [1500, 5000];

async function generate(opts: GenerateOptions): Promise<string> {
  let lastError: unknown;
  let sawQuota = false;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
    let sawTransient = false;
    for (const model of MODELS) {
      try {
        return await generateWithModel(model, opts);
      } catch (e) {
        // An invalid key fails the same way on every model — stop immediately.
        if (e instanceof InvalidKeyError) throw e;
        if (e instanceof QuotaError) sawQuota = true;
        // A rejected request shape is deterministic: the next model may still
        // accept it, but replaying identical calls in later rounds won't.
        else if (!(e instanceof RequestShapeError)) sawTransient = true;
        lastError = e;
      }
    }
    // Quota-only failures are not retried: a per-minute 429 won't clear in a
    // second, and hammering it spends more of the very quota that ran out.
    if (!sawTransient || attempt >= TRANSIENT_RETRY_DELAYS_MS.length) break;
    await new Promise((r) => setTimeout(r, TRANSIENT_RETRY_DELAYS_MS[attempt]));
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
