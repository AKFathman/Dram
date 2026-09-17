# Dram — Product Requirements

> **Dram** (working name): the whiskey tracker that is as fast as a checklist and as deep as a tasting journal. Beli-style comparative ranking, social discovery, and a first-class mode for tastings and conferences.

## 1. Vision and positioning

Whiskey drinkers already keep lists: in Notes, in spreadsheets, on Untappd-style apps built for beer, or on Distiller/Whizzky which are rating-first and social-last. None of them make the *core loop* — "I just tried something, was it better than what I had last week?" — fast, and none are built for a room full of people tasting the same lineup.

Dram's bet is the same one Beli made for restaurants: **relative ranking beats absolute scoring.** Asking "was this better than Eagle Rare?" is easier and more consistent than asking "is this an 87 or an 89?" and it produces a personal top-list that is actually meaningful. On top of that fast loop we layer optional depth (notes, flavor tags, structured expert scoring) and a social graph so that discovery comes from people whose palates you trust.

### Product principles

1. **Fast path first.** Logging a whiskey with a rating takes under 15 seconds and no typing when the bottle is in the database.
2. **Progressive depth.** Tier → comparisons → notes → expert scoresheet. Every layer is optional and never blocks the previous one.
3. **Relative, not absolute.** Rankings are built from pairwise comparisons. Displayed scores are derived from rank position, never typed in.
4. **Built for the room.** Events pre-load the lineup so attendees tap, not type. It must work on bad venue Wi-Fi.
5. **The catalog is a commons.** Users can add missing whiskeys instantly; moderation merges duplicates later rather than gating entry.

## 2. Personas

| Persona | Goal | Depth | Key screens |
|---|---|---|---|
| **Casual Casey** | Remember what I've tried and what I liked most; find a good bottle at the store. | Tier + a couple of comparisons | Search, Rate, My List |
| **Enthusiast Eli** | Track proof/age/finish, favorites by region, share with friends. | Tiers + notes + flavor tags | Whiskey detail, Lists by region, Feed |
| **Expert Erin** | Structured scoresheet, nose/palate/finish, blind flights. | Full scoresheet, photos, batch details | Deep rating, Stats |
| **Organizer Olivia** | Run a tasting/conference so attendees find pours and the crowd favorite is visible. | Event lineup, dashboard | Event create/manage, Leaderboard |

## 3. Scope

### V1 (this build)

