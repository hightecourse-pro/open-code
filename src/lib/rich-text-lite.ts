// The light formatting members write in the forum and in chat — the same
// markers people already use in WhatsApp and Slack, so nobody has to learn
// anything:
//
//   *מודגש*   _נטוי_   ~הוסר~   `קוד`   וקישורים שנכתבים ככתובת
//
// Deliberately NOT a markdown engine and deliberately not HTML storage: the
// body stays plain text in the database, and the formatting is applied when
// it is displayed. Nothing a member types can become markup.

export interface TextToken {
  kind: "text" | "bold" | "italic" | "strike" | "code" | "link";
  text: string;
  /** For links: where it points (always absolute). */
  href?: string;
}

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;

/**
 * A marker only counts when it wraps real content and sits on a word
 * boundary — otherwise `2*3*4` and file_name_here would come out formatted.
 */
const MARKERS: { char: string; kind: TextToken["kind"] }[] = [
  { char: "*", kind: "bold" },
  { char: "_", kind: "italic" },
  { char: "~", kind: "strike" },
  { char: "`", kind: "code" },
];

function escapeRe(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split one line into styled tokens. Never nests — one level is plenty. */
function tokenizeLine(line: string): TextToken[] {
  // The Markdown habit dies hard — **מודגש** appears in real member posts.
  // Fold it into our single-asterisk marker before tokenizing.
  line = line.replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, "*$1*");
  for (const { char, kind } of MARKERS) {
    const c = escapeRe(char);
    // A marker run counts when it does not sit mid-word: anything that is not
    // a letter or digit may border it. The old whitelist ([\s([{ before,
    // [\s)]},.!?:; after) silently rejected quotes, gershayim, dashes, maqaf
    // and emoji — all common in real Hebrew posts — leaving raw markers
    // published. Content still cannot start or end with whitespace, which
    // protects 2*3*4 and snake_case_names.
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${c}(\\S(?:[^${c}]*\\S)?)${c}(?=$|[^\\p{L}\\p{N}])`, "u");
    const m = line.match(re);
    if (m && m.index !== undefined) {
      const before = line.slice(0, m.index + m[1].length);
      const after = line.slice(m.index + m[0].length);
      return [
        ...tokenizeLine(before),
        { kind, text: m[2] },
        ...tokenizeLine(after),
      ];
    }
  }

  // No markers left — pull out bare URLs so they become real links.
  const out: TextToken[] = [];
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: line.slice(last, idx) });
    const raw = m[0];
    out.push({
      kind: "link",
      text: raw,
      href: raw.startsWith("http") ? raw : `https://${raw}`,
    });
    last = idx + raw.length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

/** Body text → lines of styled tokens, ready to render. */
export function parseRichText(body: string): TextToken[][] {
  return body.split("\n").map((line) => (line ? tokenizeLine(line) : []));
}

/**
 * Does this body hold editor HTML rather than legacy marker text? The rich
 * editor always produces element markup, and no legacy plain-text body starts
 * with a tag — members had no way to type one that survived rendering.
 */
export function isRichHtml(body: string | null | undefined): boolean {
  return /^\s*<(p|div|ul|ol|h3|b|strong|i|em|br|a|s|strike|del)\b/i.test(body ?? "");
}

const HTML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => HTML_ESC[c]);

/**
 * Legacy marker text → the same HTML the rich editor produces. Used when a
 * member edits an old post in the new editor: her stored "*חשוב*" seeds the
 * editor as real bold instead of literal asterisks.
 */
export function legacyToHtml(body: string): string {
  const TAG: Record<string, [string, string]> = {
    bold: ["<b>", "</b>"],
    italic: ["<i>", "</i>"],
    strike: ["<s>", "</s>"],
    code: ["<code>", "</code>"],
  };
  return parseRichText(body)
    .map((line) =>
      line.length === 0
        ? "<p><br></p>"
        : `<p>${line
            .map((t) => {
              if (t.kind === "link") {
                const href = escHtml(t.href ?? t.text);
                return `<a href="${href}">${escHtml(t.text)}</a>`;
              }
              const [open, close] = TAG[t.kind] ?? ["", ""];
              return `${open}${escHtml(t.text)}${close}`;
            })
            .join("")}</p>`
    )
    .join("");
}

/** How long after posting a member may still fix her words. */
export const EDIT_WINDOW_MS = 10 * 60 * 1000;

/** Is this still inside the editing window? */
export function withinEditWindow(createdAt: string, now = Date.now()): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t <= EDIT_WINDOW_MS;
}

/** Minutes left to edit — for "אפשר לערוך עוד 7 דק'". */
export function editMinutesLeft(createdAt: string, now = Date.now()): number {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((EDIT_WINDOW_MS - (now - t)) / 60000));
}
