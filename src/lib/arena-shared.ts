// Shared, client-safe constants of זירת המנטוריות (the owner, 15/10).

/** A mentor's FIRST answer to a question - counted once per question. */
export const ARENA_ANSWER_POINTS = 10;

/** Bumps the "חדש" pill on the sidebar item. */
export const ARENA_UPDATED = "2026-10-15";

/** mentor_ai_experience answers that mean "she can take AI questions". */
export const ARENA_AI_VALUES = ["builds_ai", "ml", "api_use"];

export type ArenaRole = "participant" | "mentor" | "admin";
export type ArenaStatus = "open" | "answered" | "closed";
