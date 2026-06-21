# Auth setup — friendly emails + Google sign-in

All of this is configured in the **Supabase dashboard** (+ Google Cloud for OAuth). No code changes needed — the app already supports it.

---

## 1. Friendly emails (sender name + branded templates)

By default Supabase sends from its own address with "Supabase" as the name. Two steps to brand it:

### 1a. Custom SMTP — Google Workspace (opencode.org.il)

Sending through the existing Google Workspace is **free** (included), ~2,000 emails/day,
and branded from the domain (good inbox deliverability). No extra provider needed for
system emails.

**Step 1 — App Password** (the Workspace account needs 2-Step Verification on):
myaccount.google.com → Security → 2-Step Verification → **App passwords** → create one for
"Mail" → copy the 16-char code.

**Step 2 — Supabase → Authentication → Settings → SMTP** → enable Custom SMTP:
- **Host:** `smtp.gmail.com`
- **Port:** `465`
- **Username:** `office@opencode.org.il`
- **Password:** the App Password (16 chars)
- **Sender email:** `office@opencode.org.il` (or a `noreply@opencode.org.il` alias once added in Gmail → Settings → "Send mail as")
- **Sender name:** `קוד פתוח`

**Step 3 — DKIM (deliverability)** — admin.google.com → Apps → Google Workspace → Gmail →
**Authenticate email** → Generate record for `opencode.org.il` → add the TXT record in DNS →
Start authentication.

> Limits: ~2,000/day on `smtp.gmail.com`. If you ever need more, switch to Workspace
> **SMTP relay** (`smtp-relay.gmail.com`, admin-configured, up to ~10,000/day).
>
> Marketing newsletters (bulk to all members) are a separate, paid concern — use Rav Masser /
> Brevo for those, not the system-email SMTP above.

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
