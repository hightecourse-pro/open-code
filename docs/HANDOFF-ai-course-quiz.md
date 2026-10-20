# Handoff: שאלון בחירת מסלול ה-AI (הייטקורס) - דחיפה ל-GitHub ועלייה לפרודקשן

**למי זה מיועד:** סוכן Claude Code (או מפתח/ת) עם הרשאות: push ל-`hightecourse-pro/open-code`, Vercel team `saraaviezra-2779s-projects`, ו-Supabase של פרודקשן.
**נכתב:** 20/10/2026. **ריפו:** `c:\Users\devadmin\Desktop\open-code-community\open-code`, ענף `staging`.
**מצב:** העבודה הושלמה, נבדקה ופרוסה ב-staging. **לא** נדחפה ל-GitHub (אין הרשאות במכונה הזו) ו**לא** בפרודקשן. הפרויקט `esty-kermaier` לא נגע.

---

## 1. מה נבנה (תקציר)

עמוד ציבורי של הייטקורס (מחוץ לקהילת קוד פתוח, בלי התחברות) שמאבחן למי מתאים איזה מסלול בקורס "Advanced GenAI & Agentic AI for Developers":
- **מתקדם מאוד** - למי שכבר עובדת בפיתוח AI, מעדיפה להספיק ולא לתרגל. סילבוס: `public/ai-course/syllabus-advanced.pdf`.
- **מהבסיס - כולל תרגול** - למי שלומדת מהתחלה. סילבוס: `public/ai-course/syllabus-foundations.pdf`.

| נתיב | מה זה | קובץ |
|---|---|---|
| `/ai-course` | השאלון: פתיח → פרטים (מייל, שם פרטי, שם משפחה, "רשומה / מתכוונת להירשם") → 5 שאלות → המלצה + הורדת הסילבוס הנכון + "רוצה שנשבץ אותך?" | `src/app/ai-course/page.tsx`, `quiz.tsx`, `questions.ts`, `actions.ts`, `theme.ts`, `error.tsx` |
| `/ai-course/admin` | מערכת ניהול **נפרדת** של הייטקורס (לא בתוך האדמין של קוד פתוח), אותו שם משתמש וסיסמה (אותו Supabase Auth, נדרש `profiles.role = 'admin'`): מי מילאה, מה המסקנה, מי ביקשה שיבוץ, מי נעצרה באמצע (ואחרי כמה שאלות), ייצוא CSV | `src/app/ai-course/admin/page.tsx`, `login.tsx`, `dashboard.tsx` |
| DB | טבלה `ai_course_quiz_submissions` - שורה אחת לכל מייל, מתעדכנת אחרי כל תשובה (ככה רואים נטישות). ניקוד וההמלצה מחושבים **בשרת** (`finishQuiz`): 7+ מתקדם, 4- מהבסיס, באמצע מכריעה שאלת הקצב | `supabase/migrations/20261020100000_ai_course_quiz.sql`, טיפוסים ב-`src/types/database.ts` |
| QA | Playwright end-to-end, 12 בדיקות, יוצר ומנקה נתוני בדיקה בעצמו | `scripts/verify-ai-quiz.mjs` |

