/** 950 → "950", 12_400 → "12.4k", 2_300_000 → "2.3M". */
export function compactCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${trim(v / 1000)}k`;
  return `${trim(v / 1_000_000)}M`;
}

function trim(x: number): string {
  // One decimal under 100 ("12.4k"), none above ("240k"); never "12.0k".
  return (x < 100 ? x.toFixed(1) : x.toFixed(0)).replace(/\.0$/, '');
}
