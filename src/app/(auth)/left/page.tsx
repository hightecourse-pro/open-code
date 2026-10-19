import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "יצאת מהקהילה" };

/** Where a member who left lands - right after leaving, and on any later sign-in. */
export default async function LeftPage({ searchParams }: { searchParams: Promise<{ bye?: string }> }) {
  const { bye } = await searchParams;
  return (
    <div className="flex flex-col gap-3 text-center">
      <div className="text-[40px]">👋</div>
      <h1 className="t-h2">{bye === "1" ? "יצאת מהקהילה" : "החשבון הזה יצא מהקהילה"}</h1>
      <p className="t-body-sm text-ink-600">
        {bye === "1" ? "תודה שהיית איתנו. " : ""}
        אם תרצי לחזור יום אחד - הדלת פתוחה. כתבי לנו ל-
        <a href="mailto:office@opencode.org.il" className="text-brand-purple underline" dir="ltr">
          office@opencode.org.il
        </a>{" "}
        ונחזיר אותך פנימה.
      </p>
      <Link href="/login" className="text-[13px] text-ink-500 hover:text-brand-purple mt-2">
        חזרה למסך הכניסה
      </Link>
    </div>
  );
}