עיצוב: בשפת הסילבוס המודפס של הייטקורס (כחול `#004878`, צהוב `#F8C800`, Rubik, בלי אימוג'ים). **לא** צבעי קוד פתוח.

## 2. שני הבאגים שדווחו היום ותוקנו

1. **"אחרי השאלה השנייה הוא קופץ לי להתחלה"** - כל ההתקדמות הייתה בזיכרון של הדף; כל טעינה מחדש (פריסה חדשה שעלתה תוך כדי הבדיקה, טאב במובייל שהתרענן) החזירה לפתיחה. **תיקון:** ההתקדמות נשמרת ב-`sessionStorage` ומשוחזרת בטעינה (מפתח `hightecourse-ai-quiz-v1`), מתנקה בסיום.
2. **"This page couldn't load / Reload to try again, or go back." בסוף השאלון** - זה **לא** דף של Chrome אלא דף השגיאה המובנה של Next.js 16 (`global-error`), כלומר חריגה בצד הלקוח הגיעה ל-error boundary. הסיבה: התשובה האחרונה מחכה ל-`finishQuiz` בתוך `startTransition`, וב-React 19 דחייה של Promise בתוך transition עוברת ישר ל-error boundary. הקריאה נכשלה כי האתר נפרס מחדש תוך כדי המילוי (השרת עונה "Server Action not found") או בגלל ניתוק רגעי. **תיקון:** כל קריאת server action בתוך transition עטופה ב-try/catch; פריסה ישנה → טעינה מחדש אוטומטית אחת (וההתקדמות משתחזרת לאותה שאלה); כל כישלון אחר → הודעה "החיבור נקטע לרגע - נסי שוב" עם אפשרות ללחוץ שוב. בנוסף `src/app/ai-course/error.tsx` - דף שגיאה ממותג בעברית כרשת ביטחון אחרונה.

**לקח חשוב:** לא לפרוס גרסה חדשה בזמן ששרה באמצע בדיקה - זה בדיוק מה שהפיל אותה פעמיים.

## 3. המצב ברגע הכתיבה

- **Staging פרוס ומאומת:** https://open-code-psi.vercel.app/ai-course ו-https://open-code-psi.vercel.app/ai-course/admin (פרויקט Vercel `open-code`, Supabase `cgxkoutlicmaygzwkxfa`). `node scripts/verify-ai-quiz.mjs` → 12/12 ✅ (שני המסלולים, נטישה, שחזור אחרי רענון, ניתוק רשת בשאלה האחרונה, פריסה ישנה בשאלה האחרונה, DB, אדמין).
- **קומיטים מקומיים על `staging` שלא ב-origin** (`git log --oneline origin/staging..HEAD`):
  - `f7e733f` AI course quiz: public Hightecourse track-picker (/ai-course) + admin screen
  - `68bb69d` AI course quiz: staging verify script
  - `c84b796` AI quiz: syllabus-styled redesign + standalone Hightecourse admin
  - `122fe01` AI course quiz: survive page reloads (resume at the same question)
  - `08f2c37` AI course quiz: never show Next's "This page couldn't load" at the end
  - (+ הקומיט של המסמך הזה)
- **פרודקשן (`main` → פרויקט Vercel `open-code-prod`, https://app.opencode.org.il, Supabase `ugedvcvtfwtamjkzjthg`): לא נגעו.** המיגרציה לא הורצה שם ו-`main` לא מוזג.
- `npm run build` עובר. עץ העבודה נקי.

## 4. מה לעשות - צעד אחר צעד

### שלב א - push ל-GitHub (אפשר מיד)

```bash
cd c:/Users/devadmin/Desktop/open-code-community/open-code
git status                                # צריך להיות נקי
git log --oneline origin/staging..HEAD    # הקומיטים מסעיף 3
git push origin staging
```
אם יש בקשת הזדהות: במכונה הזו אין credentials ל-`hightecourse-pro`. להתחבר עם `gh auth login` או PAT עם scope `repo`.

### שלב ב - אישור של שרה על staging

לפני כל דבר בפרודקשן: שרה מאשרת את https://open-code-psi.vercel.app/ai-course (השאלון מקצה לקצה, ההורדה של שני הסילבוסים, ומסך הניהול ב-`/ai-course/admin` עם המשתמש שלה). **לא להמשיך לשלב ג בלי אישור מפורש.**

### שלב ג - המיגרציה ב-Supabase של פרודקשן (לפני הקוד!)

בלי הטבלה, `/ai-course` ו-`/ai-course/admin` ייכשלו בפרודקשן. להריץ את `supabase/migrations/20261020100000_ai_course_quiz.sql` על הפרויקט `ugedvcvtfwtamjkzjthg`. התקדים בפרויקט: Supabase Management API:

```bash
# ערכים מתוך .env.deploy.local בריפו: SUPABASE_ACCESS_TOKEN, PROD_PROJECT_REF (= ugedvcvtfwtamjkzjthg)
curl -X POST "https://api.supabase.com/v1/projects/$PROD_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data "$(node -e 'console.log(JSON.stringify({query: require("fs").readFileSync("supabase/migrations/20261020100000_ai_course_quiz.sql","utf8")}))')"
```
הערות:
- המיגרציה משתמשת ב-`create table/index if not exists`, אבל `create policy` ייכשל אם תריצו פעמיים - במקרה כזה להוסיף לפניו `drop policy if exists "ai_course_quiz_admin" on public.ai_course_quiz_submissions;`.
- היא מניחה שהפונקציה `public.is_admin()` קיימת בפרודקשן (קיימת ב-staging; היא חלק מהסכמה המשותפת). לוודא: `select proname from pg_proc where proname = 'is_admin';`.
- אימות: `select count(*) from public.ai_course_quiz_submissions;` → 0, ו-`select policyname from pg_policies where tablename = 'ai_course_quiz_submissions';` → `ai_course_quiz_admin`.

### שלב ד - מיזוג ל-main ופריסה לפרודקשן

```bash
git checkout main && git pull origin main
git merge --no-ff staging -m "Release: Hightecourse AI-course quiz (/ai-course + /ai-course/admin)"
git push origin main
```
- אם האינטגרציה של Vercel עם GitHub פעילה ל-`open-code-prod`, ה-push מפעיל פריסה. לבדוק ב-Vercel שנוצר deployment חדש ל-`open-code-prod`.
- אם לא: `.vercel/project.json` בריפו מקושר ל-**staging** (`open-code`). לפרוס ל-prod בלי לשבור את הקישור: `npx vercel link --yes --project open-code-prod --token "$VERCEL_TOKEN"` → `npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"` → ואז להחזיר: `npx vercel link --yes --project open-code --token "$VERCEL_TOKEN"` (`.vercel/` ב-gitignore).
- אין משתני סביבה חדשים. אין שינוי ב-`proxy.ts`, ב-layout או בכל עמוד קיים; כל הקבצים חדשים חוץ מ-`src/types/database.ts` (נוספו טיפוסי הטבלה) ו-`.gitignore`.

### שלב ה - בדיקה בפרודקשן

1. לפתוח https://app.opencode.org.il/ai-course, למלא עם מייל בדיקה (למשל `qa.aiquiz@opencode.test`), לעבור את 5 השאלות, לוודא המלצה + הורדת PDF + "כן, שבצו אותי".
2. https://app.opencode.org.il/ai-course/admin - להיכנס עם המשתמש של שרה, לראות את שורת הבדיקה, ואז למחוק אותה (`delete from public.ai_course_quiz_submissions where email = 'qa.aiquiz@opencode.test';`).
3. אופציונלי: להריץ את ה-E2E המלא מול פרודקשן. הסקריפט קורא את מפתחות ה-DB מ-`.env.local` (staging), אז צריך לספק את ה-service-role של prod: להוסיף לסקריפט תמיכה ב-`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` מה-env (שתי שורות ב-`createClient`) ולהריץ `BASE_URL=https://app.opencode.org.il node scripts/verify-ai-quiz.mjs`. הסקריפט יוצר משתמשת אדמין זמנית ומוחק אותה - בסדר גם בפרודקשן, אבל להריץ פעם אחת ולוודא שהניקוי בסוף הצליח (`🧹 cleaned`).

### שלב ו - להודיע לשרה
קישורים לפרודקשן + מה נבדק. ולהזכיר: מכאן והלאה, לא לפרוס בזמן שהיא בודקת.

## 5. אם משהו נשבר

- "This page couldn't load" (אנגלית, שחור-לבן) = Next error boundary, חריגה בצד לקוח. הדף הממותג בעברית (`error.tsx`) אמור להופיע במקומו ב-`/ai-course`; אם רואים את האנגלי - השגיאה קרתה מחוץ ל-`/ai-course` (למשל ב-layout).
- השאלון "תקוע" על שאלה אחרי רענון - זה השחזור מ-`sessionStorage`; לנקות: `sessionStorage.removeItem("hightecourse-ai-quiz-v1")`.
- לוגים של Vercel במסלול הזה כמעט לא נשמרים (`npx vercel logs --deployment …` מחזיר ריק) - לבדוק עם ה-E2E או לוקאלית: `npm run build && npx next start -p 3017` ואז `BASE_URL=http://localhost:3017 node scripts/verify-ai-quiz.mjs`.
