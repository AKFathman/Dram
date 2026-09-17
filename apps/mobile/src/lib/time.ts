/**
 * Tiny date helpers shared by the feed, notifications and tasting lists.
 * Intl is available on Hermes with the `intl` variant RN ships, and every
 * helper degrades to '' rather than throwing on a bad input.
 */

/** "just now" · "12m ago" · "2h ago" · "3d ago" · "5w ago" · "7mo ago" · "2y ago" */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 31) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** "12 Mar" for this year, "12 Mar 2023" otherwise; add the clock with `withTime`. */
export function formatDate(iso: string, opts: { withTime?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? null : { year: 'numeric' as const }),
  });
  if (!opts.withTime) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
