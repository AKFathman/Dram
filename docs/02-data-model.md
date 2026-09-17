# Dram — Data Model

Source of truth: `supabase/migrations/*.sql`. This document explains the *why*; the SQL is the *what*. Types for the client are generated into `apps/mobile/src/lib/database.types.ts`.

## 1. Entity overview

```
                 ┌──────────────┐          ┌──────────────┐
                 │ auth.users   │ 1 ──── 1 │ profiles     │
                 └──────────────┘          └──────┬───────┘
                                                  │ 1
          ┌───────────────┬───────────────┬───────┴────────┬──────────────┬──────────────┐
          │ *             │ *             │ *              │ *            │ *            │
   ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐  ┌──────┴──────┐ ┌─────┴──────┐ ┌─────┴──────┐
   │ rankings    │ │ tastings    │ │ follows     │  │ wishlist    │ │ collection │ │ events     │
   │ (1/whiskey) │ │ (n/whiskey) │ │ blocks      │  │             │ │ _bottles   │ │ (creator)  │
   └──────┬──────┘ └──────┬──────┘ └─────────────┘  └──────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │ *             │ *  ┌──────────────┐            │ *            │ *            │ 1
          │               ├────┤ tasting_     │            │              │       ┌──────┴───────┐
          │               │    │ flavors/     │            │              │       │ event_members│
          │               │    │ photos/likes/│            │              │       │ event_pours  │
          │               │    │ comments     │            │              │       └──────┬───────┘
          │ 1             │ 1  └──────────────┘            │ 1            │ 1            │ *
   ┌──────┴───────────────┴────────────────────────────────┴──────────────┴──────────────┴──────┐
   │ whiskeys  ── distilleries · whiskey_aliases · price_observations (V2)                       │
   └───────────────────────────────────────────────────────────────────────────────────────────┘

   activities (feed, append-only) · notifications · push_tokens · reports · comparisons
```

## 2. Core concepts

### Ranking vs. tasting

Two different things people mean by "I rated it":

| | `rankings` | `tastings` |
|---|---|---|
| Cardinality | **one** per (user, whiskey) | **many** per (user, whiskey) |
| Meaning | Your current opinion: where it sits in your list | One logged pour: when, where, how, notes |
| Written by | `upsert_ranking()` RPC only | Direct inserts (RLS: own rows) |
| Carries | tier, position, derived score | note, nose/palate/finish, flavors, serving, setting, price, bottle details, scoresheet, photos, `event_id` |

Logging a whiskey in fast mode creates/updates a ranking. Adding notes creates a tasting. At an event, the app creates a bare tasting (`setting = 'event'`, `event_id` set) alongside the ranking so the leaderboard knows the pour was tried *there*.

### Tiers and derived scores

`rating_tier` is an ordered enum `disliked < fine < liked < loved`. Each ranking has a dense 0-based `position` inside its tier; the overall list is `order by tier desc, position`. Scores are **derived**, never typed:

```
band(loved)    = [8.0, 10.0]      band(fine)     = [4.0, 6.0]
band(liked)    = [6.0,  8.0]      band(disliked) = [1.0, 4.0]

score(tier, position, n) = round(hi − (hi − lo) · (position + 0.5) / n, 1)
```

So a lone Loved whiskey is 9.0; with two, they are 9.5 and 8.5; with four, 9.8 / 9.3 / 8.8 / 8.3. Scores shift as the list grows, which is exactly the Beli behavior: a score is a *position*, not a grade. `recompute_tier_scores(user, tier)` runs after every insert/move/delete. The client mirrors the formula in `src/lib/ranking.ts` so it can preview.

### Comparison flow (client) + `upsert_ranking` (server)

1. Client picks a tier, fetches its own tier members (already cached), and binary-searches with "which did you prefer?" — at most ⌈log₂(n+1)⌉ questions.
2. Client calls `upsert_ranking(whiskey, tier, position, event_id, comparisons)`. The function takes an advisory lock per user, removes any existing placement (closing the gap), shifts positions ≥ target, inserts, recomputes both affected tiers' scores, logs the pairwise `comparisons`, and posts a `rated` activity. It returns the `v_rankings` row (with `overall_rank`).
3. The `(user_id, tier, position)` uniqueness constraint is **deferrable** so the shift update can't trip it mid-statement.

