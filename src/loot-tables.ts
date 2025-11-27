import { ItemCategory, LootTableEntry, Rarity } from "./types";

export const WEAPON_LOOT_TABLE: LootTableEntry[] = [
  {
    baseItem: {
      id: "plasma-pistol",
      name: "Plasma Pistol",
      description: "Standard-issue sidearm firing superheated plasma rounds",
      category: ItemCategory.Pistol,
    },
    statRanges: {
      damage: { min: 15, max: 25 },
      fireRate: { min: 4, max: 6 },
      magazineSize: { min: 12, max: 18 },
      reloadTime: { min: 1.2, max: 1.8 },
      accuracy: { min: 70, max: 85 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon, Rarity.Rare],
  },
  {
    baseItem: {
      id: "pulse-rifle",
      name: "Pulse Rifle",
      description: "Automatic rifle with electromagnetic pulse rounds",
      category: ItemCategory.Rifle,
    },
    statRanges: {
      damage: { min: 20, max: 35 },
      fireRate: { min: 8, max: 12 },
      magazineSize: { min: 24, max: 36 },
      reloadTime: { min: 2.0, max: 2.8 },
      accuracy: { min: 60, max: 80 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic],
  },
  {
    baseItem: {
      id: "neutron-smg",
      name: "Neutron SMG",
      description: "Compact submachine gun with high rate of fire",
      category: ItemCategory.SMG,
    },
    statRanges: {
      damage: { min: 10, max: 18 },
      fireRate: { min: 14, max: 20 },
      magazineSize: { min: 30, max: 45 },
      reloadTime: { min: 1.5, max: 2.2 },
      accuracy: { min: 50, max: 70 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon, Rarity.Rare],
  },
  {
    baseItem: {
      id: "ion-shotgun",
      name: "Ion Shotgun",
      description: "Devastating close-range ion dispersal weapon",
      category: ItemCategory.Shotgun,
    },
    statRanges: {
      damage: { min: 80, max: 120 },
      fireRate: { min: 1, max: 2 },
      magazineSize: { min: 4, max: 8 },
      reloadTime: { min: 2.5, max: 3.5 },
      accuracy: { min: 40, max: 60 },
    },
    allowedRarities: [Rarity.Uncommon, Rarity.Rare, Rarity.Epic],
  },
  {
    baseItem: {
      id: "railgun",
      name: "Railgun",
      description: "Long-range electromagnetic accelerator cannon",
      category: ItemCategory.Sniper,
    },
    statRanges: {
      damage: { min: 150, max: 250 },
      fireRate: { min: 0.5, max: 1 },
      magazineSize: { min: 3, max: 6 },
      reloadTime: { min: 3.0, max: 4.0 },
      accuracy: { min: 90, max: 98 },
    },
    allowedRarities: [Rarity.Rare, Rarity.Epic, Rarity.Legendary],
  },
  {
    baseItem: {
      id: "quantum-disruptor",
      name: "Quantum Disruptor",
      description: "Experimental weapon that destabilizes matter at the quantum level",
      category: ItemCategory.Heavy,
    },
    statRanges: {
      damage: { min: 200, max: 350 },
      fireRate: { min: 0.3, max: 0.5 },
      magazineSize: { min: 1, max: 3 },
      reloadTime: { min: 4.0, max: 5.5 },
      accuracy: { min: 75, max: 90 },
    },
    allowedRarities: [Rarity.Epic, Rarity.Legendary],
  },
  {
    baseItem: {
      id: "void-cannon",
      name: "Void Cannon",
      description: "Fires concentrated dark energy projectiles",
      category: ItemCategory.Heavy,
    },
    statRanges: {
      damage: { min: 300, max: 500 },
      fireRate: { min: 0.2, max: 0.4 },
      magazineSize: { min: 1, max: 2 },
      reloadTime: { min: 5.0, max: 7.0 },
      accuracy: { min: 80, max: 95 },
    },
    allowedRarities: [Rarity.Legendary],
  },
];

export const ARMOR_LOOT_TABLE: LootTableEntry[] = [
  {
    baseItem: {
      id: "tactical-vest",
      name: "Tactical Vest",
      description: "Standard combat armor with basic protection",
      category: ItemCategory.Armor,
    },
    statRanges: {
      defense: { min: 10, max: 20 },
      mobility: { min: 90, max: 100 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon],
  },
  {
    baseItem: {
      id: "exo-suit",
      name: "Exo-Suit",
      description: "Powered exoskeleton with enhanced protection",
      category: ItemCategory.Armor,
    },
    statRanges: {
      defense: { min: 30, max: 50 },
      mobility: { min: 70, max: 85 },
    },
    allowedRarities: [Rarity.Uncommon, Rarity.Rare, Rarity.Epic],
  },
  {
    baseItem: {
      id: "nanoweave-armor",
      name: "Nanoweave Armor",
      description: "Advanced nanomaterial armor that adapts to threats",
      category: ItemCategory.Armor,
    },
    statRanges: {
      defense: { min: 60, max: 80 },
      mobility: { min: 80, max: 95 },
    },
    allowedRarities: [Rarity.Rare, Rarity.Epic, Rarity.Legendary],
  },
];

export const SHIELD_LOOT_TABLE: LootTableEntry[] = [
  {
    baseItem: {
      id: "basic-shield",
      name: "Basic Energy Shield",
      description: "Entry-level personal shield generator",
      category: ItemCategory.Shield,
    },
    statRanges: {
      capacity: { min: 50, max: 100 },
      rechargeRate: { min: 10, max: 20 },
      rechargeDelay: { min: 4, max: 6 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon],
  },
  {
    baseItem: {
      id: "hardlight-barrier",
      name: "Hardlight Barrier",
      description: "Solid light projection shield system",
      category: ItemCategory.Shield,
    },
    statRanges: {
      capacity: { min: 120, max: 180 },
      rechargeRate: { min: 25, max: 40 },
      rechargeDelay: { min: 3, max: 5 },
    },
    allowedRarities: [Rarity.Rare, Rarity.Epic],
  },
  {
    baseItem: {
      id: "singularity-shield",
      name: "Singularity Shield",
      description: "Creates a micro-black hole field that absorbs incoming fire",
      category: ItemCategory.Shield,
    },
    statRanges: {
      capacity: { min: 200, max: 300 },
      rechargeRate: { min: 50, max: 75 },
      rechargeDelay: { min: 2, max: 3 },
    },
    allowedRarities: [Rarity.Legendary],
  },
];

export const CONSUMABLE_LOOT_TABLE: LootTableEntry[] = [
  {
    baseItem: {
      id: "medkit",
      name: "Medkit",
      description: "Standard medical supplies for field treatment",
      category: ItemCategory.Consumable,
    },
    statRanges: {
      healing: { min: 25, max: 50 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon],
  },
  {
    baseItem: {
      id: "nano-injection",
      name: "Nano Injection",
      description: "Nanobots that rapidly repair tissue damage",
      category: ItemCategory.Consumable,
    },
    statRanges: {
      healing: { min: 75, max: 100 },
    },
    allowedRarities: [Rarity.Rare, Rarity.Epic],
  },
  {
    baseItem: {
      id: "shield-cell",
      name: "Shield Cell",
      description: "Emergency shield recharge pack",
      category: ItemCategory.Consumable,
    },
    statRanges: {
      shieldRestore: { min: 50, max: 100 },
    },
    allowedRarities: [Rarity.Common, Rarity.Uncommon, Rarity.Rare],
  },
];

export const ALL_LOOT_TABLES: LootTableEntry[] = [
  ...WEAPON_LOOT_TABLE,
  ...ARMOR_LOOT_TABLE,
  ...SHIELD_LOOT_TABLE,
  ...CONSUMABLE_LOOT_TABLE,
];
