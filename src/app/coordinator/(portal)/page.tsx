import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCoordinator } from "@/lib/coordinators";
import { loadGraduates, loadOptionLabels, loadReviews } from "@/lib/coordinator-data";
import { GraduatesBrowser, type GraduateRow } from "./graduates-browser";
import { activeInstitution } from "./active-institution";

export const metadata: Metadata = { title: "אזור הרכזות" };
export const dynamic = "force-dynamic";

/** הבוגרות שלי — year picker + search instead of one endless scroll. */
export default async function CoordinatorGraduatesPage() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const active = await activeInstitution(me);
  const [labels, graduates, reviews] = await Promise.all([
    loadOptionLabels(),
    loadGraduates(active ? [active] : []),
    loadReviews(me.id),
  ]);

  const rows: GraduateRow[] = graduates
    .map((g) => {
      const r = reviews.get(g.id);
      return {
        id: g.id,
        name: g.full_name,
        initials: g.avatar_initials || g.full_name.slice(0, 1),
        spec: g.specialization,
        inst: g.institution,
        instLabel: labels.places.get(g.institution) ?? g.institution,
        year: g.yearValue ?? "",
        yearLabel: g.yearValue ? (labels.years.get(g.yearValue) ?? g.yearValue) : "ללא שנת סיום",
        cert: g.certificateValue ?? "",
        certLabel: g.certificateValue
          ? (labels.certificates.get(g.certificateValue) ?? g.certificateValue)
          : "",
        working: g.systemFoundJob || r?.found_job === true,
        review: r ? { c: r.communication, t: r.talent, hasAny: !!(r.communication || r.talent || r.note) } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return <GraduatesBrowser rows={rows} multiInstitution={false} />;
}
