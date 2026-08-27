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

/** Extract a safe http(s) src from a raw attribute string, or null. */
function safeSrc(attrs: string): string | null {
  const m = /src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  const raw = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Video embeds may come only from these players. */
const EMBED_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/|^https:\/\/player\.vimeo\.com\/video\//i;

/**
 * The ARTICLE sanitizer: everything sanitizeRichHtml allows, plus images
 * (img[src] over https) and video embeds (iframe from YouTube/Vimeo only),
 * and h2 for article structure. Admin-authored content only — members never
 * reach this path.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  // Rescue the allowed iframes BEFORE the generic pass drops them.
  const embeds: string[] = [];
  const src = html.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe\s*>/gi, (_all, attrs: string) => {
    const s = safeSrc(attrs);
    if (!s || !EMBED_HOSTS.test(s.replace(/&amp;/g, "&"))) return "";
    embeds.push(
      `<span class="rt-video"><iframe src="${s}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></span>`
    );
    return `@@EMBED${embeds.length - 1}@@`;
  });
  // Images: swap to placeholders too, so the base pass can't mangle them.
  const images: string[] = [];
  const withImgs = src.replace(/<img\b([^>]*)\/?>/gi, (_all, attrs: string) => {
    const s = safeSrc(attrs);
    if (!s) return "";
    images.push(`<img src="${s}" loading="lazy" alt="" />`);
    return `@@IMG${images.length - 1}@@`;
  });
  // h2 → h3 (one article heading level, brand-styled).
  const base = sanitizeRichHtml(withImgs.replace(/<(\/?)h2\b/gi, "<$1h3"));
  return base
    .replace(/@@EMBED(\d+)@@/g, (_m, i) => embeds[Number(i)] ?? "")
    .replace(/@@IMG(\d+)@@/g, (_m, i) => images[Number(i)] ?? "");
}

/**
 * The plain-text mirror of rich HTML: line breaks preserved, formatting
 * dropped. Used for emails and anywhere the styled version can't render —
 * the admin writes once, this copy derives itself.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h3|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
