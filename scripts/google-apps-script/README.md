# Email sender — Google Apps Script

A tiny email service running on **your** Google Workspace account: the app POSTs a
formatted email + recipients, the script sends it. Runs under your account after a
one-time authorization — **no App Password, no 2-Step Verification needed**.

- Sends from your Workspace address (`office@opencode.org.il`), display name **קוד פתוח**.
- Quota (Workspace): **~1,500 recipients/day**.
- Supports a single recipient or a **group with `{{name}}` mail-merge**.

---

## Deploy (one time)

1. Go to **sheets.new** (or any Google Sheet) → menu **Extensions → Apps Script** (תוספים → Apps Script).
2. Delete the sample code, paste the contents of **[Code.gs](Code.gs)**.
3. Set the `SECRET` constant to a long random string. Keep it — you'll reuse it.
4. **Deploy → New deployment** → gear icon → type **Web app**:
   - Description: `Open Code mailer`
   - **Execute as:** Me (your account)
   - **Who has access:** **Anyone**
   - Deploy → approve the authorization prompt (it asks to send email on your behalf — that's the one-time consent).
5. Copy the **Web app URL** (ends in `/exec`).

## Connect to the app

Set two environment variables (locally in `.env.local`, and in **Vercel → Settings → Environment Variables**):

```
APPS_SCRIPT_EMAIL_URL=<the /exec URL>
APPS_SCRIPT_EMAIL_SECRET=<the same SECRET you put in Code.gs>
```

Redeploy on Vercel after adding them.

## Test it

```bash
curl -L -X POST "<the /exec URL>" \
  -H "content-type: application/json" \
  -d '{"secret":"<SECRET>","to":"you@example.com","subject":"בדיקה","html":"<b>שלום {{name}}</b>","name":"שרה"}'
```
Expect `{"ok":true,"sent":1,...}` and the email to arrive from **קוד פתוח**.

---

## How the app uses it

`src/lib/email/send.ts` exposes `sendEmail({ to, subject, html })` and group sends
(`recipients: [{email, name}]`). Call it from server code for notifications, group
announcements, etc.

### Routing Supabase signup/reset emails through this service
Supabase's auth emails (confirm signup, password reset) are sent by Supabase's own
mailer by default. To send **those** through this script too, enable Supabase's
**Send Email Hook** (Authentication → Hooks) pointing at an app route that formats the
email and calls `sendEmail`. Ask Claude to add that route — it's the next step.

## ⚠️ Quota note
The ~1,500/day quota is shared across everything this account sends. It's great for
transactional mail (confirmations, resets, the occasional group note). A full
newsletter blast to all 1,500 members would consume the entire day's quota in one go —
for big marketing blasts use a dedicated ESP (Brevo/SES) instead.
