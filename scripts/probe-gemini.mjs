// Diagnostic: run the CV-checker's exact structured-JSON request against the
// model chain, comparing the OLD config (thinking on, 2048 tokens) with the
// FIX (thinkingBudget:0, 4096 tokens). Pass a real Gemini key as arg. The key
// is used only for this call to Google's own API and is never printed.
const KEY = process.argv[2];
if (!KEY) { console.error("usage: node scripts/probe-gemini.mjs <gemini-key>"); process.exit(1); }
const MODELS = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" }, summary: { type: "STRING" },
    insights: { type: "ARRAY", items: { type: "OBJECT", properties: {
      type: { type: "STRING", enum: ["good", "warn", "bad", "tip"] },
      title: { type: "STRING" }, detail: { type: "STRING" } },
      required: ["type", "title", "detail"] } },
  },
  required: ["score", "summary", "insights"],
};
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 12 Tf 72 720 Td (Rivka Levi - Junior Frontend React) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Size 6/Root 1 0 R>>\n%%EOF"
).toString("base64");

function makeBody({ think }) {
  return {
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: "application/pdf", data: PDF } },
      { text: "קורות החיים מצורפים כקובץ PDF. נתחי אותם." },
    ] }],
    systemInstruction: { parts: [{ text: "את יועצת קריירה. פלט בעברית, לשון נקבה." }] },
    generationConfig: {
      maxOutputTokens: think ? 2048 : 4096,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      ...(think ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  };
}

async function run(label, think) {
  // Fall through the chain on 503/429/404 exactly like the app does.
  for (const model of MODELS) {
    const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(KEY)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(makeBody({ think })),
    });
    if (res.status === 503 || res.status === 429 || res.status === 404) continue;
    if (!res.ok) { console.log(label, model, res.status, (await res.text()).replace(/\s+/g, " ").slice(0, 140)); return; }
    const data = await res.json();
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const u = data.usageMetadata ?? {};
    let parses = "n/a";
    try { JSON.parse(text); parses = "YES ✅"; } catch { parses = "NO ❌"; }
    console.log(`${label.padEnd(24)} ${model}  finishReason=${cand?.finishReason}  thoughts=${u.thoughtsTokenCount ?? 0}  answerTokens=${u.candidatesTokenCount ?? 0}  textLen=${text.length}  JSONparses=${parses}`);
    if (parses.startsWith("YES")) {
      const a = JSON.parse(text);
      console.log(`   → score=${a.score}, ${a.insights?.length ?? 0} insights, summary="${(a.summary ?? "").slice(0, 50)}…"`);
    }
    return;
  }
  console.log(`${label.padEnd(24)} all models 503/429/404 (transient) — try again shortly`);
}

console.log("== OLD config (thinking on, 2048) — reproduces the bug ==");
await run("OLD/thinking-on", true);
console.log("== FIX (thinkingBudget:0, 4096) ==");
await run("FIX/thinking-off", false);
