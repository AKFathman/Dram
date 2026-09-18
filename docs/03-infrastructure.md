# Dram — Infrastructure

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **React Native + Expo (SDK 57), Expo Router, TypeScript** | One codebase for iOS + Android, file-based routing, OTA updates, EAS build/submit without a Mac in CI. |
| State / data | **TanStack Query** over a thin `api.ts` | Caching, retries, offline-tolerant reads, one place for invalidation. |
| Backend | **Supabase** (Postgres 17, Auth, Storage, Edge Functions, Realtime) | Postgres + row-level security means the app talks to the DB directly with no bespoke API server to build, host, or secure. Auth (Apple/Google/email OTP), Storage (signed URLs), Edge Functions (Deno) come with it. |
| Search | Postgres `pg_trgm` + `unaccent` | Typo-tolerant search on a 50k-row catalog without running a search cluster. Swap to Typesense/Meilisearch only if the catalog passes ~1M rows. |
| Label recognition | **Claude (`claude-opus-5`) vision + structured outputs** via an Edge Function | One request turns a photo into `{brand, expression, age, abv, …}`; we then reuse the same search RPC. |
| Push | **Expo Push Service** via `send-push` Edge Function, triggered by a Database Webhook on `notifications` | No APNs/FCM plumbing; one HTTP call fans out to every device. |
| Crash / analytics | Sentry (`@sentry/react-native`), PostHog | Add in the "pre-launch" milestone; both have Expo config plugins. |
| CI | GitHub Actions | Typecheck + unit tests, schema check against a throwaway Postgres, edge-function typecheck. EAS builds on tags. |

Everything sits on managed services with a free tier; the first ~10k MAU cost is dominated by Supabase Pro ($25/mo) + EAS ($0–99/mo) + Claude usage (a label scan is ≈ $0.01–0.02).

## 2. Architecture

```
 ┌───────────────────────────────┐            ┌─────────────────────────────────────────┐
 │  Expo app (iOS / Android)     │            │  Supabase project                        │
 │                               │  HTTPS     │                                          │
 │  expo-router screens          │ ─────────► │  PostgREST  ──► Postgres 17              │
 │  TanStack Query cache         │  JWT       │     (RLS on every table, RPCs)           │
 │  supabase-js (anon key + JWT) │ ◄───────── │  GoTrue auth (Apple / Google / email OTP)│
 │  AsyncStorage session         │            │  Storage (5 buckets, signed URLs)        │
 │                               │            │  Realtime (V1.5: live leaderboards)      │
 │  expo-camera → base64 ────────┼──────────► │  Edge fn `identify-label` ──► Claude API │
 │  expo-notifications token ────┼──────────► │  push_tokens table                       │
 └───────────────────────────────┘            │  DB webhook (notifications INSERT)       │
                                              │      └──► Edge fn `send-push` ──► Expo   │
                                              └─────────────────────────────────────────┘
```

**Trust boundary.** The app ships only the anon key; every read/write is authorized by RLS using the user's JWT. Edge functions run with the service key but re-check authorization explicitly. The Anthropic key lives only in Supabase secrets.

## 3. Environments

| Env | Supabase | App | Purpose |
|---|---|---|---|
| **local** | `supabase start` (Docker) — or the Docker-free `scripts/local-check.sh` against a plain Postgres 16/17 | `npx expo start` + Expo Go / dev client | Day-to-day dev, schema work |
| **staging** | Supabase project `dram-staging` | EAS `preview` builds (internal distribution), channel `preview` | QA, TestFlight/internal testing, event dry-runs |
| **production** | Supabase project `dram-prod` | EAS `production` builds → App Store / Play, channel `production` | Real users |

Config that differs per env is injected as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (EAS secrets per profile) — see `apps/mobile/.env.example` and `eas.json`.

## 4. Repository layout

```
(repo root)
  apps/mobile/            Expo app
    src/app/              routes (expo-router)
    src/components/       UI primitives + feature components
    src/hooks/            React Query hooks
    src/lib/              api.ts, supabase.ts, auth.tsx, ranking.ts, database.types.ts (generated)
    src/theme/            tokens
  supabase/
    migrations/           0100 catalog · 0200 events · 0300 rankings/tastings · 0400 social · 0500 functions · 0600 RLS · 0700 storage · 0800 V2 prices
    seed/                 flavor wheel, whiskey catalog
    functions/            identify-label, send-push (Deno)
    tests/smoke.sql       end-to-end SQL assertions (ranking math, RLS, events, moderation)
    scripts/              local-check.sh (Docker-free), gen-types.py, _supabase_stub.sql
    config.toml           Supabase CLI config
  docs/                   this folder
```

## 5. Security and privacy

- **RLS everywhere** (`0600_rls.sql`). Anonymous role has no grants; the app requires sign-in.
- **Security-definer functions** are the only places RLS is bypassed; each re-validates (membership, follow/block, moderator).
- **Secrets**: `ANTHROPIC_API_KEY`, `WEBHOOK_SECRET`, OAuth client secrets in Supabase (`supabase secrets set` / dashboard). No secrets in the repo or the app bundle.
- **Storage**: private buckets for tasting photos and label scans; public buckets only for avatars/catalog/event covers. Object keys are prefixed by owner uid and policies check that prefix.
- **PII**: we store a birthdate *check* (`age_verified_at`), not the birthdate. Email lives only in `auth.users`.
- **Self-serve GDPR/CCPA**: `export_my_data()` and `delete_my_account()` RPCs (cascade deletes everything).
- **Abuse**: blocks, reports table, moderator role, private profiles, follow requests.
- **App-store compliance**: alcohol content → iOS age rating 17+, Google Play "Mature 17+"; age gate at onboarding; no purchasing in V1.

## 6. Scaling notes (what breaks first, and the fix)

| Component | Comfortable to | Then |
|---|---|---|
| `feed()` scanning `activities` by followed users | ~1M activities, users following < 2k people | Materialize per-user inboxes (fan-out on write) or paginate by `(actor_id, id)` with a composite index |
| Trigram search on `whiskeys` | ~500k rows | Typesense / Meilisearch fed by a `whiskeys` trigger |
| Leaderboard RPC (computed per request) | events with < 200 pours × 2k attendees | Cache in Realtime broadcast; refresh every 10 s from a cron |
| Whiskey stats trigger | fine at any scale (statement-level) | — |
| Edge function cold starts (~300 ms) | fine | Keep functions small; the Claude call dominates anyway |

## 7. Observability

- **Supabase**: query performance (pg_stat_statements) and slow-query log in the dashboard; API logs per request; Edge Function logs.
- **App**: Sentry for crashes and JS errors (release + dist tagged from EAS), PostHog for funnels (activation, time-to-first-rank, event completion rate).
- **Alerts**: Supabase usage alerts (DB size, egress), Sentry issue alerts, GitHub Actions failure notifications.
