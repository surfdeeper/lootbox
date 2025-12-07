// Format large numbers with K, M, B suffixes
export function formatNumber(num: number): string {
  if (num < 1000) {
    // For small numbers, show integers as-is, decimals with 1-2 decimal places
    if (Number.isInteger(num)) return num.toString();
    return num < 10 ? num.toFixed(2) : num.toFixed(1);
  }
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
  if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
  return (num / 1000000000000).toFixed(1) + 'T';
}

// Format coins - same as formatNumber but for display purposes
export function formatCoins(num: number): string {
  return formatNumber(num);
}

export function formatStatName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim();
}
