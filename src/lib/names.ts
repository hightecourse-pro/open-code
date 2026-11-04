/**
 * Admin-facing display name: "שם פרטי שם משפחה (שם משפחה קודם)" - the owner
 * (9/9): a member who married carries her maiden name in the questionnaire
 * (prev_surname), and the team recognizes her by it (seminary records live
 * under it). Shown only when she has one.
 */
export function nameWithPrevSurname(fullName: string | null | undefined, prevSurname: string | null | undefined): string {
  const name = fullName?.trim() || "חברת קהילה";
  const prev = prevSurname?.trim();
  return prev ? `${name} (${prev})` : name;
}

/**
 * The reverse, for Excel: there the previous surname gets its own column
 * (the owner, 3.11: ״שם משפחה קודם צריך להיות בעמודה נפרדת ולא בסוגריים״).
 * Splits exactly what nameWithPrevSurname joined - a trailing ״(…)״.
 */
export function splitPrevSurname(display: string | null | undefined): { name: string; prevSurname: string } {
  const s = (display ?? "").trim();
  const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(s);
  return m ? { name: m[1], prevSurname: m[2].trim() } : { name: s, prevSurname: "" };
}
