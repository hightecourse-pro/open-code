import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { Button, Logo } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import { loadOptionLabels } from "@/lib/coordinator-data";
import { coordinatorLogout, exitAdminView } from "../actions";
import { CoordinatorNav } from "./nav";
import { InstitutionTabs } from "./institution-tabs";
import { activeInstitution } from "./active-institution";

/**
 * The coordinator portal shell (the owner, 15/9: "תארגן את המסך בצורה נוחה
 * עם תפריט") - one header + tab menu, each subject on its own page instead
 * of a single endless scroll.
 */
export default async function CoordinatorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");
  // Imported email-keyed reviews link themselves to fresh signups here.
  const { linkReviewsByEmail } = await import("@/lib/coordinator-data");
  await linkReviewsByEmail();
  const labels = await loadOptionLabels();
  const placeLabel = (v: string) => labels.places.get(v) ?? v;
  const adminView = (await cookies()).get("oc_coord_admin")?.value === "1";
  // Multi-seminary coordinators work one seminary at a time (the owner,
  // 16/9: "מופרדים לגמרי בכרטיסיות") - the tabs live above the section nav.
  const active = await activeInstitution(me);

  return (
    <div className="min-h-screen bg-ink-50" dir="rtl">
      {adminView && (
        <div className="bg-[#8C5E0E] text-white text-[12.5px] font-semibold">
          <div className="max-w-4xl mx-auto px-4 py-1.5 flex items-center gap-3 flex-wrap">
            <span>
              👁 תצוגת ניהול - כך רואה את האזור {me.full_name}. פעולות כאן (כמו שמירת חוות דעת)
              נעשות בשמה.
            </span>
            <form action={exitAdminView} className="ms-auto">
              <button type="submit" className="underline font-bold cursor-pointer">
                חזרה לניהול
              </button>
            </form>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 pt-3 flex items-center gap-3">
          <Logo width={100} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-ink-1000 truncate">
              שלום {me.full_name.split(" ")[0]} 💜
            </div>
            <div className="text-[11.5px] text-ink-500 truncate">
              {me.institutions.length > 1 ? placeLabel(active) : me.institutions.map(placeLabel).join(" · ")}
            </div>
          </div>
          <form action={coordinatorLogout}>
            <Button type="submit" size="sm" variant="ghost">
              <LogOut size={14} /> יציאה
            </Button>
          </form>
        </div>
        {me.institutions.length > 1 && (
          <div className="max-w-4xl mx-auto px-4 border-t border-ink-100">
            <InstitutionTabs
              institutions={me.institutions.map((v) => ({ value: v, label: placeLabel(v) }))}
              active={active}
            />
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4">
          <CoordinatorNav />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