Category/region rankings are not stored: the client derives them from the full list (a user's list is small; a 500-item list is ~40 KB).

### Community stats

`whiskeys.ratings_count / avg_score / *_count` are denormalized by a statement-level trigger on `rankings` using transition tables (one aggregate per statement, not per row). `avg_score` is the mean of members' derived scores — the same "community score" Beli shows.

### Catalog quality

- `whiskeys.status`: `pending` (user-added, immediately usable, shown after approved results with an "unverified" badge) → `approved` / `rejected` / `merged`.
- `merge_whiskeys(source, target)` (moderators) repoints rankings, tastings, wishlist, collection, lineups, and turns the duplicate's name into an alias. Users who had both keep the target's placement.
- `search_text` is a generated, unaccented, lower-cased concatenation of name/brand/distillery/region/subcategory with a trigram GIN index; `whiskey_aliases` covers nicknames ("OWA", "ECBP", "Oogie").
- `search_whiskeys(q, categories, country, region)` combines the `<%` word-similarity operator (index-backed), substring match, and alias match, ordered approved-first then similarity then popularity.

### Social visibility

`profiles.visibility` is `public` or `followers`. Identity (username, avatar, bio, counts) is always visible to signed-in users; **content** (rankings, tastings, lists) is gated by `can_view_profile(target)`: self, or public, or an accepted follow — and never across a block. Following a followers-only profile creates a `pending` follow the target must accept. Every content policy calls this one function, so the rule lives in one place.

The feed is a `security definer` function (`feed()`) because it needs to read followed users' rows; it re-implements the follow + block checks explicitly and shapes rows as JSON so the client does no joins.

### Events

- `events.join_code` — 6 chars from an unambiguous alphabet, assigned by trigger. `join_event(code)` is security definer because non-members can't read the row by RLS.
- `event_pours` is the lineup: catalog whiskey + optional label/flight/table + order. Any change bumps `events.lineup_version` so clients can show "lineup updated".
- `event_leaderboard(event)` counts a member's *current* ranking of a pour only if they logged a tasting of it at that event. Rows with < 3 ratings are returned but the UI hides the score. It re-checks membership inside the function.
- Ratings made at events are ordinary rankings — they live in the user's global list.

## 3. Table reference

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `profiles` | Public identity, 1:1 with `auth.users`, created by trigger | `username` citext unique `^[a-z0-9_]{3,24}$`, `visibility`, `age_verified_at`, `onboarded_at`, denormalized counts |
| `distilleries` | Producers | unique on normalized name + country |
| `whiskeys` | The catalog | `category` enum, `country` alpha-2, `age_years` null = NAS, `abv`, `status`, `merged_into`, `search_text` (generated), stats |
| `whiskey_aliases` | Nicknames for search | generated `normalized` + trigram index |
| `flavor_tags` | Flavor wheel (seeded, 70 tags in 8 groups) | `slug` PK, `group_slug` |
| `events` | Tastings, conferences | `join_code`, `visibility`, `status`, `lineup_version`, `is_blind` (V2) |
| `event_members` | Who's in, with role | organizer / host / attendee |
| `event_pours` | The lineup | unique (event, whiskey); `flight`, `table_location`, `sort_order` |
| `rankings` | One placement per (user, whiskey) | `tier`, `position`, derived `score`; deferrable unique (user, tier, position) |
| `comparisons` | Pairwise answers | for taste-match and V2 recommendations |
| `tastings` | Logged pours + notes + expert scoresheet | `score_total` generated (sum of five 0–20 fields), `event_id`, price/bottle fields |
| `tasting_flavors` / `tasting_photos` | Tags with optional intensity; photo object keys | |
| `wishlist` / `collection_bottles` | Want-to-try; "My bar" with fill level | |
| `follows` / `blocks` | Social graph | follow status pending/accepted set by trigger |
| `activities` | Append-only feed | `kind` enum + nullable refs + `payload` |
| `tasting_likes` / `tasting_comments` | Engagement | counters denormalized on `tastings` |
| `notifications` / `push_tokens` | In-app + push | `read_at`; tokens keyed by device token |
| `reports` | Moderation queue | target_type + reason enums via checks |
| `price_observations` (V2) | Crowd/retailer prices | `v_latest_prices` view |

## 4. RPC / view reference

| Name | Kind | Security | Purpose |
|---|---|---|---|
| `v_rankings` | view | invoker | rankings + `overall_rank` + `total` per user |
| `upsert_ranking(whiskey, tier, position, event, comparisons)` | fn | invoker | place/move a whiskey; returns v_rankings row |
| `remove_ranking(whiskey)` | fn | invoker | delete + close gap + rescore |
| `search_whiskeys(q, categories, country, region, limit, offset)` | fn | invoker | typo-tolerant catalog search |
| `match_whiskey_lines(lines[])` | fn | invoker | best match per free-text line (bulk lineup paste, label OCR) |
| `trending_whiskeys(days, limit)` / `top_whiskeys(...)` / `similar_whiskeys(id)` | fn | invoker | discovery |
| `friends_loved(limit)` | fn | definer | whiskeys followed users put in Loved |
| `whiskey_flavor_profile(id)` | fn | definer (aggregate only) | top flavor tags across all tastings |
| `whiskey_friend_rankings(id)` | fn | invoker | followed users' placements of a whiskey |
| `feed(limit, before_id, actor)` | fn | definer | home feed or one user's activity, JSON-shaped |
| `taste_match(other)` | fn | definer | pairwise agreement % over common whiskeys |
| `join_event(code)` | fn | definer | join by code |
| `event_leaderboard(event)` | fn | definer (member check) | crowd scores per pour |
| `merge_whiskeys(source, target)` | fn | definer (moderator) | de-duplicate catalog |
| `export_my_data()` / `delete_my_account()` | fn | invoker / definer | GDPR self-serve |
| `can_view_profile`, `is_event_member`, `is_event_host`, `can_view_event`, `can_view_tasting`, `is_moderator` | fn | definer | policy helpers |

## 5. Storage buckets

| Bucket | Public | Path convention | Who writes |
|---|---|---|---|
| `avatars` | yes | `<uid>/<file>` | owner |
| `whiskey-images` | yes | `<uid>/<file>` | any member (moderated with the whiskey) |
| `event-covers` | yes | `<uid>/<file>` | organizer |
| `tasting-photos` | no (signed URLs) | `<uid>/<file>` | owner; readable per `can_view_profile` |
| `label-scans` | no | `<uid>/<file>` | owner only; short-lived |

## 6. Catalog data sourcing

There is no free, licensed, comprehensive whiskey database. The plan:

1. **Seed** (`supabase/seed/catalog.sql`): 211 iconic/widely available bottlings across 59 distilleries, with aliases. Hand-curated; accuracy over coverage.
2. **Crowd-build**: any user can add a bottle in seconds; it's usable immediately and shows as unverified. Moderators approve/merge from a queue (Studio or a future admin page). Search returns pending rows so people find each other's additions instead of re-adding.
3. **Enrich later**: retailer feeds (V2 pricing) bring UPCs and images; label photos uploaded during scans can become catalog images after review.

## 7. Analytics-friendly properties

- `comparisons` is a growing pairwise-preference graph — the raw material for a V2 recommender (Bradley–Terry / Elo over users' comparisons, or collaborative filtering on derived scores).
- `activities` and `notifications` are append-only with `created_at` indexes, safe to stream to a warehouse.
- All aggregates (`whiskeys.*_count`, `profiles.*_count`, `tastings.likes_count`) are recomputable from base tables if they ever drift: `select public.refresh_whiskey_stats(array_agg(id)) from whiskeys`.
