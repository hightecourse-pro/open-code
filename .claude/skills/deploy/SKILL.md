---
name: deploy
description: How to ship any change to קוד פתוח — staging first, verified automatically, and production only after the owner approves. Use for every code, SQL, or content change, and whenever asked to deploy, push, or release.
---

# Shipping a change

There are two live environments and real members' money and data are in one of
them. **Nothing reaches production without the owner saying yes.**

| | staging | production |
|---|---|---|
| URL | `open-code-psi.vercel.app` | `app.opencode.org.il` |
| Vercel project | `open-code` (`prj_gtpizglDIWtNfjtJrC0mxjzVKuLl`) | `open-code-prod` (`prj_0UQBiHUT6GJk2YHkSVK3l3QGlsEv`) |
| Supabase ref | `cgxkoutlicmaygzwkxfa` (eu-west-1) | `ugedvcvtfwtamjkzjthg` (eu-central-1) |
| branch | `staging` | `main` |
| holds | test data, safe to break | real paying members |

Credentials for both live in `.env.deploy.local` (gitignored): a Supabase
access token and a Vercel token. The Supabase token can run SQL on either
project through `POST https://api.supabase.com/v1/projects/{ref}/database/query`
— no database password needed.

## The loop, every time

1. **Build it on `staging`.** Never commit to `main` directly. If the working
   tree is on `main`, branch first.
2. **Deploy to staging** and wait for it to be live.
3. **Verify automatically** — see the checklist below. Run it; do not ask the
   owner to click through things a script can check.
4. **Report** what changed, what the checks found, and anything still uncertain.
5. **Ask for approval to deploy to production.** Say plainly what production
   will get. Wait for a yes.
6. **Only then** merge to `main` and let production deploy. Verify production
   with the same checks afterwards and report.

Skipping step 5 is never acceptable, including for "obvious" or "tiny" fixes.
If the owner has already approved a specific change in this conversation, that
approval covers that change only.

## Verification checklist

Always:

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Then, matched to what changed:

- **UI or flow** — drive the staging URL with Playwright (`npm run test:e2e`)
  or a scripted browser pass. Look at what rendered; a page that returns 200
  with a broken layout still counts as broken.
- **Server actions / API routes** — call them against staging and read the
  response body, not just the status.
- **Database** — after applying to staging, compare the two schemas
  object-by-object (columns, views, functions, policies, indexes, enums,
  triggers, RLS, storage buckets). They must differ only in data rows. This
  check is what caught a column that existed in code but not in the database.
- **Anything touching email, payments, or Drive** — confirm the staging guard
  actually blocked the real-world side effect, rather than assuming it did.

## Database changes

- A migration that has been applied is **never edited**. Corrections go in a new
  file with a new timestamp, applied to both environments.
- Place a new migration so that it runs after everything it depends on and
  before anything that references what it introduces. Verify by building a
  schema from zero, not by reading.
- Never run SQL by hand in the dashboard. A statement that only ever ran in the
  SQL editor is invisible to the next environment — and in the SQL editor the
  whole file is one transaction, so one bad statement silently rolls the rest
  back. That is exactly how `sessions.open_to_all` went missing while the code
  depended on it.
- `supabase/_*.sql` files are history. `supabase/migrations/` is the truth.
- `supabase/demo/` holds seed data with invented job listings at real company
  names. It must never run against production.

## What staging must never do

Staging shares the Nedarim account with production, by the owner's decision.
So a payment made on staging is a **real charge on a real card**, and it opens a
recurring standing order that the app cannot cancel — only Nedarim can. Do not
test payments on staging casually, and tell the owner when a test would create
one.

Staging must never send mail to a real address, and never grant or revoke real
Google Drive access — the same service account serves both environments, so the
only thing standing between a staging test and a real member losing her course
materials is the guard in the code. Treat those guards as load-bearing.

## Secrets

`AI_KEY_SECRET` in production is written once and never changed: it decrypts
members' AI keys and the employer portal passwords, and every decryption failure
is silent. Never move a production secret into staging, never put a secret
anywhere a browser can read it — the Nedarim callback secret belongs in the
Nedarim dashboard URL and in Vercel, never in page code.

## Specification

A change that affects behaviour the QA document describes also updates the PDF
in `qa-spec/` and the owner is told there is a new version. That is a standing
rule, not a nicety.
