import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { getCoordinator } from "@/lib/coordinators";
import { loadGraduates, loadHires } from "@/lib/coordinator-data";
import { activeInstitution } from "../active-institution";

export const metadata: Metadata = { title: "גיוסים" };
export const dynamic = "force-dynamic";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** Placements of her graduates — names and dates; workplaces stay private. */
export default async function CoordinatorHiresPage() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const active = await activeInstitution(me);
  const graduates = await loadGraduates(active ? [active] : []);
  const hires = await loadHires(graduates.map((g) => g.id), active ? [active] : []);

  return (
    <section className="bg-white border border-ink-200 rounded-[16px] p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
        <PartyPopper size={18} className="text-brand-pink-deep" /> גיוסים מהמוסדות שלך ({hires.length})
      </h2>
      <div className="flex flex-col mt-1">
        {hires.map((h, i) => (
          <div key={i} className="py-2 border-b border-ink-100 last:border-b-0 flex items-center gap-3">
            <span className="font-medium text-ink-900">{h.full_name}</span>
            {h.hired_at && (
              <span className="text-[12px] text-ink-500 tabular-nums">
                {DATE_HE.format(new Date(h.hired_at))}
              </span>
            )}
            <span className="ms-auto">🎉</span>
          </div>
        ))}
        {hires.length === 0 && (
          <p className="text-ink-500 text-sm py-2">עוד אין גיוסים רשומים — נעדכן כאן כשיהיו 💜</p>
        )}
      </div>
    </section>
  );
}
