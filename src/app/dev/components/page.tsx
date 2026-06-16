import type { Metadata } from "next";
import {
  Alert,
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  CardBody,
  CardLabel,
  CardTitle,
  Checkbox,
  Field,
  Input,
  ProgressBar,
  ProgressRing,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "ספריית רכיבים",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-h3">{title}</h2>
      <div className="bg-ink-0 border border-ink-200 rounded-lg p-6 shadow-xs">{children}</div>
    </section>
  );
}

export default function ComponentGallery() {
  return (
    <main className="max-w-[var(--container-max)] mx-auto px-6 py-10 flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="t-micro text-ink-500">DEV · DESIGN SYSTEM</span>
        <h1 className="t-display">
          ספריית <span className="t-gradient">הרכיבים</span>
        </h1>
        <p className="t-body-lg text-ink-700">
          תצוגת אמת של ה־<span className="t-bracketed">primitives</span> מול מערכת העיצוב של קוד פתוח.
        </p>
      </header>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <div className="t-display">Display — כותרת ראשית</div>
          <div className="t-h1">H1 — הצעד הראשון הוא הכי קשה</div>
          <div className="t-h2">H2 — נעשה אותו ביחד</div>
          <div className="t-h3">H3 — קהילה לג&apos;וניוריות</div>
          <div className="t-body">Body — טקסט גוף רגיל לקריאה נוחה לאורך זמן.</div>
          <div className="t-caption">Caption — מטא-מידע משני</div>
          <div className="t-mono text-brand-pink-deep">{"<מונוספייס/>"}</div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3.5 items-center">
          <Button bracketed>התחילי עכשיו</Button>
          <Button>הצטרפות לקהילה</Button>
          <Button variant="secondary">הזמיני חברה</Button>
          <Button variant="ghost">למידע נוסף</Button>
          <Button variant="pill">+ פוסט חדש</Button>
          <Button size="sm">שלחי</Button>
          <Button variant="secondary" size="sm">
            שמרי טיוטה
          </Button>
          <Button disabled>כפתור מנוטרל</Button>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardLabel>Default</CardLabel>
            <div className="flex items-center gap-3">
              <Avatar initials="מ" />
              <div>
                <div className="font-display font-bold text-ink-1000">מאיה כהן</div>
                <div className="text-xs text-ink-500">פרונטאנד · מרכז</div>
              </div>
            </div>
            <CardTitle>סיימתי את הקורס הראשון 🎉</CardTitle>
            <CardBody>
              היה מאתגר אבל מאוד שווה. ממליצה לכל הג&apos;וניוריות להתחיל מ־&quot;יסודות JS&quot;.
            </CardBody>
          </Card>
          <Card interactive selected>
            <CardLabel className="text-brand-pink-deep">Interactive · Selected</CardLabel>
            <div className="flex items-center gap-3">
              <Avatar initials="ש" tone="gold" crown />
              <div>
                <div className="font-display font-bold text-ink-1000">שירה לוי</div>
                <div className="text-xs text-ink-500">מנטורית · באקאנד</div>
              </div>
            </div>
            <CardTitle>אני פה לעזור עם ראיונות</CardTitle>
            <CardBody>
              7 שנות ניסיון בבאקאנד, אשמח לתרגל איתך ראיונות מקצועיים בעברית או באנגלית.
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-col gap-5">
          <div className="flex gap-3.5 items-center">
            <Avatar initials="מ" size="xs" />
            <Avatar initials="מ" size="md" />
            <Avatar initials="ש" size="lg" tone="purple" />
            <Avatar initials="י" size="lg" tone="gold" crown />
            <Avatar initials="ר" size="xl" />
          </div>
          <AvatarStack extra={19}>
            <Avatar initials="מ" size="sm" />
            <Avatar initials="ש" size="sm" tone="purple" />
            <Avatar initials="ר" size="sm" />
            <Avatar initials="נ" size="sm" tone="gold" />
            <Avatar initials="י" size="sm" tone="purple" />
          </AvatarStack>
        </div>
      </Section>

      <Section title="Badges & chips">
        <div className="flex flex-wrap gap-2.5 items-center">
          <Badge variant="grad">חדש</Badge>
          <Badge variant="pink">ראיון מקצועי</Badge>
          <Badge variant="purple">ראיון HR</Badge>
          <Badge variant="indigo" dot>
            סשן בעוד 2 ימים
          </Badge>
          <Badge variant="mint">✓ הוגש</Badge>
          <Badge variant="warm">3 חודשים מינימום</Badge>
          <Badge variant="mentor">👑 מנטורית</Badge>
          <Badge variant="tech">React</Badge>
          <Badge variant="tech">Node.js</Badge>
          <Badge variant="tech">Python</Badge>
        </div>
      </Section>

      <Section title="Alerts">
        <div className="flex flex-col gap-3">
          <Alert variant="success" title="ההגשה יצאה לדרך 🎉">
            נחזיק לך אצבעות. תקבלי עדכון לאימייל ברגע שיש תשובה.
          </Alert>
          <Alert variant="info" title="סשן AI חדש פורסם">
            &quot;בניית RAG עם LangChain&quot; — מחר ב־20:00, עם הקלטה אחר כך.
          </Alert>
          <Alert variant="warn" title="הקורס הקודם לא הושלם">
            פתיחת קורס חדש תסגור את הקודם. רוצה להמשיך?
          </Alert>
          <Alert variant="danger" title="לא הצלחנו לשמור את קורות החיים">
            בואי ננסה שוב — אם זה ממשיך, כתבי לנו.
          </Alert>
        </div>
      </Section>

      <Section title="Progress">
        <div className="flex flex-col gap-6">
          <ProgressBar value={72} label="הפרופיל שלך" />
          <ProgressBar value={33} label="קורס: יסודות JavaScript" valueLabel="שיעור 4 מתוך 12" />
          <div className="flex gap-7 items-center">
            <ProgressRing value={68} />
            <div>
              <div className="font-display font-bold text-ink-1000">בודקות את קורות החיים שלך</div>
              <div className="font-mono text-xs text-brand-pink-deep">תהליך AI···</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
          <Field label="שם פרטי" htmlFor="f-name">
            <Input id="f-name" defaultValue="מאיה" />
          </Field>
          <Field label="אימייל" htmlFor="f-email">
            <Input id="f-email" placeholder="you@example.com" />
          </Field>
          <Field label="אזור מגורים" htmlFor="f-region">
            <Select id="f-region" defaultValue="מרכז">
              <option>מרכז</option>
              <option>צפון</option>
              <option>דרום</option>
              <option>ירושלים והסביבה</option>
            </Select>
          </Field>
          <Field label="טלפון" htmlFor="f-phone" error="המספר לא נראה לנו תקין">
            <Input id="f-phone" defaultValue="050" error />
          </Field>
          <Field label="קצת עליך" htmlFor="f-bio" className="md:col-span-2">
            <Textarea id="f-bio" placeholder="מה הביא אותך לעולם הפיתוח?" />
          </Field>
          <div className="md:col-span-2 flex flex-col gap-3 pt-1.5">
            <Checkbox defaultChecked label="אני מסכימה לתנאי השימוש" />
            <Checkbox label="שלחי לי עדכונים על משרות חדשות" />
            <Switch defaultChecked label="הצגת הסטטיסטיקות בדשבורד" />
          </div>
        </div>
      </Section>
    </main>
  );
}
