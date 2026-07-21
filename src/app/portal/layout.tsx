import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { PortalNav } from "@/components/portal/portal-nav";
import { portalLogout } from "./actions";
import { portalClient } from "./session";

export const metadata: Metadata = {
  title: "פורטל מועמדות",
  description: "פורטל המועמדות של קוד פתוח — צפייה בפרופילים רלוונטיים למשרות שלכם.",
  // The portal is private by definition; keep it out of search results.
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await portalClient();

  // The login page lives under /portal but has no session yet, so it renders
  // bare — the chrome below only makes sense once a company is signed in.
  if (!client) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <header className="sticky top-0 z-30 bg-ink-1000">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-6">
          {/* The lockup is drawn for light surfaces — a white chip keeps it legible on the ink bar. */}
          <Link
            href="/portal"
            className="inline-flex items-center rounded-sm bg-ink-0 px-2.5 py-1.5 hover:no-underline"
          >
            <Logo width={100} priority />
          </Link>

          <span aria-hidden className="h-6 w-px bg-white/15" />
          <PortalNav />

          <div className="ms-auto flex items-center gap-4">
            <div className="hidden text-end leading-tight sm:block">
              <div className="text-sm font-semibold text-ink-0">{client.company_name}</div>
              <div className="text-[11px] text-white/45">{client.username}</div>
            </div>
            <form action={portalLogout}>
              <button
                type="submit"
                className="cursor-pointer rounded-sm border border-white/20 px-3.5 py-2 text-[13px] font-semibold text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-ink-0"
              >
                התנתקות
              </button>
            </form>
          </div>
        </div>
        {/* The single brand accent in an otherwise neutral shell. */}
        <div aria-hidden className="bg-brand-gradient h-0.5" />
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-ink-200 bg-ink-0">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <p className="t-caption">
            הגישה לפורטל ניתנת על ידי קוד פתוח. המידע המוצג מיועד לשימוש בתהליכי הגיוס שלכם בלבד.
          </p>
        </div>
      </footer>
    </div>
  );
}
