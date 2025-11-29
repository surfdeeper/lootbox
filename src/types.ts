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

export const SELL_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Uncommon]: 2,
  [Rarity.Rare]: 3,
  [Rarity.Epic]: 5,
  [Rarity.Legendary]: 10,
};

export const XP_REWARDS: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Uncommon]: 3,
  [Rarity.Rare]: 8,
  [Rarity.Epic]: 35,
  [Rarity.Legendary]: 125,
};

export const COIN_REWARDS: Record<Rarity, number> = {
  [Rarity.Common]: 0.1,
  [Rarity.Uncommon]: 0.3,
  [Rarity.Rare]: 1,
  [Rarity.Epic]: 2.5,
  [Rarity.Legendary]: 10,
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

// SVG paths for item category icons
export const CATEGORY_ICONS: Record<ItemCategory, string> = {
  [ItemCategory.Pistol]: "M2 12h6l2-3h8l2 3h2v4h-2l-2 3H10l-2-3H2v-4zm8 0v4m4-4v4",
  [ItemCategory.Rifle]: "M1 14h4l2-4h10l2 2h3v4h-3l-2 2H7l-2-4H1v-4zm6 0v4m8-4v4m-4-2v2",
  [ItemCategory.SMG]: "M3 13h5l1-3h6l1 3h4v4h-4l-1 2H9l-1-2H3v-4zm5 0v4m4-4v4",
  [ItemCategory.Shotgun]: "M1 14h5l2-4h8l2 4h4v4h-4l-2 2H8l-2-2H1v-4zm7 0v4m6-4v4",
  [ItemCategory.Sniper]: "M0 15h6l2-5h12l2 2v4l-2 2H8l-2-3H0v-4zm8 0v4m8-4v4m-4-6v2",
  [ItemCategory.Heavy]: "M2 12h4l2-4h8l2 4h4v6h-4l-2 2H8l-2-2H2v-6zm6 0v6m6-6v6m-3-8v2",
  [ItemCategory.Armor]: "M12 2l8 4v6c0 5-3 9-8 11-5-2-8-6-8-11V6l8-4z",
  [ItemCategory.Shield]: "M12 2l9 4v7c0 5-4 9-9 11-5-2-9-6-9-11V6l9-4zm0 4v12m-4-8h8",
  [ItemCategory.Consumable]: "M3 7h18v10H3V7zm9 2v6m-3-3h6",
  [ItemCategory.Mod]: "M12 2l2 4h4l-3 3 1 5-4-2-4 2 1-5-3-3h4l2-4z",
};

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

// Save System Types
export const SAVE_VERSION = 1;
export const SAVE_KEY = "lootbox_save";

export interface GameSave {
  version: number;
  lastSaved: number;

  player: {
    level: number;
    xp: number;
    coins: number;
  };

  inventory: LootItem[];

  upgrades: {
    coinGeneratorLevel: number;
    luckUpgrade1: number; // Uncommon +0.5%, Common -0.5%
    luckUpgrade2: number; // Rare +2%, Uncommon +2%, Common -4%
    luckUpgrade3: number; // Epic +3%, Legendary +1%, Common -4%
    hasAutoOpen?: boolean; // Auto-opens boxes every 5 seconds
    hasAutoSell?: boolean; // Unlocks auto-sell settings
    autoSellRarities?: string[]; // Rarities to auto-sell
    hasPets?: boolean; // Unlocks pets feature
    eggUpgrades?: {
      common: boolean;
      uncommon: boolean;
      rare: boolean;
      epic: boolean;
      legendary: boolean;
    };
  };

  rebirth: {
    tokens: number;
    count: number;
  };

  eggs?: { rarity: string; id: string }[];

  pets?: { id: string; name: string; type: string; rarity: string }[];

  stats: {
    totalChestsOpened: number;
    totalCoinsEarned: number;
    legendariesFound: number;
  };

  purchasedBoxes?: string[]; // Bronze, Silver, Gold box upgrades
}
