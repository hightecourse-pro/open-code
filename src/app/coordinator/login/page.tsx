import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import { CoordinatorLoginForm } from "./login-form";

export const metadata: Metadata = { title: "כניסת רכזות" };
export const dynamic = "force-dynamic";

export default async function CoordinatorLoginPage() {
  if (await getCoordinator()) redirect("/coordinator");
  return (
    <div className="min-h-screen bg-tint-purple flex items-start justify-center p-4 py-16" dir="rtl">
      <div className="w-full max-w-md bg-white border border-ink-200 rounded-[22px] p-7 shadow-lg flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Logo width={110} />
          <div>
            <span className="font-mono text-xs text-brand-pink-deep">&lt;רכזות/&gt;</span>
            <h1 className="font-display text-[22px] font-black text-ink-1000 leading-tight">
              האזור האישי לרכזות המוסדות
            </h1>
          </div>
        </div>
        <p className="t-body-sm text-ink-500 -mt-1">
          כאן רואים את הבוגרות שלך, ההגשות והגיוסים - ומשתפים אותנו בחוות דעת. הכניסה עם קוד
          חד-פעמי למייל, בגלל רגישות המידע.
        </p>
        <CoordinatorLoginForm />
      </div>
    </div>
  );
}
