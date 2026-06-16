import he from "@/messages/he.json";

/**
 * Single-locale (Hebrew, feminine) copy lookup. All UI strings live in
 * `src/messages/he.json` — never hardcode user-facing text in JSX.
 *
 * Usage: t("feed.title") → "מה חדש בקהילה"
 *
 * If a second locale is ever needed (e.g. EN for EU members), swap this for
 * next-intl — the message-file structure is already compatible.
 */
const messages = he;

// Build a union of all valid "a.b.c" dot-paths from the message tree, so keys
// are autocompleted and typos fail at compile time.
type Leaves<T> = T extends string
  ? ""
  : {
      [K in keyof T & string]: Leaves<T[K]> extends "" ? `${K}` : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

export type MessageKey = Leaves<typeof messages>;

export function t(key: MessageKey): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], messages);

  if (typeof value !== "string") {
    // Surface the missing key rather than rendering "undefined".
    return key;
  }
  return value;
}

export { messages };
