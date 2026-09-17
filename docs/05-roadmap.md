# Dram — Roadmap and Milestones

## M0 — Foundation (this commit)

- [x] Requirements, data model, infrastructure, deployment docs
- [x] Postgres schema: catalog, rankings + derived scores, tastings, social, events, RLS, storage, V2 price hooks
- [x] Seed: flavor wheel (70 tags), 211-bottle catalog with aliases
- [x] SQL smoke tests covering ranking math, search, RLS, feed, events, moderation, GDPR
- [x] Edge functions: `identify-label` (Claude vision → catalog matches), `send-push`
- [x] Expo app: auth (Apple / Google / email OTP), onboarding + age gate, tabs, ranking engine + tests, all V1 screens
- [x] CI: typecheck, unit tests, schema check, edge-function check

## M1 — Runs on a device (1–2 weeks)

- [ ] Create staging Supabase project, configure auth providers, deploy functions
- [ ] EAS development build; walk every screen on iOS + Android; fix layout/edge cases
- [ ] Replace placeholder icons/splash with real brand assets
- [ ] Offline write queue for ratings/tastings at events (TanStack Query persister + mutation retry on reconnect)
- [ ] Sentry + PostHog
- [ ] Moderation: minimal admin page (Supabase Studio views are enough for a private beta)

## M2 — Private beta (2–4 weeks)

- [ ] 50 testers via TestFlight / Play internal; run one real tasting event end-to-end
- [ ] Feed polish: comments UI, @mentions, share sheet for a ranking
- [ ] Realtime leaderboard (Supabase Realtime channel per event) instead of 30 s polling
- [ ] Event QR code rendering + deep link `dram://event/join?code=…`
- [ ] Search tuning from real queries; grow catalog from tester submissions

## M3 — Public launch

- [ ] Store listings, screenshots, privacy labels, age ratings
- [ ] Rate limiting on `identify-label` (per-user quota table + edge check)
- [ ] Data warehouse export (activities, comparisons) for analytics
- [ ] Web read-only pages for shared rankings and public events (Next.js on Vercel reading the same Supabase project)

## V2 — Prices and shopping

- [ ] `price_observations` UI: "Paid $X at Y" on a tasting, price history chart on whiskey detail
- [ ] Retailer feeds / affiliate links (state-legal delivery partners), "where to buy nearby"
- [ ] Price alerts on wishlist items
- [ ] Barcode/UPC scan (`expo-camera` already supports it) → `whiskeys.upc`
- [ ] Blind-tasting mode for events (`events.is_blind`; pours hidden until reveal)
- [ ] Recommendations from the comparison graph
- [ ] Clubs (persistent groups with recurring events and shared lists)
