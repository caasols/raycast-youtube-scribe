/**
 * Count the number of words in a string.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Estimate reading time in minutes (assumes ~200 wpm).
 */
export function readingTimeLabel(words: number): string {
  const minutes = Math.ceil(words / 200);
  return `~${minutes} min read`;
}

/**
 * Format a number in compact form: 1000 → "1K", 1234567 → "1.2M".
 */
export function formatCompactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  const b = n / 1_000_000_000;
  return b >= 10 ? `${Math.round(b)}B` : `${b.toFixed(1).replace(/\.0$/, "")}B`;
}
