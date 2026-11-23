import type { Metadata, Viewport } from "next";
import { rubik } from "@/app/ai-course/font";
import { hasTagsAccess, isConfigured, tagsSettings } from "../server";
import { TagsKiosk, type KioskMode } from "./kiosk";

export const metadata: Metadata = {
  title: { absolute: "הדפסת תג בשירות עצמי | הייטקורס" },
  robots: { index: false, follow: false },
  icons: { icon: "/ai-course/icon.png" },
};
/** A touch screen: no pinch zoom, the brand navy behind the browser chrome. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#003A61" };
export const dynamic = "force-dynamic";

/*
  /tags/self - the self-service tag screen of מערכת הדפסת תגים (the owner,
  23/11: ״מסך להדפסה ממסך טאצ׳ שמקלידים עם מקלדת במסך ת.ז., מוצאים ומדפיסים
  מדבקה בשירות עצמי… מותאם לטאצ׳, כפתורים גדולים, 1920 על 1080, עיצוב הייטקורס
  כהה״). The same door as the desk (the entry code once per computer, or a
  signed-in admin / Hightecourse account), the same sheet and the same DYMO
  service on the computer the printer is plugged into - only the screen is
  built for a participant standing in front of it.
*/
export default async function TagsSelfPage() {
  const settings = await tagsSettings();
  const sheetSet = !!settings.spreadsheetId;
  const access = sheetSet && (await hasTagsAccess(settings));
  const mode: KioskMode = access ? "ready" : !sheetSet ? "no-sheet" : !isConfigured(settings) ? "no-code" : "enter";
  // the deployed commit, small at the bottom - a cached old page is told apart at a glance (as on /tags)
  const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  return <TagsKiosk mode={mode} build={build} fontClass={rubik.className} />;
}
