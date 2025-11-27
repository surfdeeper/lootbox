export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.Common]: 67,
  [Rarity.Uncommon]: 20,
  [Rarity.Rare]: 10,
  [Rarity.Epic]: 2,
  [Rarity.Legendary]: 1,
};

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: "#9d9d9d",
  [Rarity.Uncommon]: "#1eff00",
  [Rarity.Rare]: "#0070dd",
  [Rarity.Epic]: "#a335ee",
  [Rarity.Legendary]: "#ff8000",
};

export const RARITY_EMOJIS: Record<Rarity, string> = {
  [Rarity.Common]: "⚪",
  [Rarity.Uncommon]: "🟢",
  [Rarity.Rare]: "🔵",
  [Rarity.Epic]: "🟣",
  [Rarity.Legendary]: "🟡",
};

export enum ItemCategory {
  Pistol = "pistol",
  Rifle = "rifle",
  SMG = "smg",
  Shotgun = "shotgun",
  Sniper = "sniper",
  Heavy = "heavy",
  Armor = "armor",
  Shield = "shield",
  Consumable = "consumable",
  Mod = "mod",
}

export interface WeaponStats {
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  accuracy: number;
}

export interface ArmorStats {
  defense: number;
  mobility: number;
}

export interface ShieldStats {
  capacity: number;
  rechargeRate: number;
  rechargeDelay: number;
}

export interface ConsumableStats {
  healing?: number;
  shieldRestore?: number;
  duration?: number;
}

export interface ModStats {
  damageBonus?: number;
  fireRateBonus?: number;
  magazineBonus?: number;
}

export type ItemStats =
  | WeaponStats
  | ArmorStats
  | ShieldStats
  | ConsumableStats
  | ModStats;

export interface LootItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: Rarity;
  stats: ItemStats;
}

export interface LootTableEntry {
  baseItem: Omit<LootItem, "rarity" | "stats">;
  statRanges: StatRanges;
  allowedRarities: Rarity[];
}

export interface StatRange {
  min: number;
  max: number;
}

export type StatRanges = {
  [K in keyof WeaponStats]?: StatRange;
} & {
  [K in keyof ArmorStats]?: StatRange;
} & {
  [K in keyof ShieldStats]?: StatRange;
} & {
  [K in keyof ConsumableStats]?: StatRange;
} & {
  [K in keyof ModStats]?: StatRange;
};
