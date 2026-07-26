/**
 * Minimal, DOM-free HTML sanitizer for rich job descriptions.
 *
 * Allowlist only: p, br, b, strong, i, em, ul, ol, li, h3, div, span and
 * a[href] where href is http/https. Every attribute except a.href is dropped
 * (style/class/on* included), so the rendered output always inherits brand
 * styles. Safe to run on the server — no browser APIs.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "ul",
  "ol",
  "li",
  "h3",
  "a",
  "div",
  "span",
]);

// Elements whose CONTENT must not leak into the output as text.
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|textarea|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

/** Angle brackets in plain text are neutralized so only tags WE emit survive. */
function escapeText(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Extract a safe http(s) href from a raw attribute string, or null. */
function safeHref(attrs: string): string | null {
  const m = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  const raw = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  // We emit the value inside double quotes — make breaking out impossible.
  return raw.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sanitize editor-produced HTML down to the brand-safe allowlist.
 * Returns "" for content that is effectively empty.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";

  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");

  // Tokenize into tags + text. The attribute part tolerates quoted ">".
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?>/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(src))) {
    out += escapeText(src.slice(last, m.index));
    last = m.index + m[0].length;

    const name = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue; // strip the tag, keep surrounding text

    if (m[0].startsWith("</")) {
      if (name !== "br") out += `</${name}>`;
    } else if (name === "a") {
      const href = safeHref(m[2]);
      out += href ? `<a href="${href}">` : "<a>";
    } else {
      out += `<${name}>`; // all attributes dropped
    }
  }
  out += escapeText(src.slice(last));

  const result = out.trim();
  // "Empty" content: nothing but whitespace/&nbsp; once tags are ignored.
  const textOnly = result
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return textOnly ? result : "";
}
