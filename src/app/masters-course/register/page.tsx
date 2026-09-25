import type { Metadata } from "next";
import Link from "next/link";
import { C, CourseFooter, PartnersHeader, rubik } from "../shared";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "הרשמה לקורס מאסטרית בהייטק",
  description: "הרשמה לקורס השנתי של שופרא, קוד פתוח והייטקורס. מנויות קוד פתוח משלמות 1,500 ₪ (12 × 125).",
  robots: { index: false },
};

/**
 * The step between the sales page and Shufra's payment page (the owner,
 * 25/9): email → are you an Open Code subscriber? → the scholarship message
 * or the membership offer → "ממשיכה לתשלום".
 */
export default function MastersCourseRegisterPage() {
  return (
    <main dir="rtl" className={`${rubik.className} min-h-screen`} style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12 flex flex-col gap-8">
        <PartnersHeader compact />

        <section className="bg-white rounded-[32px] px-6 py-8 sm:px-10 sm:py-10 shadow-sm">
          <p className="text-[15px] font-medium" style={{ color: C.muted }}>
            <Link href="/masters-course" className="underline">
              ← חזרה לפרטי הקורס
            </Link>
          </p>
          <h1 className="font-black text-[30px] sm:text-[38px] leading-tight mt-2" style={{ color: C.navy }}>
            הרשמה לקורס השנתי
            <br />
            <span style={{ color: C.pink }}>מאסטרית בהייטק</span>
          </h1>
          <p className="text-[16.5px] leading-relaxed mt-3">
            כמה פרטים, ואנחנו בודקות אם יש לך מנוי בקוד פתוח - כי המלגה למנויות (4,500 ₪) תלויה בו.
            אחר כך נעביר אותך לדף התשלום המאובטח של שופרא.
          </p>

          <div className="mt-7">
            <RegisterForm />
          </div>
        </section>

        <CourseFooter />
      </div>
    </main>
  );
}
