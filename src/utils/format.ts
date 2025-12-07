// Format large numbers with K, M, B suffixes
export function formatNumber(num: number): string {
  if (num < 1000) return num.toFixed(2);
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
  if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
  return (num / 1000000000000).toFixed(1) + 'T';
}

export function formatStatName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim();
}
