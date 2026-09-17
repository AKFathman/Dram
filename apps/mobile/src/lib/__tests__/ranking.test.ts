import { describe, expect, it } from '@jest/globals';

import { answer, deriveList, insertAt, maxQuestions, nextCandidate, startSession, tierScore } from '../ranking';

describe('tierScore (mirrors SQL tier_band + recompute_tier_scores)', () => {
  it('puts a lone item mid-band', () => {
    expect(tierScore('loved', 0, 1)).toBe(9.0);
    expect(tierScore('liked', 0, 1)).toBe(7.0);
    expect(tierScore('fine', 0, 1)).toBe(5.0);
    expect(tierScore('disliked', 0, 1)).toBe(2.5);
  });
  it('spreads items evenly across the band', () => {
    expect(tierScore('loved', 0, 2)).toBe(9.5);
    expect(tierScore('loved', 1, 2)).toBe(8.5);
    expect(tierScore('liked', 0, 2)).toBe(7.5);
    expect(tierScore('liked', 1, 2)).toBe(6.5);
    expect(tierScore('loved', 0, 4)).toBe(9.8);
    expect(tierScore('loved', 3, 4)).toBe(8.3);
  });
  it('never leaves the band', () => {
    for (let n = 1; n < 50; n++) {
      expect(tierScore('loved', 0, n)).toBeLessThanOrEqual(10);
      expect(tierScore('loved', n - 1, n)).toBeGreaterThanOrEqual(8);
      expect(tierScore('disliked', n - 1, n)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('comparison session', () => {
  it('finishes immediately for an empty tier', () => {
    const s = startSession<string>([]);
    expect(s.done).toBe(true);
    expect(s.position).toBe(0);
    expect(nextCandidate(s)).toBeNull();
  });

  it('asks one question for a single candidate', () => {
    let s = startSession(['A']);
    expect(nextCandidate(s)).toBe('A');
    s = answer(s, 'NEW', 'new');
    expect(s.done).toBe(true);
    expect(s.position).toBe(0);
    expect(s.comparisons).toEqual([{ winner: 'NEW', loser: 'A' }]);

    let t = startSession(['A']);
    t = answer(t, 'NEW', 'existing');
    expect(t.done).toBe(true);
    expect(t.position).toBe(1);
  });

  it('binary-searches to the right slot', () => {
    // candidates ordered best → worst; the new item is "worth" 2.5 on this scale
    const list = [5, 4, 3, 2, 1];
    let s = startSession(list);
    let guard = 0;
    while (!s.done && guard++ < 10) {
      const c = nextCandidate(s)!;
      s = answer(s, 2.5, 2.5 > c ? 'new' : 'existing');
    }
    expect(s.position).toBe(3); // [5,4,3,(2.5),2,1]
    expect(s.asked).toBeLessThanOrEqual(maxQuestions(list.length));
    expect(insertAt(list, 2.5, s.position!)).toEqual([5, 4, 3, 2.5, 2, 1]);
  });

  it('places best-of-all and worst-of-all at the ends', () => {
    const list = [5, 4, 3, 2, 1];
    let hi = startSession(list);
    while (!hi.done) hi = answer(hi, 99, 'new');
    expect(hi.position).toBe(0);

    let lo = startSession(list);
    while (!lo.done) lo = answer(lo, 0, 'existing');
    expect(lo.position).toBe(5);
  });

  it('"about the same" slots right below the candidate and stops', () => {
    let s = startSession(['A', 'B', 'C', 'D']);
    const c = nextCandidate(s); // index 2 → 'C'
    expect(c).toBe('C');
    s = answer(s, 'NEW', 'same');
    expect(s.done).toBe(true);
    expect(s.position).toBe(3);
    expect(s.comparisons).toHaveLength(0);
  });

  it('never exceeds ceil(log2(n+1)) questions', () => {
    for (let n = 1; n <= 64; n++) {
      const list = Array.from({ length: n }, (_, i) => n - i);
      for (const target of [n + 1, 0.5, n / 2 + 0.25]) {
        let s = startSession(list);
        while (!s.done) {
          const c = nextCandidate(s)!;
          s = answer(s, target, target > c ? 'new' : 'existing');
        }
        expect(s.asked).toBeLessThanOrEqual(maxQuestions(n));
        const placed = insertAt(list, target, s.position!);
        for (let i = 1; i < placed.length; i++) expect(placed[i - 1]).toBeGreaterThan(placed[i]);
      }
    }
  });
});

describe('deriveList', () => {
  it('matches the server: overall rank runs loved → disliked', () => {
    const out = deriveList([
      { id: 'beam', tier: 'disliked', position: 0 },
      { id: 'redbreast', tier: 'liked', position: 1 },
      { id: 'blantons', tier: 'liked', position: 0 },
      { id: 'lag16', tier: 'loved', position: 0 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['lag16', 'blantons', 'redbreast', 'beam']);
    expect(out.map((x) => x.score)).toEqual([9.0, 7.5, 6.5, 2.5]);
    expect(out.map((x) => x.overallRank)).toEqual([1, 2, 3, 4]);
  });
});
