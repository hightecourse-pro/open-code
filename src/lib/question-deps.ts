/**
 * The grammar of config_questions.depends_on - one place, read by the member's
 * wizard, the save action and the admin screens alike:
 *
 *   "<key>"                       the follow-up shows only while the parent
 *                                 bool question is on (״כן״);
 *   "<key>=<value>[|<value>...]"  the follow-up shows only while the parent
 *                                 select holds ONE of the listed values, e.g.
 *                                 "current_employment=hitech_change|hitech_refresh"
 *                                 - ״איפה את עובדת היום?״ follows every
 *                                 ״עובדת בהייטק״ answer (the owner, 16/11).
 */
export interface QuestionDependency {
  key: string;
  /** null = a bool parent; otherwise the accepted select values. */
  values: string[] | null;
}

export function parseDependsOn(dependsOn: string | null | undefined): QuestionDependency | null {
  const raw = (dependsOn ?? "").trim();
  if (!raw) return null;
  const eq = raw.indexOf("=");
  if (eq < 0) return { key: raw, values: null };
  return {
    key: raw.slice(0, eq).trim(),
    values: raw
      .slice(eq + 1)
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean),
  };
}

/** Is the follow-up `dependsOn` describes currently in play? */
export function dependencyMet(
  dependsOn: string | null | undefined,
  boolByKey: (key: string) => boolean | undefined,
  selectByKey: (key: string) => string | undefined,
): boolean {
  const dep = parseDependsOn(dependsOn);
  if (!dep) return true;
  if (dep.values) return dep.values.includes(selectByKey(dep.key) ?? "");
  return boolByKey(dep.key) === true;
}
