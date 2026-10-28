import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { adminView } from "@/lib/hackathon-live";
import { loadAdminSubmissions } from "@/lib/hackathon-submission";
import type { LiveAdminView } from "@/lib/hackathon-live-shared";
import { LiveAdmin, type SubmittedTeam } from "./live-admin";
import { LiveAdminLogin, NotAdmin, SignOut } from "./login";

export const metadata: Metadata = { title: "לוח הבקרה של ערב הגמר", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/*
  לוח הבקרה של ערב הגמר as its own page (the owner, 28/10: ״מערכת הניהול צריכה
  להיות בדף נפרד - לא בתוך המערכת הגדולה ולהיות פשוטה להפעלה״): no admin shell,
  no sidebar - a slim header with the two links the evening needs, and the
  panel itself. Same sign-in as the community (admin only); the old address
  /admin/hackathon/live redirects here.
*/
export default async function LiveAdminPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  let initial: LiveAdminView | null = null;
  let submitted: SubmittedTeam[] = [];
  if (isAdmin) {
    const [view, submissions] = await Promise.all([adminView({ poll: false }), loadAdminSubmissions()]);
    initial = view;
    submitted = submissions.filter((s) => s.submittedAt).map((s) => ({ teamKey: s.teamKey, challengeKey: s.challengeKey, team: s.members.map((m) => m.name).join(" + ") }));
  }
  return (
    <div dir="rtl" className="min-h-screen bg-ink-50 text-ink-900" data-testid="live-admin-shell">
      <header className="sticky top-0 z-20 bg-white border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" className="h-10 w-auto" />
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold text-ink-1000 leading-tight">לוח הבקרה של ערב הגמר</h1>
            <p className="text-[12px] text-ink-500 leading-tight">{initial?.event.name ?? "האקתון AI קוד פתוח 2026"}</p>
          </div>
          <span className="flex-1" />
          {isAdmin ? (
            <>
              <a className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold border border-brand-purple text-brand-purple bg-white hover:bg-tint-purple" href="/live" target="_blank" rel="noreferrer">
                📺 מסך האולם
              </a>
              <a className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] border border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100" href="/api/admin/hackathon/live?export=csv">
                ייצוא CSV
              </a>
              <SignOut name={profile?.first_name || profile?.full_name || ""} />
            </>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {isAdmin && initial ? <LiveAdmin initial={initial} submitted={submitted} /> : profile ? <NotAdmin name={profile.first_name || profile.full_name || ""} /> : <LiveAdminLogin />}
      </main>
    </div>
  );
}
