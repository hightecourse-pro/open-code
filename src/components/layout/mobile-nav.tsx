"use client";

// Below lg the sidebar column disappears entirely, and until now nothing
// replaced it (the owner, 8/9: "במסך קטן אין לי את התפריט בצד וגם לא אופציה
// לפתיחה"). This is that option: a slim sticky top bar with the logo and a
// hamburger, opening the very same sidebar as a right-hand drawer.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui";

export function MobileNav({
  children,
  homeHref = "/forum",
  dark = false,
}: {
  /** The sidebar to show inside the drawer (member or admin). */
  children: React.ReactNode;
  homeHref?: string;
  /** Admin drawer panel is dark like its sidebar. */
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the drawer — she tapped a destination, not a menu state.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // No background scroll while the drawer is up.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-ink-200 flex items-center justify-between px-4 py-2">
        <Link href={homeHref} aria-label="קוד פתוח">
          <Logo width={92} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="פתיחת תפריט"
          className="p-2 rounded-lg text-ink-700 hover:bg-ink-100 cursor-pointer"
        >
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink-1000/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={`absolute inset-y-0 start-0 w-[290px] max-w-[85vw] shadow-xl overflow-y-auto ${dark ? "bg-ink-1000" : "bg-white"}`}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירת תפריט"
              className={`absolute top-3 end-3 z-10 p-1.5 rounded-lg cursor-pointer ${dark ? "text-white/70 hover:bg-white/10" : "text-ink-500 hover:bg-ink-100"}`}
            >
              <X size={20} />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
