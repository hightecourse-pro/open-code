// Diagnostic: which models does the CV-checker chain resolve to, and do they
// accept the checker's exact request shape (inline PDF + responseSchema +
// maxOutputTokens:2048)? Pass a real Gemini key as arg to exercise it; without
// one, it still reports which models 404 (retired) vs. exist.
const KEY = process.argv[2] || "diagnostic-placeholder";
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

// A tiny valid one-page PDF ("Rivka Levi — Junior Frontend, React").
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 12 Tf 72 720 Td (Rivka Levi - Junior Frontend React) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Size 6/Root 1 0 R>>\n%%EOF"
).toString("base64");

const body = {
  contents: [{ role: "user", parts: [
    { inline_data: { mime_type: "application/pdf", data: PDF } },
    { text: "קורות החיים מצורפים כקובץ PDF. נתחי אותם." },
  ] }],
  systemInstruction: { parts: [{ text: "את יועצת קריירה. פלט בעברית." }] },
  generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: SCHEMA },
};

for (const model of MODELS) {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(KEY)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = (await res.text()).replace(/\s+/g, " ");
    const kind = /NOT_FOUND|is not found|not supported/i.test(t) ? "MODEL RETIRED"
      : /API_KEY_INVALID|API key not valid/i.test(t) ? "model OK, placeholder key rejected"
      : /invalid/i.test(t) ? "400 containing 'invalid' (would be misread as bad-key!)"
      : "other";
    console.log(model.padEnd(24), res.status, kind, "|", t.slice(0, 160));
    continue;
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const usage = data.usageMetadata ?? {};
  console.log(model.padEnd(24), "200",
    "finishReason=" + cand?.finishReason,
    "textLen=" + text.length,
    "thoughts=" + (usage.thoughtsTokenCount ?? 0),
    "candTokens=" + (usage.candidatesTokenCount ?? 0));
  console.log("  parses:", (() => { try { JSON.parse(text); return "YES ✅"; } catch { return "NO ❌ head=" + JSON.stringify(text.slice(0, 80)); } })());
  break;
}
