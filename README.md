# Dram

A mobile app for whiskey drinkers: log what you've tried in seconds, rank it Beli-style with quick "which did you prefer?" comparisons, go deep with notes and an expert scoresheet when you want to, discover through friends, and keep track of every pour at a tasting event.

> Status: **M0 — schema and edge functions deployed; the app runs on iOS, Android and the web.** See [`docs/05-roadmap.md`](docs/05-roadmap.md).
>
> Originally scaffolded inside the GeoMatch repository; the history was extracted with `git subtree split` when it moved here.

## Documents

| | |
|---|---|
| [`docs/01-requirements.md`](docs/01-requirements.md) | Vision, personas, V1 scope, flows, acceptance criteria, V2 |
| [`docs/02-data-model.md`](docs/02-data-model.md) | Entities, ranking math, search, visibility rules, RPC reference |
| [`docs/03-infrastructure.md`](docs/03-infrastructure.md) | Stack, architecture, environments, security, scaling |
| [`docs/04-deployment.md`](docs/04-deployment.md) | Local dev, provisioning Supabase, EAS builds, CI/CD, migrations |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Milestones |

## Layout

```
apps/mobile/      Expo (SDK 57) + expo-router app — TypeScript, TanStack Query, Supabase JS
supabase/         Postgres migrations, seed, RLS, RPCs, edge functions, SQL smoke tests
docs/             planning documents
```

## Quick start

```bash
# database (needs Docker) …
cd supabase && supabase start && supabase db reset
# … or Docker-free schema check against any Postgres 16+
PGHOST=localhost PGUSER=postgres supabase/scripts/local-check.sh

# app — press w for the browser, or scan the QR code with Expo Go
cd apps/mobile && cp .env.example .env && npm install && npx expo start
npm test && npm run typecheck
```

The browser is the quickest way to try a change: no device, no Expo Go, no
native build. Sign in with the link in the email rather than the 6-digit code
(see [`docs/04-deployment.md`](docs/04-deployment.md) for why, and how to turn
the code on). The camera screens fall back to a file picker there, and push
notifications need a real device build.

Pushing to `main` publishes the web build to GitHub Pages via
[`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml); set
Settings → Pages → Source to "GitHub Actions" once to enable it.

Full instructions in [`docs/04-deployment.md`](docs/04-deployment.md).

## How ranking works (the 30-second version)

1. Pick a tier: 😍 Loved · 🙂 Liked · 😐 Fine · 👎 Not for me.
2. Answer a few "which did you prefer?" questions against whiskeys already in that tier (binary search, ≤ ⌈log₂(n+1)⌉ questions).
3. Your list updates; every whiskey's 0–10 score is derived from its position (`supabase/migrations/20260917000300_rankings_tastings.sql`, mirrored in `apps/mobile/src/lib/ranking.ts`).

Everything else — notes, flavor tags, photos, the 100-point scoresheet — is optional and never changes your ranking.
