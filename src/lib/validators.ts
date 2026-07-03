// Field validators shared by the profile form (client) and saveProfile (server).

/** Israeli ID (תעודת זהות) — 9 digits with the standard check-digit. */
export function isValidIsraeliId(raw: string): boolean {
  const id = String(raw).trim();
  if (!/^\d{5,9}$/.test(id)) return false;
  const padded = id.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let inc = Number(padded[i]) * ((i % 2) + 1);
    if (inc > 9) inc -= 9;
    sum += inc;
  }
  return sum % 10 === 0;
}

/** Israeli mobile number — 05X followed by 7 digits (dashes/spaces allowed). */
export function isValidIsraeliMobile(raw: string): boolean {
  const digits = String(raw).replace(/[\s-]/g, "");
  return /^05\d{8}$/.test(digits);
}

/**
 * Per-question-key format validators. Returns a Hebrew error message for an
 * invalid value, or null when it's fine. Empty values pass (required-ness is
 * handled separately).
 */
export const FIELD_VALIDATORS: Record<string, (v: string) => string | null> = {
  id_number: (v) => (!v.trim() || isValidIsraeliId(v) ? null : "תעודת זהות לא תקינה (9 ספרות)"),
  phone: (v) =>
    !v.trim() || isValidIsraeliMobile(v) ? null : "מספר נייד לא תקין (למשל 052-1234567)",
};
