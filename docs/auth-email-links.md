# קישורי מייל של התחברות — מה צריך להיות מוגדר

מסמך תפעולי: מה בקוד כבר מסודר, ומה חייב להיעשות ידנית בדשבורד של Supabase
כדי שקישורי "אישור הרשמה" ו"איפוס סיסמה" יעבדו. בלי הצעדים הידניים — שינוי הקוד
לבדו לא משנה כלום למי שמקבלת את המייל.

## הבעיה שתוקנה

הקישור במייל הצביע על `<project>.supabase.co/auth/v1/verify?...`, שמוביל בסוף
ל‑`/auth/callback?code=`. החלפת ה‑`code` בסשן דורשת עוגייה (`code-verifier`)
שנשמרת **רק בדפדפן שממנו נשלחה הבקשה**. לכן מי שנרשמה במחשב ופתחה את המייל
בטלפון קיבלה "הקישור כבר לא בתוקף" בלחיצה הראשונה, וקישור איפוס הסיסמה נשבר
באותה צורה.

התיקון: כל קישור במייל מצביע עכשיו על הדומיין שלנו, אל `/auth/confirm`, שמאמת
את הטוקן בשרת (`verifyOtp` + `token_hash`) — עובד מכל דפדפן ומכל מכשיר.

## מה כבר בקוד

- `src/lib/email/auth-links.ts` — הופך קישור `auth/v1/verify` של Supabase
  לקישור `/auth/confirm` על הדומיין שלנו. גם ממפה `email_change_current` /
  `email_change_new` ל‑`email_change` (בלי המיפוי הזה קישור שינוי כתובת מת).
- `src/lib/email/templates.ts` — ארבעת מיילי ההתחברות מריצים את הקישור דרך
  `toSiteAuthLink`. זה מכסה את מסלול ה‑Send Email Hook.
- `src/app/auth/confirm/route.ts` — אימות `token_hash`, הגנה על `next`
  (רק נתיבים באתר שלנו), והפניה ל‑`/login?error=auth&type=…` בכישלון.
- `src/app/auth/callback/route.ts` — נשאר לגוגל ולמיילים ישנים שעוד בדרך. **לא למחוק.**
- `src/app/(auth)/login/page.tsx` — נוסח שונה לקישור אישור שנוצל ("כנראה שכבר
  אושרת, פשוט היכנסי") מול קישור איפוס שפג ("בקשי קישור חדש").

## מה צריך לעשות ידנית (בעלת המוצר)

### 1. תבניות המייל בדשבורד

Supabase → **Authentication → Email Templates**. להחליף בכל תבנית את
`{{ .ConfirmationURL }}` בכתובת המפורשת:

- **Confirm signup**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/forum`
- **Reset password**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- **Magic link**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/forum`
- **Change email address**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/profile`

בלי השינוי הזה בדשבורד — התבניות שבקוד לא משפיעות על כלום, כי Supabase שולח
את מה שכתוב אצלה.

> הערה: קבצי הייחוס `supabase/email-templates/*.html` ושתי ההוראות
> "Keep the `{{ .ConfirmationURL }}` variable" ב‑`supabase/AUTH-SETUP.md`
> וב‑`supabase/BREVO-EMAIL.md` עדיין מפנים לנוסח הישן וצריך לעדכן אותם.

### 2. כתובות מורשות

Supabase → **Authentication → URL Configuration**:

- **Site URL** — בדיוק הדומיין החי (אותו ערך כמו `NEXT_PUBLIC_SITE_URL` ב‑Vercel).
- **Redirect URLs** — להוסיף `https://<הדומיין-החי>/**` (ולהשאיר
  `http://localhost:3000/**` לפיתוח).

### 3. משתני סביבה ב‑Vercel

- `NEXT_PUBLIC_SITE_URL` חייב להיות הדומיין של הפרודקשן. אם הוא `localhost`
  (כמו ב‑`.env.local`), כל קישור שיוצא ממנו שבור בכל מכשיר אחר.
- אם ה‑**Send Email Hook** מופעל ב‑Supabase: `SEND_EMAIL_HOOK_SECRET`,
  `APPS_SCRIPT_EMAIL_URL` ו‑`APPS_SCRIPT_EMAIL_SECRET` חייבים להיות מלאים —
  אחרת ההוק מחזיר 500 וההרשמה עצמה נכשלת ב"Error sending confirmation email".
  אם משתמשים ב‑Custom SMTP (Brevo) במקום — צריך לוודא שההוק **כבוי**.

## איך בודקים

1. לבקש איפוס סיסמה מהמחשב, ולפתוח את המייל **בטלפון**. הקישור צריך לפתוח את
   מסך "בחירת סיסמה חדשה" ולאפשר לסיים.
2. להירשם עם כתובת חדשה במחשב, ולפתוח את מייל האישור **בטלפון**. הקישור צריך
   להוביל לפורום כשהיא מחוברת.
3. ללחוץ שוב על אותו קישור — עכשיו זו הודעה נעימה ומדויקת במסך הכניסה, לא שגיאה.
