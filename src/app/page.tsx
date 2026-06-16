import Link from "next/link";
import { Button, Logo } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-full flex items-center justify-center px-6">
      <div className="bg-brand-glow absolute inset-0 -z-10" />
      <div className="max-w-2xl text-center flex flex-col items-center gap-6 py-24">
        <Logo width={260} priority className="mb-2" />
        <h1 className="t-display">
          הקריירה שלך <span className="t-gradient">מתחילה כאן</span>
        </h1>
        <p className="t-body-lg text-ink-700 max-w-md">
          קהילה חמה ותומכת לג&apos;וניוריות בתחום הפיתוח. אנחנו ביחד — מהצעד הראשון ועד המשרה הראשונה.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button bracketed>הצטרפות לקהילה</Button>
          <Button variant="secondary" asChild>
            <Link href="/dev/components">ספריית הרכיבים</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
