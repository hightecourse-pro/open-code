import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, Logo } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import { loadOptionLabels } from "@/lib/coordinator-data";
import { coordinatorLogout } from "../actions";
import { CoordinatorNav } from "./nav";

/**
 * The coordinator portal shell (the owner, 15/9: "תארגן את המסך בצורה נוחה
 * עם תפריט") — one header + tab menu, each subject on its own page instead
 * of a single endless scroll.
 */
export default async function CoordinatorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");
  const labels = await loadOptionLabels();
  const placeLabel = (v: string) => labels.places.get(v) ?? v;

  return (
    <div className="min-h-screen bg-ink-50" dir="rtl">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 pt-3 flex items-center gap-3">
          <Logo width={100} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-ink-1000 truncate">
              שלום {me.full_name.split(" ")[0]} 💜
            </div>
            <div className="text-[11.5px] text-ink-500 truncate">
              {me.institutions.map(placeLabel).join(" · ")}
            </div>
          </div>
          <form action={coordinatorLogout}>
            <Button type="submit" size="sm" variant="ghost">
              <LogOut size={14} /> יציאה
            </Button>
          </form>
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <CoordinatorNav />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
