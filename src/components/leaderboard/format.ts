/** Shared leaderboard display helpers. */

export function formatRank(rank: number): string {
  return rank < 10 ? `0${rank}` : String(rank);
}

export function formatScore(score: number | string): string {
  const value = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
