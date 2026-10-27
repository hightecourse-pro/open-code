import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { Brand, PageFooter } from "@/app/ai-course/chrome";
import { rubik } from "@/app/ai-course/font";
import { H } from "@/app/ai-course/theme";
import { TagsGate } from "./gate";
import { TagsDesk } from "./tags-desk";
import { hasTagsAccess, isConfigured, listParticipants, tagsSettings } from "./server";

export const metadata: Metadata = {
  title: { absolute: "מערכת הדפסת תגים | הייטקורס" },
  robots: { index: false, follow: false },
  icons: { icon: "/ai-course/icon.png" },
};
export const dynamic = "force-dynamic";

/*
  /tags - מערכת הדפסת תגים of Hightecourse on our domain (the owner, 27/10:
  "צור כזה בצורה מדויקת אצלינו במערכת החיצונית עם ראוט מסוים"). Outside the
  community shell, in the Hightecourse chrome like /ai-course. Three states:
  not connected to a sheet yet (the admin is sent to the settings), the entry
  code, and the desk itself with the participants read from the sheet.
*/
export default async function TagsPage() {
  const settings = await tagsSettings();
  const configured = isConfigured(settings);
  const access = configured && (await hasTagsAccess(settings));
  const list = access ? await listParticipants() : null;
  const profile = configured && access ? null : await getProfile().catch(() => null);

  return (
    <div dir="rtl" className={`${rubik.className} flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <Brand
        wide
        right={
          <span className="text-[15px] font-black" style={{ color: H.navy }}>
            מערכת הדפסת תגים
          </span>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {!configured ? (
          <div className="mx-auto w-full max-w-md bg-white p-7 text-center sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="tags-not-configured">
            <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
              המערכת עוד לא חוברה לגיליון
            </h1>
            <span className="mx-auto mt-2 block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: H.ink }}>
              מנהלת צריכה להזין את הקישור לגיליון המשתתפות ואת קוד הכניסה בניהול הייטקורס.
            </p>
            {profile?.role === "admin" && (
              <Link href="/ai-course/admin#tags" className="mt-6 inline-block px-6 py-3 text-[15px] font-bold text-white" style={{ background: H.navy, borderRadius: 10 }}>
                להגדרות התגים
              </Link>
            )}
          </div>
        ) : !access || !list ? (
          <TagsGate />
        ) : (
          <TagsDesk initial={list.ok ? list.data : null} initialError={list.ok ? null : list.error} />
        )}
      </main>
      <PageFooter wide />
    </div>
  );
}
