# Auth setup — friendly emails + Google sign-in

All of this is configured in the **Supabase dashboard** (+ Google Cloud for OAuth). No code changes needed — the app already supports it.

---

## 1. Friendly emails (sender name + branded templates)

By default Supabase sends from its own address with "Supabase" as the name. Two steps to brand it:

### 1a. Custom SMTP (sets the From name & address)
Supabase → **Authentication → Settings → SMTP Settings** → enable **Custom SMTP**.

Recommended provider: **Resend** (you already have a `RESEND_API_KEY` slot).
1. Create a Resend account, verify your sending domain (or use their test domain to start).
2. In Resend → API Keys → create a key.
3. Back in Supabase SMTP settings, fill:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key
   - **Sender email:** e.g. `noreply@your-domain.com` (must be a verified domain in Resend)
   - **Sender name:** `קוד פתוח`   ← this is the friendly display name
4. Save.

> Until you set custom SMTP, Supabase's built-in mailer works but shows "Supabase" and is rate-limited (~a few emails/hour) — fine for testing, not for production.

### 1b. Branded Hebrew templates
Supabase → **Authentication → Email Templates**. For each template, paste the matching file:
- **Confirm signup** → [email-templates/confirm-signup.html](email-templates/confirm-signup.html)
- **Reset password** → [email-templates/reset-password.html](email-templates/reset-password.html)

Keep the `{{ .ConfirmationURL }}` variable — that's the link Supabase fills in.

### 1c. URL configuration (so links point to the live site)
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://open-code-psi.vercel.app`
- **Redirect URLs:** add `https://open-code-psi.vercel.app/**` (and `http://localhost:3000/**` for local dev)

---

## 2. Google sign-in (OAuth)

The app already has the callback route (`/auth/callback`). You need to (a) create Google credentials, (b) enable the provider in Supabase, (c) add a button — already wired once the provider is on.

### 2a. Google Cloud Console — create OAuth credentials
1. Go to **console.cloud.google.com** and sign in.
2. Top bar → **project selector** → **New Project** → name it `Open Code` → Create → select it.
3. Left menu → **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create
   - App name: `קוד פתוח`, support email: yours, developer email: yours → Save and continue
   - Scopes: Save and continue (defaults are fine — email, profile)
   - Test users: add your own email while in "Testing" mode → Save
   - (To open it to everyone later: **Publish app**.)
4. Left menu → **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Open Code Web`
   - **Authorized JavaScript origins:** `https://open-code-psi.vercel.app`
   - **Authorized redirect URIs:** add exactly:
     `https://cgxkoutlicmaygzwkxfa.supabase.co/auth/v1/callback`
   - Create → copy the **Client ID** and **Client Secret**.

### 2b. Enable in Supabase
Supabase → **Authentication → Providers → Google** → enable → paste **Client ID** + **Client Secret** → Save.

### 2c. App button
Ask Claude to add the "התחברות עם Google" button — it calls
`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<site>/auth/callback' } })`.
New Google users get a profile row automatically (status `pending`) via the existing trigger.
