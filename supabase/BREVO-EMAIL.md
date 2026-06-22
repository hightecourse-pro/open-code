# Email via Brevo (system emails from opencode.org.il)

Supabase sends auth emails (signup confirmation, password reset, …) through Brevo's
SMTP, branded with our Hebrew templates and sent from `noreply@opencode.org.il`.
No 2FA, no Apps Script, no webhook needed for these.

---

## Phase 1 — Brevo account + domain authentication

1. Sign up at **brevo.com** (free plan).
2. Top-right account menu → **Senders, Domains & Dedicated IPs** → **Domains** tab →
   **Add a domain** → enter `opencode.org.il`.
3. Brevo shows a set of **DNS records** to add (a `brevo-code` TXT, a DKIM record,
   and a recommended DMARC). Add them in your domain's DNS (at your registrar /
   DNS provider for opencode.org.il), **exactly as Brevo shows them**.
4. **SPF — merge, don't duplicate.** You already have a Google SPF record. Find the
   existing TXT that starts with `v=spf1 ... include:_spf.google.com` and add Brevo
   to the **same** record:
   `v=spf1 include:_spf.google.com include:spf.brevo.com ~all`
   ⚠️ Never create a second `v=spf1` record — two SPF records is invalid.
   ⚠️ Don't touch the Google **MX** records — those keep your inbox working.
5. Back in Brevo → **Authenticate / Verify**. Wait for DNS to propagate (minutes–2h)
   until the domain shows authenticated (green).

## Phase 2 — SMTP key

Brevo → **SMTP & API** → **SMTP** tab. Note:
- Server: `smtp-relay.brevo.com`
- Port: `587`
- Login: the email/login shown there
- **Generate a new SMTP key** → copy it (this is the password).

## Phase 3 — Supabase SMTP

Supabase → **Authentication → Settings → SMTP Settings** → enable **Custom SMTP**:

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | the Brevo SMTP login |
| Password | the Brevo SMTP key |
| Sender email | `noreply@opencode.org.il` |
| Sender name | `קוד פתוח` |

(Domain authentication in Phase 1 covers any address on opencode.org.il, so
`noreply@` works without separately verifying that exact address.)

## Phase 4 — Templates + URLs

- Supabase → **Authentication → Email Templates**:
  - **Confirm signup** → paste [email-templates/confirm-signup.html](email-templates/confirm-signup.html)
  - **Reset password** → paste [email-templates/reset-password.html](email-templates/reset-password.html)
  - Keep the `{{ .ConfirmationURL }}` placeholder.
- Supabase → **Authentication → URL Configuration**:
  - Site URL: `https://open-code-psi.vercel.app`
  - Redirect URLs: add `https://open-code-psi.vercel.app/**` and `http://localhost:3000/**`

## Phase 5 — Test

In the app → **"שכחת סיסמה?"** → enter your email → the reset email should arrive
**from "קוד פתוח" <noreply@opencode.org.il>**, branded. Sign up a new test user to
check the confirmation email too.

---

## Notes
- Free plan: **300/day** + a small Brevo logo in the footer. Enough for system emails.
- Sending a **newsletter to all members**: use Brevo's **Campaigns** (paid Starter
  ~$9/mo removes the daily cap and the logo, and gives a visual editor + unsubscribe).
- The Apps Script mailer + Send Email Hook we built stay available for app-driven
  group sends later (with the Sheet log), once that account's quota ramps up.
