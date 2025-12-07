import { Rarity } from "../types";

export interface LuckUpgrades {
  luckUpgrade1: number;
  luckUpgrade2: number;
  luckUpgrade3: number;
}

export function getLevelUpCoinReward(level: number): number {
  // Level 1->2: 2 coins, 2->3: 5 coins, 3->4: 10, 4->5: 15, 5->6: 20, etc.
  if (level === 1) return 2;
  if (level === 2) return 5;
  return (level - 1) * 5;
}

export function addXp(currentXp: number, currentLevel: number, amount: number): { xp: number; level: number; coinReward: number } {
  let newXp = currentXp + amount;
  let newLevel = currentLevel;
  let xpForNextLevel = newLevel * 100;
  let coinReward = 0;

  while (newXp >= xpForNextLevel) {
    newXp -= xpForNextLevel;
    coinReward += getLevelUpCoinReward(newLevel);
    newLevel++;
    xpForNextLevel = newLevel * 100;
  }

  return { xp: newXp, level: newLevel, coinReward };
}

export function getLuckUpgradeCost(basePrice: number, level: number): number {
  return Math.round(basePrice * Math.pow(1.07, level) * 100) / 100;
}

export function calculateRarityWeights(luckUpgrades: LuckUpgrades): Record<Rarity, number> {
  // Base weights: Common 67, Uncommon 20, Rare 10, Epic 2, Legendary 1
  // Upgrade 1: +0.5% Uncommon, -0.5% Common per level
  // Upgrade 2: +2% Rare, +2% Uncommon, -4% Common per level
  // Upgrade 3: +3% Epic, +1% Legendary, -4% Common per level

  const u1 = luckUpgrades.luckUpgrade1;
  const u2 = luckUpgrades.luckUpgrade2;
  const u3 = luckUpgrades.luckUpgrade3;

  return {
    [Rarity.Common]: Math.max(0, 67 - (u1 * 0.5) - (u2 * 4) - (u3 * 4)),
    [Rarity.Uncommon]: 20 + (u1 * 0.5) + (u2 * 2),
    [Rarity.Rare]: 10 + (u2 * 2),
    [Rarity.Epic]: 2 + (u3 * 3),
    [Rarity.Legendary]: 1 + (u3 * 1),
  };
}

export function getIdleUpgradeCost(level: number): number {
  const baseCost = 3;
  return Math.round(baseCost * Math.pow(1.05, level) * 100) / 100;
}
