# קוד פתוח (Open Code) — Web App

אפליקציית ה-production של קהילת קוד פתוח — קהילה חמה ותומכת לג'וניוריות בהייטק.
עברית, RTL, לשון נקבה, קול "אחות גדולה".

> מבוסס על מערכת העיצוב ב-`../Open Code Community Design System (1)`.
> תוכנית היישום המלאה: `~/.claude/plans/golden-kindling-hopcroft.md`.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme`, ללא `tailwind.config.ts`)
- **Supabase** (Postgres, Auth, Storage, Realtime, RLS)
- אייקונים: **lucide-react** · וריאנטים: **cva** + **tailwind-merge**

> ⚠️ Next 16: "Middleware" שונה ל-**Proxy** (`src/proxy.ts`, export בשם `proxy`).
> לפני עבודה על תכונות Next, קראי את הדוקים המקומיים ב-`node_modules/next/dist/docs/`.

## הרצה

```bash
npm install
cp .env.example .env.local   # מלאי מפתחות Supabase / Anthropic / נדרים פלוס
npm run dev                  # http://localhost:3000
```

- `/` — דף נחיתה (placeholder)
- `/dev/components` — **גלריית ספריית הרכיבים** (אימות ויזואלי מול מערכת העיצוב)
- `/feed` — מעטפת אפליקציית הקהילה (sidebar ימני)
- `/admin` — מעטפת אדמין (sidebar כהה)

## מבנה

```
src/
├─ app/
│  ├─ (app)/        # אזור מחובר — AppShell (sidebar ימני)
│  ├─ (admin)/      # אדמין — AdminShell (sidebar כהה)
│  ├─ dev/components/  # גלריית רכיבים
│  ├─ globals.css   # tokens (:root) + @theme + type classes
│  └─ layout.tsx    # root RTL + פונטים (Noto Sans Hebrew, JetBrains Mono)
├─ components/
│  ├─ ui/           # primitives: Button, Card, Avatar, Badge, Alert, Progress, form, Switch
│  └─ layout/       # AppShell, Sidebar, TopNav, AdminShell, AdminSidebar
├─ lib/
│  ├─ supabase/     # client / server / admin / proxy (session refresh)
│  ├─ i18n.ts       # t() — single-locale Hebrew lookup
│  └─ utils.ts      # cn()
├─ messages/he.json # כל הקופי בעברית
└─ proxy.ts         # Next 16 Proxy → רענון session
```

## עקרונות

- **Tokens כמקור אמת:** ערכי העיצוב מ-`colors_and_type.css` הועברו verbatim ל-`globals.css`
  (`:root`), וממופים ל-utilities של Tailwind דרך `@theme inline`. כך markup שמודבק
  ממערכת העיצוב (עם `var(--brand-pink)` וכו') עובד ללא שינוי, וגם `bg-brand-pink` / `rounded-lg` זמינים.
- **קופי מרוכז:** אין טקסט hardcoded ב-JSX — הכל ב-`messages/he.json` דרך `t()`.
- **RTL לוגי:** שימוש ב-`ms-/me-/ps-/pe-/start-/end-` (לא `left/right`).
- **אבטחה:** מפתח service-role ו-Anthropic — server-only בלבד.

## שלב נוכחי

**Phase 0 הושלם** — תשתית + ספריית רכיבים + מעטפות + scaffolding ל-Supabase/i18n.
הבא: **Phase 1** — auth + תשלום (נדרים פלוס) + subscription gate + פיד/פורום + פרופילים + אדמין.
