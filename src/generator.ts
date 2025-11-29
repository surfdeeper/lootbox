import {
  LootItem,
  LootTableEntry,
  Rarity,
  RARITY_WEIGHTS,
  StatRange,
  StatRanges,
  ItemStats,
} from "./types";
import { ALL_LOOT_TABLES } from "./loot-tables";

const RARITY_STAT_MULTIPLIERS: Record<Rarity, number> = {
  [Rarity.Common]: 1.0,
  [Rarity.Uncommon]: 1.15,
  [Rarity.Rare]: 1.3,
  [Rarity.Epic]: 1.5,
  [Rarity.Legendary]: 1.8,
};

const ALL_RARITIES: Rarity[] = [
  Rarity.Common,
  Rarity.Uncommon,
  Rarity.Rare,
  Rarity.Epic,
  Rarity.Legendary,
];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

function selectGlobalRarity(customWeights?: Record<Rarity, number>): Rarity {
  const weights = ALL_RARITIES.map((r) => customWeights?.[r] ?? RARITY_WEIGHTS[r]);
  return weightedRandomSelect(ALL_RARITIES, weights);
}

function generateStats(statRanges: StatRanges, rarity: Rarity): ItemStats {
  const multiplier = RARITY_STAT_MULTIPLIERS[rarity];
  const stats: Record<string, number> = {};

  for (const [key, range] of Object.entries(statRanges)) {
    if (range) {
      const { min, max } = range as StatRange;
      const baseValue = randomInRange(min, max);
      stats[key] = Math.round(baseValue * multiplier * 10) / 10;
    }
  }

  return stats as ItemStats;
}

function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function applyRarityPrefix(name: string, rarity: Rarity): string {
  const prefixes: Record<Rarity, string[]> = {
    [Rarity.Common]: ["Standard", "Basic", "Worn"],
    [Rarity.Uncommon]: ["Refined", "Enhanced", "Improved"],
    [Rarity.Rare]: ["Superior", "Advanced", "Elite"],
    [Rarity.Epic]: ["Prototype", "Experimental", "Augmented"],
    [Rarity.Legendary]: ["Mythic", "Apex", "Singularity"],
  };

  const rarityPrefixes = prefixes[rarity];
  const prefix = rarityPrefixes[Math.floor(Math.random() * rarityPrefixes.length)];
  return `${prefix} ${name}`;
}

export function generateLoot(
  lootTable: LootTableEntry[] = ALL_LOOT_TABLES,
  customWeights?: Record<Rarity, number>
): LootItem {
  // First, roll for rarity globally (true 1% legendary chance)
  const rarity = selectGlobalRarity(customWeights);

  // Find items that support this rarity
  const eligibleItems = lootTable.filter((entry) =>
    entry.allowedRarities.includes(rarity)
  );

  // Pick a random eligible item
  const entry = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
  const stats = generateStats(entry.statRanges, rarity);

  return {
    id: generateUniqueId(),
    name: applyRarityPrefix(entry.baseItem.name, rarity),
    description: entry.baseItem.description,
    category: entry.baseItem.category,
    rarity,
    stats,
  };
}

export function generateLootBatch(
  count: number,
  lootTable: LootTableEntry[] = ALL_LOOT_TABLES
): LootItem[] {
  return Array.from({ length: count }, () => generateLoot(lootTable));
}

export function generateLootWithGuaranteedRarity(
  targetRarity: Rarity,
  lootTable: LootTableEntry[] = ALL_LOOT_TABLES
): LootItem | null {
  const eligibleEntries = lootTable.filter((entry) =>
    entry.allowedRarities.includes(targetRarity)
  );

  if (eligibleEntries.length === 0) {
    return null;
  }

  const entry = eligibleEntries[Math.floor(Math.random() * eligibleEntries.length)];
  const stats = generateStats(entry.statRanges, targetRarity);

  return {
    id: generateUniqueId(),
    name: applyRarityPrefix(entry.baseItem.name, targetRarity),
    description: entry.baseItem.description,
    category: entry.baseItem.category,
    rarity: targetRarity,
    stats,
  };
}
