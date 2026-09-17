/**
 * Beli-style comparative ranking.
 *
 * A user's list is four ordered tiers. Placing a new whiskey means picking a
 * tier, then answering "which did you prefer?" against whiskeys already in that
 * tier. We binary-search the tier, so a 40-item tier takes at most 6 questions.
 *
 * Everything here is pure and mirrors the SQL in
 * supabase/migrations/20260917000300_rankings_tastings.sql (tier_band,
 * recompute_tier_scores) so the client can preview scores before the server
 * confirms them.
 */

export type Tier = 'loved' | 'liked' | 'fine' | 'disliked';

/** Best → worst. */
export const TIER_ORDER: readonly Tier[] = ['loved', 'liked', 'fine', 'disliked'] as const;

export const TIER_META: Record<Tier, { label: string; short: string; emoji: string; band: readonly [number, number] }> = {
  loved: { label: 'Loved it', short: 'Loved', emoji: '😍', band: [8, 10] },
  liked: { label: 'Liked it', short: 'Liked', emoji: '🙂', band: [6, 8] },
  fine: { label: 'It was fine', short: 'Fine', emoji: '😐', band: [4, 6] },
  disliked: { label: 'Not for me', short: 'Not for me', emoji: '👎', band: [1, 4] },
};

/** Derived 0–10 score for the item at `position` (0 = best) in a tier of `n`. */
export function tierScore(tier: Tier, position: number, n: number): number {
  if (n <= 0) return 0;
  const [lo, hi] = TIER_META[tier].band;
  const raw = hi - ((hi - lo) * (position + 0.5)) / n;
  return Math.round(raw * 10) / 10;
}

/** Maximum comparison questions needed to place into a tier of `n` items. */
export function maxQuestions(n: number): number {
  return n <= 0 ? 0 : Math.ceil(Math.log2(n + 1));
}

export interface Comparison<T> {
  winner: T;
  loser: T;
}

export interface Session<T> {
  /** Existing tier members, best → worst, excluding the item being placed. */
  readonly candidates: readonly T[];
  /** Insertion index is somewhere in [lo, hi]. */
  readonly lo: number;
  readonly hi: number;
  readonly comparisons: readonly Comparison<T>[];
  readonly asked: number;
  readonly done: boolean;
  /** Final 0-based position within the tier once `done`. */
  readonly position: number | null;
}

export function startSession<T>(candidates: readonly T[]): Session<T> {
  const done = candidates.length === 0;
  return {
    candidates,
    lo: 0,
    hi: candidates.length,
    comparisons: [],
    asked: 0,
    done,
    position: done ? 0 : null,
  };
}

/** The candidate to compare against next, or null if the session is done. */
export function nextCandidate<T>(s: Session<T>): T | null {
  if (s.done) return null;
  return s.candidates[Math.floor((s.lo + s.hi) / 2)] ?? null;
}

export type Answer = 'new' | 'existing' | 'same';

/**
 * Record the user's answer for the current comparison.
 *  - 'new'      → the whiskey being placed beats the candidate
 *  - 'existing' → the candidate wins
 *  - 'same'     → "about the same": stop and slot in right below the candidate
 */
export function answer<T>(s: Session<T>, subject: T, a: Answer): Session<T> {
  if (s.done) return s;
  const mid = Math.floor((s.lo + s.hi) / 2);
  const candidate = s.candidates[mid];
  if (candidate === undefined) return { ...s, done: true, position: s.lo };

  if (a === 'same') {
    return { ...s, asked: s.asked + 1, done: true, position: mid + 1 };
  }

  const comparisons =
    a === 'new'
      ? [...s.comparisons, { winner: subject, loser: candidate }]
      : [...s.comparisons, { winner: candidate, loser: subject }];
  const lo = a === 'new' ? s.lo : mid + 1;
  const hi = a === 'new' ? mid : s.hi;
  const done = lo >= hi;
  return { ...s, lo, hi, comparisons, asked: s.asked + 1, done, position: done ? lo : null };
}

/** Insert `item` at `position` into an ordered array (non-mutating). */
export function insertAt<T>(list: readonly T[], item: T, position: number): T[] {
  const p = Math.max(0, Math.min(position, list.length));
  return [...list.slice(0, p), item, ...list.slice(p)];
}

export interface RankedItem {
  tier: Tier;
  position: number;
}

/**
 * Given every item in a user's list, return a map of derived scores and
 * overall ranks — identical to what v_rankings returns from the server.
 */
export function deriveList<T extends RankedItem>(
  items: readonly T[],
): (T & { score: number; overallRank: number })[] {
  const byTier = new Map<Tier, T[]>();
  for (const t of TIER_ORDER) byTier.set(t, []);
  for (const it of items) byTier.get(it.tier)!.push(it);

  const out: (T & { score: number; overallRank: number })[] = [];
  let rank = 1;
  for (const tier of TIER_ORDER) {
    const members = byTier.get(tier)!.sort((a, b) => a.position - b.position);
    for (const m of members) {
      out.push({ ...m, score: tierScore(tier, m.position, members.length), overallRank: rank++ });
    }
  }
  return out;
}

/** Format a derived score the way the UI shows it everywhere (one decimal). */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '–';
  return score.toFixed(1);
}
