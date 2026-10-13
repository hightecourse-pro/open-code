import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCoordinator } from "@/lib/coordinators";
import { loadGraduates, loadOptionLabels, loadReviews } from "@/lib/coordinator-data";
import { loadHackathonRegistrantIds } from "@/lib/hackathon";
import { ratingLabel } from "@/lib/review-scale";
import { GraduatesBrowser, type GraduateRow } from "./graduates-browser";
import { gradYearOptions } from "@/lib/hebrew-year";
import { activeInstitution } from "./active-institution";

export const metadata: Metadata = { title: "אזור הרכזות" };
export const dynamic = "force-dynamic";

/** הבוגרות שלי - year picker + search instead of one endless scroll. */
export default async function CoordinatorGraduatesPage() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const active = await activeInstitution(me);
  const [labels, graduates, reviews] = await Promise.all([
    loadOptionLabels(),
    loadGraduates(active ? [active] : []),
    loadReviews(me.id),
  ]);
  const hackathon = await loadHackathonRegistrantIds(graduates.map((g) => g.id));

  const rows: GraduateRow[] = graduates
    .map((g) => {
      const r = reviews.get(g.id);
      return {
        id: g.id,
        name: g.full_name,
        hackathon: hackathon.has(g.id),
        initials: g.avatar_initials || g.full_name.slice(0, 1),
        spec: g.specialization,
        inst: g.institution,
        instLabel: labels.places.get(g.institution) ?? g.institution,
        year: g.yearValue ?? "",
        yearLabel: g.yearLabel,
        yearRaw: g.yearRaw,
        subscriber: g.isSubscriber,
        cert: g.certificateValue ?? "",
        certLabel: g.certificateValue
          ? (labels.certificates.get(g.certificateValue) ?? g.certificateValue)
          : "",
        working: g.systemFoundJob || r?.found_job === true,
        review: r
          ? {
              c: r.communication,
              t: r.talent,
              cl: ratingLabel("communication", r.communication, r.communication_label),
              tl: ratingLabel("talent", r.talent, r.talent_label),
              hasAny: !!(r.communication || r.talent || r.note),
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return <GraduatesBrowser rows={rows} multiInstitution={false} yearOptions={gradYearOptions()} />;
}
