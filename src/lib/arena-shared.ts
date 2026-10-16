// Shared, client-safe constants of זירת המנטוריות (the owner, 15/10 + 16/10).

/** A mentor's FIRST answer to a question - counted once per question. */
export const ARENA_ANSWER_POINTS = 10;
/** The asker marked her answer "עזר לי" - a bonus, once per question. */
export const ARENA_HELPFUL_POINTS = 5;

/** Bumps the "חדש" pill on the sidebar item. */
export const ARENA_UPDATED = "2026-10-16";

/** mentor_ai_experience answers that mean "she can take AI questions". */
export const ARENA_AI_VALUES = ["builds_ai", "ml", "api_use"];

/** "אני כאן עכשיו" lasts this long. */
export const PRESENCE_HOURS = 1;
/** An open question may be pushed to every mentor after this long. */
export const NUDGE_AFTER_HOURS = 24;

export const ARENA_TOPICS: { key: string; label: string; emoji: string }[] = [
  { key: "ai", label: "AI ומודלים", emoji: "🤖" },
  { key: "data", label: "נתונים ו-SQL", emoji: "🗄️" },
  { key: "frontend", label: "פרונט וממשק", emoji: "🎨" },
  { key: "backend", label: "בקאנד ואיג׳נט", emoji: "⚙️" },
  { key: "deploy", label: "פריסה וענן", emoji: "☁️" },
  { key: "rules", label: "כללי האתגר", emoji: "📋" },
  { key: "other", label: "אחר", emoji: "💬" },
];

export function topicOf(key: string | null | undefined) {
  return ARENA_TOPICS.find((t) => t.key === key) ?? null;
}

export type ArenaRole = "participant" | "mentor" | "admin";
export type ArenaStatus = "open" | "answered" | "closed";