| ID | Feature | Summary |
|---|---|---|
| F1 | Accounts & profiles | Email magic link + Apple + Google sign-in. Username, display name, avatar, bio, home region, privacy (public / followers-only). Legal-drinking-age gate at sign-up. |
| F2 | Catalog & search | Searchable whiskey catalog (name, brand, distillery, region, type, age, proof). Typo-tolerant search. Filters by type, country/region, proof range, age. |
| F3 | Add a whiskey | If not found, user adds it in one form (name + type required, everything else optional, photo optional). Immediately usable by the submitter; enters a moderation queue for approval/merge. |
| F4 | Identify from a photo | Snap the label → server extracts brand, expression, age, proof → suggests catalog matches → falls back to pre-filled "Add" form. |
| F5 | Log & rank (fast mode) | Pick a tier (Loved / Liked / Fine / Not for me), then 2–5 "which was better?" comparisons place it in your ranked list. Score 0–10 is derived from rank. Re-rank any time. |
| F6 | Notes & expert mode | Optional: freeform note, nose/palate/finish, flavor tags (flavor wheel), serving (neat / rocks / water / cocktail), setting (home / bar / event), price paid, bottle details (batch, bottle #, store pick), photos. Optional 100-point structured scoresheet (appearance, nose, palate, finish, balance). |
| F7 | Lists & stats | My Ranking (overall), by type, by region/country, by distillery; Wishlist; My Bar (owned bottles). Stats: count tried, top regions, flavor profile, proof preference. |
| F8 | Social | Follow users; activity feed (rated, ranked-into-top-10, added a whiskey, joined an event); like entries; taste-match % with a friend; view a friend's rankings. |
| F9 | Discovery | Trending (community rating velocity), top rated overall and by region, "friends loved", similar whiskeys (same distillery / type / shared flavor tags). |
| F10 | Events & groups | Organizer creates an event with a pre-listed lineup (from catalog or ad-hoc), gets a join code + QR. Attendees join, see the lineup as a checklist, rate in fast mode, see progress ("7 of 24"), personal event favorites, and a live crowd leaderboard. Organizer dashboard + CSV export. |
| F11 | Notifications | Push (Expo): new follower, like on your entry, event starting, event lineup updated. |
| F12 | Privacy, safety, compliance | Private profiles, block/report, data export and account deletion, age gate, alcohol-content app-store ratings. |

### V2 (planned, schema leaves hooks)

- **Prices & shopping**: user-submitted price observations by store, retailer feeds, price history and alerts, "where to buy nearby", affiliate links.
- **Barcode/UPC scan** for retail bottles.
- **Blind-tasting mode** for events (labels hidden until reveal).
- **Clubs**: persistent groups with shared lists and recurring events.
- **Collection valuation** using price data.
- **Recommendations** trained on the comparison graph.
- **Web app** for organizers and desktop browsing.

### Out of scope

Marketplace / P2P selling, in-app purchase of alcohol, inventory management for retailers.

## 4. Core user flows

### 4.1 Log a whiskey (fast mode)

1. Tap **+** (or a whiskey's "Rate" button).
2. Search → pick a result. Not found → "Add it" (F3) or "Scan label" (F4).
3. Pick a tier: 😍 Loved · 🙂 Liked · 😐 Fine · 👎 Not for me.
4. Comparison loop: "Which did you prefer?" *[New whiskey]* vs *[an existing whiskey in the same tier]*. Binary search over the tier's ranked list; at most ⌈log₂(n)⌉ questions, typically 2–4. Skip button = "about the same" (insert adjacent).
5. Done screen shows new position ("#3 of 41 overall · #1 Bourbon") and offers "Add a note" (F6) — optional.

### 4.2 Deep note

From any entry: note text, flavor tags (multi-select from the wheel, grouped: Fruit, Floral, Sweet, Spice, Wood, Grain, Smoke/Peat, Other), nose/palate/finish, serving, setting, price paid, photos, structured scoresheet toggle.

### 4.3 Event attendee

1. Scan QR or enter 6-character code → join.
2. Lineup appears as a checklist grouped by table/flight, with "tried" state.
3. Tap a pour → fast rate (tier + comparisons scoped to *this event's* whiskeys first).
4. Event tab shows: my progress, my top 3 at this event, crowd leaderboard (live), and a "find this table" note per pour.

### 4.4 Event organizer

1. Create event: name, dates, venue, description, visibility (public / code-only), lineup.
2. Build lineup: search catalog, or paste a list ("Bulk add" parses one whiskey per line and matches/creates), assign table/flight labels.
3. Share join code + QR. Dashboard: attendees, pours tried, leaderboard, export CSV.

## 5. Functional requirements (acceptance criteria)

### F2 Search
- Query of ≥2 characters returns results within 300 ms p95 (server) for a 50k-bottle catalog.
- Tolerates typos and missing words ("blantons" → Blanton's Original Single Barrel; "lag 16" → Lagavulin 16).
- Results show name, distillery, type, age/proof, community score, and my own rank if I've had it.

### F3 Add whiskey
- Required: name, type. Optional: distillery, brand, country, region, age, ABV, cask/finish, description, photo.
- Duplicate guard: before saving, show top 3 fuzzy matches with "Did you mean?"
- New whiskey is `pending`; visible to the creator and anyone with the direct link; searchable to everyone after approval. Approved duplicates are merged and all entries re-pointed.

### F5 Ranking
- Tiers are ordered: Loved > Liked > Fine > Not for me. A whiskey's overall rank is its position across all tiers concatenated.
- Score = derived 0.0–10.0 from tier band + position within tier (see data model doc). Score is displayed with one decimal.
- Comparison questions never repeat a pair already answered for the same insertion.
- Re-rating a whiskey re-runs the comparison flow and moves it.
- Category rankings (by type, region) are computed views over the same list; no separate maintenance.

### F6 Notes
- Any field may be empty. Saving a note never changes rank.
- Structured scoresheet: 5 categories, integer 0–20 each, total 0–100, stored separately from derived score.

### F8 Social
- Public profile: rankings, stats, activity visible to all. Followers-only: visible to accepted followers.
- Feed shows followed users' activity, newest first, paginated.
- Taste match % = agreement rate over whiskeys both users have ranked (see data model doc).

### F10 Events
- Join code is 6 uppercase alphanumerics excluding ambiguous characters (0/O, 1/I).
- Lineup edits after start are allowed; attendees see a "lineup updated" badge.
- Leaderboard = average derived score across attendees with ≥1 rating, tie-broken by count; hidden until ≥3 ratings on a pour to avoid single-voter skew.
- Ratings at an event are ordinary ratings (they appear in the user's global list) tagged with `event_id`.
- Offline: attendee rating writes are queued locally and synced; lineup is cached on join.

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Platforms | iOS 16+ and Android 9+ from a single React Native (Expo) codebase. |
| Performance | Cold start < 2 s on mid-range devices; search-as-you-type debounced at 200 ms. |
| Offline | Read cache for my list and joined events; write queue for ratings and notes. |
| Privacy | Data export (JSON) and account deletion self-serve; GDPR/CCPA-ready. No sale of personal data. |
| Age gating | Date-of-birth check at sign-up against legal drinking age by country; store minimum age ratings (iOS 17+, Google Play "Mature 17+"). |
| Accessibility | Dynamic type, VoiceOver/TalkBack labels on all controls, contrast ≥ 4.5:1. |
| Security | Row-level security on every table; images in private buckets with signed URLs; no service keys in the client. |
| Observability | Crash reporting (Sentry), product analytics (PostHog), DB slow-query log. |
| Cost | Serverless stack that runs on free/low tiers to ~10k MAU. |

## 7. Screen map

```
Auth: Welcome → Sign in (Apple / Google / Email) → Age & profile setup
Tabs:
  Home (Feed)         — activity from followed users; empty state = suggested people + trending
  Search / Discover   — search bar, filters, trending, top by region, friends loved
  + (Log)             — search → rate flow (modal stack)
  Events              — my events, join by code, create
  Profile             — my ranking, stats, lists (by type / region), bar, wishlist, settings
Stacks:
  Whiskey detail      — facts, community score, my entry, friends' takes, similar
  Rate flow           — tier → comparisons → result → (optional) note
  Note editor         — notes, tags, scoresheet, photos
  Add whiskey         — form with duplicate guard
  Scan label          — camera → identification → matches
  Event detail        — lineup checklist, leaderboard, my favorites
  Event manage        — lineup editor, attendees, export
  User profile        — same as Profile, read-only, follow button, taste match
```

## 8. Success metrics (first 90 days after launch)

- Activation: ≥ 60% of new sign-ups log ≥ 3 whiskeys in week 1.
- Speed: median time from "+" tap to rank saved < 20 s.
- Depth: ≥ 25% of entries carry a note or ≥ 1 flavor tag.
- Social: ≥ 40% of active users follow ≥ 3 people.
- Events: ≥ 70% of event attendees rate ≥ half the lineup.
- Catalog quality: < 5% of new submissions merged as duplicates after month 2.

## 9. Open questions

- Catalog seeding: license a commercial dataset vs. crowd-build from a curated seed (~500 bottles). **Decision for V1: curated seed + crowd, moderation queue.**
- Display score scale: 0–10 (Beli) vs. 100-point (industry). **Decision: 0–10 derived score everywhere; optional 100-pt scoresheet for experts, never mixed.**
- Event ratings and global list: always merge (decided, see F10) vs. keep separate. Revisit if attendees complain about "event noise" in their global list; a per-entry "hide from global" toggle is cheap to add.
