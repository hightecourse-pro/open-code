/**
 * Admin-facing display name: "שם פרטי שם משפחה (שם משפחה קודם)" — the owner
 * (9/9): a member who married carries her maiden name in the questionnaire
 * (prev_surname), and the team recognizes her by it (seminary records live
 * under it). Shown only when she has one.
 */
export function nameWithPrevSurname(fullName: string | null | undefined, prevSurname: string | null | undefined): string {
  const name = fullName?.trim() || "חברת קהילה";
  const prev = prevSurname?.trim();
  return prev ? `${name} (${prev})` : name;
}
