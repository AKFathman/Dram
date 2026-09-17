/**
 * Date helpers for the event screens. Kept separate from `src/lib/time.ts`
 * (owned elsewhere) so the event flow has no cross-file dependency.
 */

const YEAR_NOW = () => new Date().getFullYear();

function day(d: Date, withYear: boolean) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : null),
  });
}

function clock(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Sat, Oct 4 · 7:00 PM – 10:00 PM", or spanning days when it runs past midnight. */
export function formatEventDate(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';
  const withYear = start.getFullYear() !== YEAR_NOW();
  const head = `${day(start, withYear)} · ${clock(start)}`;

  const end = endsAt ? new Date(endsAt) : null;
  if (!end || Number.isNaN(end.getTime())) return head;
  if (start.toDateString() === end.toDateString()) return `${head} – ${clock(end)}`;
  return `${head} – ${day(end, withYear || end.getFullYear() !== start.getFullYear())}, ${clock(end)}`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Parse the "YYYY-MM-DD HH:mm" text inputs on the create-event form, in local time. */
export function parseLocalDateTime(input: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ ,T]+(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [year, month, dayOfMonth, hour, minute] = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  ];
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31 || hour > 23 || minute > 59) return null;
  const d = new Date(year, month - 1, dayOfMonth, hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inverse of `parseLocalDateTime`. */
export function formatLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Default value for a new event: tonight at 19:00 local. */
export function tonightAt19(): string {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  return formatLocalDateTime(d);
}

/** The device's IANA time zone, e.g. "America/New_York". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

/** Live now or still to come: explicitly 'live', or it has not finished yet. */
export function isLiveOrUpcoming(e: { starts_at: string; ends_at: string | null; status: string }): boolean {
  if (e.status === 'live') return true;
  const end = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + TWELVE_HOURS;
  return Number.isNaN(end) ? true : end >= Date.now();
}
