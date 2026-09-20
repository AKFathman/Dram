# Dram — Deployment

## 0. Prerequisites

- Node 22+, npm 10+
- Supabase CLI (`npm i -g supabase` or `npx supabase`), Docker Desktop for `supabase start` (optional — see Docker-free path)
- Expo account + EAS CLI (`npm i -g eas-cli`), Apple Developer Program, Google Play Console
- Anthropic API key (for label recognition)

## 1. Local development

```bash
# 1) Database — full Supabase stack
cd supabase
supabase start                 # Postgres, Auth, Storage, Studio on http://localhost:54323
supabase db reset              # applies migrations/*.sql then seed/*.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f tests/smoke.sql

#    Docker-free alternative (schema + smoke tests only, no Auth/Storage):
PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/local-check.sh

# 2) App
cd ../apps/mobile
cp .env.example .env           # EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, anon key from `supabase status`
npm install
npx expo start                 # Expo Go for a first look; use a dev build for camera/Apple sign-in
npm test && npm run typecheck && npm run lint

# 3) Edge functions (local)
cd ../../supabase
echo 'ANTHROPIC_API_KEY=sk-ant-...' > functions/.env
supabase functions serve --env-file functions/.env
```

Regenerate DB types after schema changes:

```bash
supabase gen types typescript --local > ../apps/mobile/src/lib/database.types.ts
# or, without Docker:
python3 scripts/gen-types.py dram_check ../apps/mobile/src/lib/database.types.ts
```

## 2. Provisioning a Supabase project (staging, then production)

Create the project in the Supabase dashboard (region close to your users), then pick one of two paths.

### Option A — the Deploy Supabase workflow (recommended)

1. In the GitHub repo: Settings → Secrets and variables → Actions, add `SUPABASE_ACCESS_TOKEN` (personal access token, `sbp_…`), `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, and `ANTHROPIC_API_KEY`.
2. Actions → **Deploy Supabase** → Run workflow. It links the project, pushes every migration, seeds the flavor wheel and the catalog (once), sets the Anthropic key as a function secret, deploys both edge functions, creates the `notifications → send-push` webhook trigger, and applies the auth settings (deep-link redirect URLs, 6-digit email code template).
3. The run's summary shows the project URL and anon key to paste into `apps/mobile/.env`.
4. Still manual: Apple and Google providers (Authentication → Providers) and promoting yourself to moderator.

### Option B — by hand

1. Link and push the schema:
   ```bash
   cd supabase
   supabase link --project-ref <ref>
   supabase db push                       # applies migrations in order
   scripts/mgmt-sql.sh <ref> seed/00_flavor_tags.sql && scripts/mgmt-sql.sh <ref> seed/catalog.sql   # one-time seed
   ```
2. **Auth providers** (Dashboard → Authentication → Providers):
   - Email: enable; edit the *Magic Link* template to include `{{ .Token }}` so the 6-digit code flow works; set OTP length 6.
   - Apple: Services ID + key (Sign in with Apple), bundle id `app.dram.mobile`.
   - Google: OAuth client (iOS + Android + web client for the PKCE flow).
   - URL configuration: add `dram://auth/callback` and the `exp://…/--/auth/callback` dev URL to the redirect allow-list.
3. **Storage** buckets are created by migration `0700`. Confirm they exist and that `tasting-photos` / `label-scans` are private.
4. **Secrets & functions**:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy identify-label
   supabase functions deploy send-push --no-verify-jwt
   ```
5. **Database webhook** (Dashboard → Database → Webhooks): table `public.notifications`, event INSERT, type *Supabase Edge Function* → `send-push`, header `Authorization: Bearer <service_role key>` (or a custom value you also set as the `WEBHOOK_SECRET` function secret).
6. **Moderators**: `update public.profiles set is_moderator = true where username = 'you';`

Repeat for production with its own project; never point the app at both.

## 3. Building and shipping the app (EAS)

```bash
cd apps/mobile
eas login && eas init                    # writes the projectId into app.json (replace REPLACE_WITH_EAS_PROJECT_ID)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon>

# development client (needed for camera, Apple sign-in, push — Expo Go can't)
eas build --profile development --platform ios     # and android
# internal QA build against staging
eas build --profile preview --platform all
# store build
eas build --profile production --platform all
eas submit --profile production --platform ios     # TestFlight → App Store review
eas submit --profile production --platform android # Play internal track → production
```

Profiles are in `eas.json`. Use **EAS Update** for JS-only fixes between store releases:

```bash
eas update --channel production --message "fix: comparison flow back button"
```

Anything touching native modules (new Expo package, permission strings, icons) needs a new store build.

### Store metadata checklist

- Age rating: iOS 17+ (alcohol references), Play "Mature 17+".
- Privacy nutrition labels: identifiers (user id), contacts (email), user content (photos, notes), usage data (analytics if PostHog is on).
- Sign in with Apple is mandatory on iOS when offering Google sign-in — already wired.
- Account deletion is required by both stores — `Settings → Delete account` calls `delete_my_account()`.
- Privacy policy + terms URLs (placeholders `https://dram.app/privacy`, `/terms` in Settings).

## 4. CI/CD (GitHub Actions — `.github/workflows/ci.yml`)

| Job | Trigger | What it does |
|---|---|---|
| `mobile` | every push to `main` and every PR | `npm ci`, `tsc --noEmit`, `jest`, `expo lint` |
| `database` | every push to `main` and every PR | Spins up Postgres 16 service, runs `scripts/local-check.sh` (all migrations + seed + smoke tests) |
| `functions` | every push to `main` and every PR | `deno check` both edge functions |
| `deploy-supabase` (`.github/workflows/deploy-supabase.yml`) | `workflow_dispatch` | link, `db push`, one-time seed, function secrets + deploy, webhook trigger, auth config; prints URL + anon key |
| `eas-build` (manual / tag `mobile-v*`) | `workflow_dispatch` | `eas build --non-interactive` with `EXPO_TOKEN` |

Release flow: merge to `main` → CI green → run Deploy Supabase against staging → QA on a preview build → run it against prod → `eas build --profile production` → submit.

## 5. Migrations policy

- Never edit a migration that has been pushed to a shared environment; add a new file (`YYYYMMDDHHMMSS_description.sql`).
- Every migration must pass `scripts/local-check.sh` (CI enforces it). Add assertions to `tests/smoke.sql` for new behavior.
- Destructive changes (drop column/table) ship in two steps: stop writing → verify → drop.
- After any schema change, regenerate `database.types.ts` and commit it.

## 6. Backups and recovery

- Supabase Pro: daily backups (7-day retention) + PITR add-on for production.
- Storage buckets: enable versioning is not available; rely on the DB row referencing the object plus periodic `supabase storage` sync to S3 for production (weekly cron).
- Runbook: restore DB to a new project → `supabase link` → repoint the app via EAS Update of env (or a store build if URL changes).

## 7. Costs (order of magnitude, first 10k MAU)

| Item | Monthly |
|---|---|
| Supabase Pro | $25 (+ compute add-on if needed) |
| EAS | $0 (Free) → $99 (Production plan for priority builds) |
| Apple Developer / Google Play | $99/yr / $25 once |
| Claude label scans (≈ $0.015 each) | $15 per 1k scans |
| Sentry / PostHog | free tiers |
