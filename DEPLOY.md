# Deployment — Vercel + GitHub (CI/CD)

The pipeline:

```
git push  ─►  GitHub
                ├─► GitHub Actions (CI)  — lint · typecheck · build  (quality gate)
                └─► Vercel (CD)          — auto-build & deploy
                       • push to main  → Production
                       • pull request  → Preview deploy (unique URL)
```

No GitHub Actions step is needed for deploy itself — Vercel's Git integration deploys on every push. The Actions workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml)) is the quality gate that runs the same checks before merge.

---

## One-time setup (Vercel)

1. Go to **vercel.com → Add New → Project → Import Git Repository**.
2. Authorize GitHub for the **saraez** account and pick **`saraez/open-code`**.
3. Vercel auto-detects **Next.js** — leave build settings as default
   (Build: `next build`, Output: `.next`, Install: `npm install`).
4. Add the environment variables below (**Project → Settings → Environment Variables**), then **Deploy**.

### Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://cgxkoutlicmaygzwkxfa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Supabase secret key — server only |
| `NEDARIM_MOSAD_ID` | **Secret** | `7017683` |
| `NEDARIM_API_VALID` | **Secret** | Nedarim Plus API key |
| `AI_KEY_SECRET` | **Secret** | Encryption key for members' Gemini keys. **Generate a strong random value and never change it** (changing it makes saved keys undecryptable). `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | Public | The production URL, e.g. `https://open-code.vercel.app` or your custom domain |

> Set them for **Production** (and Preview, if you want previews to work against the same Supabase).

---

## After the first deploy

1. **Set `NEXT_PUBLIC_SITE_URL`** to the real Vercel URL (or custom domain) and redeploy — the Nedarim callback is built from it.
2. **Update the Nedarim Plus callback** in your Nedarim account to:
   `https://<your-domain>/api/webhooks/payments`
3. **Apply the database migrations** on the Supabase project (SQL Editor), if not already:
   `supabase/_phase1_all.sql`, then `supabase/_phase2_3_all.sql`.

---

## Day-to-day

- **Deploy** = just push to `main` (Vercel builds & ships automatically).
- **Preview** = open a pull request → Vercel posts a preview URL on the PR.
- **CI** = GitHub Actions runs lint + typecheck + build on every push/PR; red check = don't merge.
