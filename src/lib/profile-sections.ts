/**
 * The wizard the member fills in, as data.
 *
 * The questionnaire is not a flat list — it is a sequence of titled steps, and
 * a question belongs to a step by its key. That grouping used to live inside
 * the form component alone, which meant the configuration screen showed a flat
 * list in a different order from the one members actually see: reordering a
 * question there looked like it did nothing, because the steps themselves never
 * moved. Both screens now read the grouping from here, so what the admin sees
 * is what the member gets, and the arrows move a question within its step.
 */

export interface ProfileSection {
  title: string;
  hint: string;
  keys: string[];
}

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: "שאלת הפתיחה",
    hint: "השאלה שקובעת אילו חלקים בשאלון יוצגו — מובנית ולא ניתנת לכיבוי.",
    keys: ["has_experience"],
  },
  {
    title: "קצת עלייך",
    hint: "פרטי קשר בסיסיים — כדי שנכיר ונדע איך לחזור אלייך.",
    // specialization/coordinator_email/bio used to dangle in the leftover
    // "פרטים נוספים" step (the PM's "מיותר, יש קודם") — homed here and below.
    keys: [
      "specialization", "id_number", "phone", "region", "city", "street", "house_number",
      "marital_status", "prev_surname", "language_skills",
    ],
  },
  {
    title: "הרקע הלימודי",
    hint: "איפה למדת ובמה התמחית — זה עוזר לנו להתאים לך קורסים ומשרות.",
    keys: [
      "study_place", "coordinator_name", "coordinator_email", "certificate",
      "track_specialization", "unique_courses", "graduation_year",
    ],
  },
  {
    title: "ההתנסות והניסיון שלך",
    // Practicum/bootcamp ARE hands-on experience (PM call) — they live here,
    // not in a separate step.
    hint: "ניסיון מהתעשייה, פרקטיקום ובוטקאמפ — ככה נדע לאילו משרות לכוון בשבילך.",
    keys: [
      "years_experience", "exp_role", "exp_tech", "exp_languages", "work_history",
      "practical_experience", "practicum_done", "practicum_kind", "practicum_employer", "practicum_period",
      "practicum_tech", "practicum_description", "currently_working", "current_workplace",
      "work_description", "specific_job", "current_employment", "current_employment_place",
    ],
  },
  {
    title: "כישורים וכלים",
    hint: "מה את יודעת לעשות בפועל — רק מה שבאמת התנסית בו, בלי לחץ 💜",
    keys: [
      "dev_tech", "genai_known", "genai_practiced", "ai_tools_used", "mentor_tech", "github",
      "ai_project_links", "live_links", "ai_gaps",
    ],
  },
  {
    title: "העדפות השמה",
    hint: "כמה העדפות שיעזרו לנו להציע לך בדיוק את ההזדמנויות הנכונות.",
    keys: ["job_offer_types", "practicum_placement", "remote_commute", "paid_placement"],
  },
  {
    title: "עוד משהו?",
    hint: "משהו שתרצי שנדע עלייך? כאן המקום 🙂",
    keys: ["bio", "notes_for_us"],
  },
];

/** Where a question added in the admin screen lands until it is given a home. */
export const EXTRA_SECTION = {
  title: "פרטים נוספים",
  hint: "עוד כמה פרטים קטנים.",
};

export interface GroupedSection<T> {
  title: string;
  hint: string;
  questions: T[];
}

/**
 * Group questions into the wizard's steps, preserving the order they arrive in
 * (which is sort_order) inside each step. Anything whose key belongs to no step
 * lands in a final "פרטים נוספים" — so a question added in the admin screen
 * still reaches the member instead of vanishing.
 *
 * `keep` lets the member-facing form drop questions hidden by the experience
 * track or by an unanswered parent, without changing anyone's order.
 */
export function groupBySection<T extends { id: string; key: string }>(
  questions: T[],
  keep: (q: T) => boolean = () => true
): GroupedSection<T>[] {
  const used = new Set<string>();
  const sections = PROFILE_SECTIONS.map((s) => {
    const inSection = questions.filter((q) => s.keys.includes(q.key) && keep(q));
    inSection.forEach((q) => used.add(q.id));
    return { title: s.title, hint: s.hint, questions: inSection };
  }).filter((s) => s.questions.length > 0);

  const extra = questions.filter((q) => keep(q) && !used.has(q.id));
  if (extra.length) sections.push({ ...EXTRA_SECTION, questions: extra });
  return sections;
}

/**
 * The questions in the exact order the member meets them — every step
 * flattened back into one list. Used to renumber sort_order after a move, so
 * the stored numbers and the rendered order never drift apart.
 */
export function flattenSections<T extends { id: string; key: string }>(questions: T[]): T[] {
  return groupBySection(questions).flatMap((s) => s.questions);
}
