/**
 * Who is "the team" for lists that outsiders see (the owner, 13/10: "צוות
 * לא מוסתר גם לא צריך להופיע לרכזות"). Three signals, any one is enough:
 * the admin role, the hidden flag (test accounts), or the shared team
 * account name "קוד פתוח" - the team's own accounts carry it even when they
 * sit on the junior track for testing. Pure; client-safe.
 */
export function isTeamIdentity(p: { role?: string | null; is_hidden?: boolean | null; full_name?: string | null }): boolean {
  if (p.role === "admin") return true;
  if (p.is_hidden === true) return true;
  const name = (p.full_name ?? "").replace(/\s+/g, " ").trim();
  return name === "קוד פתוח" || name.startsWith("קוד פתוח ") || name.startsWith("קוד פתוח (");
}
