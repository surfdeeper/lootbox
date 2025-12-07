// Get prestige cost based on current prestige count
export function getPrestigeCost(prestigeCount: number): number {
  const costs = [8, 20, 50, 100];
  if (prestigeCount < costs.length) return costs[prestigeCount];
  // After first 4: 200, 400, 800, etc. (doubling)
  return 200 * Math.pow(2, prestigeCount - costs.length);
}
