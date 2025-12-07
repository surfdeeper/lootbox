/**
 * Bot Testing System for Lootbox Game
 *
 * This system simulates bot gameplay to find bugs and glitches.
 * Bots perform random actions and validate game state after each action.
 */

import { generateLoot, generateLootWithGuaranteedRarity } from "./generator";
import {
  LootItem,
  Rarity,
  RARITY_WEIGHTS,
  SELL_PRICES,
  XP_REWARDS,
  COIN_REWARDS,
  ItemCategory,
  GameSave,
} from "./types";

// ============================================
// Game State Simulation
// ============================================

interface BotGameState {
  level: number;
  xp: number;
  coins: number;
  inventory: LootItem[];
  coinGeneratorLevel: number;
  luckUpgrades: {
    luckUpgrade1: number;
    luckUpgrade2: number;
    luckUpgrade3: number;
  };
  stats: {
    totalChestsOpened: number;
    totalCoinsEarned: number;
    legendariesFound: number;
  };
  purchasedBoxes: string[];
  hasAutoOpen: boolean;
  hasAutoSell: boolean;
  autoSellRarities: Set<Rarity>;
  hasPets: boolean;
  rebirthTokens: number;
  rebirthCount: number;
  prestigeCount: number;
  eggUpgrades: {
    common: boolean;
    uncommon: boolean;
    rare: boolean;
    epic: boolean;
    legendary: boolean;
  };
  eggs: { rarity: Rarity; id: string }[];
  pets: { id: string; name: string; type: "dog" | "cat"; rarity: Rarity; bonus: number }[];
  equippedPets: string[];
  dropsHistory: LootItem[];
  battleWave: number;
  battleSlots: (string | null)[];
  battleStreak: number;
  // Galaxy state (Area 2)
  currentArea: number;
  galaxyCoins: number;
  galaxyXp: number;
  galaxyLevel: number;
  galaxyInventory: LootItem[];
  galaxyCoinGeneratorLevel: number;
  galaxyLuckUpgrades: {
    luckUpgrade1: number;
    luckUpgrade2: number;
    luckUpgrade3: number;
  };
  galaxyPurchasedBoxes: string[];
  galaxyHasAutoOpen: boolean;
  galaxyHasAutoSell: boolean;
  galaxyAutoSellRarities: Set<Rarity>;
  galaxyEggUpgrades: {
    common: boolean;
    uncommon: boolean;
    rare: boolean;
    epic: boolean;
    legendary: boolean;
  };
  galaxyEggs: { rarity: Rarity; id: string }[];
  galaxyPets: { id: string; name: string; type: "dog" | "cat"; rarity: Rarity; bonus: number }[];
  galaxyEquippedPets: string[];
  galaxyDropsHistory: LootItem[];
  galaxyBattleWave: number;
  galaxyBattleSlots: (string | null)[];
  galaxyRebirthTokens: number;
  galaxyRebirthCount: number;
  galaxyPrestigeCount: number;
}

interface BugReport {
  type: "error" | "warning" | "anomaly";
  category: string;
  message: string;
  state?: Partial<BotGameState>;
  action?: string;
  timestamp: number;
}

interface TestResult {
  totalActions: number;
  bugs: BugReport[];
  actionCounts: Record<string, number>;
  finalState: BotGameState;
  duration: number;
}

// ============================================
// Utility Functions (mirror game logic)
// ============================================

function addXp(
  currentXp: number,
  currentLevel: number,
  amount: number
): { xp: number; level: number; coinReward: number } {
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

function getLevelUpCoinReward(level: number): number {
  if (level === 1) return 2;
  if (level === 2) return 5;
  return (level - 1) * 5;
}

function getIdleUpgradeCost(level: number): number {
  const baseCost = 3;
  return Math.round(baseCost * Math.pow(1.05, level) * 100) / 100;
}

function getLuckUpgradeCost(basePrice: number, level: number): number {
  return Math.round(basePrice * Math.pow(1.07, level) * 100) / 100;
}

function calculateRarityWeights(luckUpgrades: {
  luckUpgrade1: number;
  luckUpgrade2: number;
  luckUpgrade3: number;
}): Record<Rarity, number> {
  const u1 = luckUpgrades.luckUpgrade1;
  const u2 = luckUpgrades.luckUpgrade2;
  const u3 = luckUpgrades.luckUpgrade3;

  return {
    [Rarity.Common]: Math.max(0, 67 - u1 * 0.5 - u2 * 4 - u3 * 4),
    [Rarity.Uncommon]: 20 + u1 * 0.5 + u2 * 2,
    [Rarity.Rare]: 10 + u2 * 2,
    [Rarity.Epic]: 2 + u3 * 3,
    [Rarity.Legendary]: 1 + u3 * 1,
  };
}

function getWeaponPower(item: LootItem): number {
  const rarityMultiplier: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Uncommon]: 1.5,
    [Rarity.Rare]: 2.5,
    [Rarity.Epic]: 4,
    [Rarity.Legendary]: 7,
  };

  if (item.category === ItemCategory.Shield) {
    const shieldStats = item.stats as {
      capacity?: number;
      rechargeRate?: number;
    };
    let shieldPower = 0;
    if (shieldStats.capacity) shieldPower += shieldStats.capacity * 3;
    if (shieldStats.rechargeRate) shieldPower += shieldStats.rechargeRate * 2;
    return -(shieldPower * rarityMultiplier[item.rarity]);
  }

  if (item.category === ItemCategory.Armor) {
    const armorStats = item.stats as { defense?: number; mobility?: number };
    let armorPower = 0;
    if (armorStats.defense) armorPower += armorStats.defense * 4;
    if (armorStats.mobility) armorPower += armorStats.mobility * 1;
    return armorPower * rarityMultiplier[item.rarity];
  }

  const stats = item.stats as {
    damage?: number;
    fireRate?: number;
    accuracy?: number;
    magazineSize?: number;
  };
  let power = 0;
  if (stats.damage) power += stats.damage * 2;
  if (stats.fireRate) power += stats.fireRate;
  if (stats.accuracy) power += stats.accuracy * 0.5;
  if (stats.magazineSize) power += stats.magazineSize * 0.3;

  return power * rarityMultiplier[item.rarity];
}

function generateEnemyPower(wave: number, slotIndex: number): number {
  // Wave 1 is easier to help new players learn the system
  if (wave === 1) {
    const basePower = 25; // Much lower base for first battle
    const variance = (Math.random() - 0.5) * (basePower * 0.4); // Less variance
    const slotBonus = slotIndex * 3; // Smaller slot bonus
    return Math.max(15, Math.round(basePower + variance + slotBonus));
  }

  const basePower = 50 + (wave - 1) * 20;
  const variance = (Math.random() - 0.5) * (basePower * 0.6);
  const slotBonus = slotIndex * 8;
  return Math.max(30, Math.round(basePower + variance + slotBonus));
}

function getRebirthCost(rebirthCount: number): number {
  return Math.floor(200 * Math.pow(1.25, rebirthCount));
}

// ============================================
// State Validation
// ============================================

function validateState(state: BotGameState, action: string): BugReport[] {
  const bugs: BugReport[] = [];
  const timestamp = Date.now();

  // Check for NaN values
  if (Number.isNaN(state.coins)) {
    bugs.push({
      type: "error",
      category: "NaN",
      message: "Coins became NaN",
      action,
      timestamp,
    });
  }
  if (Number.isNaN(state.xp)) {
    bugs.push({
      type: "error",
      category: "NaN",
      message: "XP became NaN",
      action,
      timestamp,
    });
  }
  if (Number.isNaN(state.level)) {
    bugs.push({
      type: "error",
      category: "NaN",
      message: "Level became NaN",
      action,
      timestamp,
    });
  }

  // Check for negative values where they shouldn't be
  if (state.coins < 0) {
    bugs.push({
      type: "error",
      category: "NegativeValue",
      message: `Coins became negative: ${state.coins}`,
      action,
      timestamp,
    });
  }
  if (state.xp < 0) {
    bugs.push({
      type: "error",
      category: "NegativeValue",
      message: `XP became negative: ${state.xp}`,
      action,
      timestamp,
    });
  }
  if (state.level < 1) {
    bugs.push({
      type: "error",
      category: "NegativeValue",
      message: `Level became less than 1: ${state.level}`,
      action,
      timestamp,
    });
  }
  if (state.rebirthTokens < 0) {
    bugs.push({
      type: "error",
      category: "NegativeValue",
      message: `Rebirth tokens became negative: ${state.rebirthTokens}`,
      action,
      timestamp,
    });
  }
  if (state.battleWave < 1) {
    bugs.push({
      type: "error",
      category: "NegativeValue",
      message: `Battle wave became less than 1: ${state.battleWave}`,
      action,
      timestamp,
    });
  }

  // Check for Infinity values
  if (!Number.isFinite(state.coins)) {
    bugs.push({
      type: "error",
      category: "Infinity",
      message: `Coins became Infinity`,
      action,
      timestamp,
    });
  }

  // Check stat consistency
  if (state.stats.totalChestsOpened < 0) {
    bugs.push({
      type: "error",
      category: "StatInconsistency",
      message: `Total chests opened is negative: ${state.stats.totalChestsOpened}`,
      action,
      timestamp,
    });
  }
  if (state.stats.legendariesFound < 0) {
    bugs.push({
      type: "error",
      category: "StatInconsistency",
      message: `Legendaries found is negative: ${state.stats.legendariesFound}`,
      action,
      timestamp,
    });
  }

  // Check inventory integrity
  for (const item of state.inventory) {
    if (!item.id) {
      bugs.push({
        type: "error",
        category: "InventoryIntegrity",
        message: `Item missing ID`,
        action,
        timestamp,
      });
    }
    if (!item.rarity || !Object.values(Rarity).includes(item.rarity)) {
      bugs.push({
        type: "error",
        category: "InventoryIntegrity",
        message: `Item has invalid rarity: ${item.rarity}`,
        action,
        timestamp,
      });
    }
    if (!item.category || !Object.values(ItemCategory).includes(item.category)) {
      bugs.push({
        type: "error",
        category: "InventoryIntegrity",
        message: `Item has invalid category: ${item.category}`,
        action,
        timestamp,
      });
    }
    // Check for NaN in item stats
    for (const [key, value] of Object.entries(item.stats)) {
      if (typeof value === "number" && Number.isNaN(value)) {
        bugs.push({
          type: "error",
          category: "ItemStatNaN",
          message: `Item ${item.name} has NaN ${key}`,
          action,
          timestamp,
        });
      }
    }
  }

  // Check battle slots reference valid inventory items
  for (let i = 0; i < state.battleSlots.length; i++) {
    const slotId = state.battleSlots[i];
    if (slotId && !state.inventory.find((item) => item.id === slotId)) {
      bugs.push({
        type: "warning",
        category: "OrphanedBattleSlot",
        message: `Battle slot ${i} references non-existent item: ${slotId}`,
        action,
        timestamp,
      });
    }
  }

  // Check for duplicate item IDs
  const itemIds = state.inventory.map((i) => i.id);
  const duplicateIds = itemIds.filter(
    (id, index) => itemIds.indexOf(id) !== index
  );
  if (duplicateIds.length > 0) {
    bugs.push({
      type: "error",
      category: "DuplicateItemId",
      message: `Duplicate item IDs found: ${duplicateIds.join(", ")}`,
      action,
      timestamp,
    });
  }

  // Check egg integrity
  for (const egg of state.eggs) {
    if (!egg.id) {
      bugs.push({
        type: "error",
        category: "EggIntegrity",
        message: `Egg missing ID`,
        action,
        timestamp,
      });
    }
    if (!Object.values(Rarity).includes(egg.rarity)) {
      bugs.push({
        type: "error",
        category: "EggIntegrity",
        message: `Egg has invalid rarity: ${egg.rarity}`,
        action,
        timestamp,
      });
    }
  }

  // Check luck upgrades are within bounds
  const MAX_LUCK_LEVEL = 4;
  if (state.luckUpgrades.luckUpgrade1 > MAX_LUCK_LEVEL) {
    bugs.push({
      type: "error",
      category: "UpgradeOverflow",
      message: `Luck upgrade 1 exceeded max: ${state.luckUpgrades.luckUpgrade1}`,
      action,
      timestamp,
    });
  }
  if (state.luckUpgrades.luckUpgrade2 > MAX_LUCK_LEVEL) {
    bugs.push({
      type: "error",
      category: "UpgradeOverflow",
      message: `Luck upgrade 2 exceeded max: ${state.luckUpgrades.luckUpgrade2}`,
      action,
      timestamp,
    });
  }
  if (state.luckUpgrades.luckUpgrade3 > MAX_LUCK_LEVEL) {
    bugs.push({
      type: "error",
      category: "UpgradeOverflow",
      message: `Luck upgrade 3 exceeded max: ${state.luckUpgrades.luckUpgrade3}`,
      action,
      timestamp,
    });
  }

  // Check rarity weights sum to reasonable amount
  const weights = calculateRarityWeights(state.luckUpgrades);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    bugs.push({
      type: "error",
      category: "RarityWeights",
      message: `Total rarity weight is zero or negative: ${totalWeight}`,
      action,
      timestamp,
    });
  }

  // Anomaly detection - unusual but not necessarily bugs
  if (state.inventory.length > 10000) {
    bugs.push({
      type: "anomaly",
      category: "LargeInventory",
      message: `Inventory has ${state.inventory.length} items - potential memory issue`,
      action,
      timestamp,
    });
  }
  if (state.dropsHistory.length > 50000) {
    bugs.push({
      type: "anomaly",
      category: "LargeHistory",
      message: `Drops history has ${state.dropsHistory.length} items - potential memory issue`,
      action,
      timestamp,
    });
  }

  return bugs;
}

// ============================================
// Bot Actions
// ============================================

function createInitialState(): BotGameState {
  return {
    level: 1,
    xp: 0,
    coins: 0,
    inventory: [],
    coinGeneratorLevel: 0,
    luckUpgrades: {
      luckUpgrade1: 0,
      luckUpgrade2: 0,
      luckUpgrade3: 0,
    },
    stats: {
      totalChestsOpened: 0,
      totalCoinsEarned: 0,
      legendariesFound: 0,
    },
    purchasedBoxes: [],
    hasAutoOpen: false,
    hasAutoSell: false,
    autoSellRarities: new Set(),
    hasPets: false,
    rebirthTokens: 0,
    rebirthCount: 0,
    prestigeCount: 0,
    eggUpgrades: {
      common: false,
      uncommon: false,
      rare: false,
      epic: false,
      legendary: false,
    },
    eggs: [],
    pets: [],
    equippedPets: [],
    dropsHistory: [],
    battleWave: 1,
    battleSlots: [null, null, null, null, null],
    battleStreak: 0,
    // Galaxy state
    currentArea: 1,
    galaxyCoins: 0,
    galaxyXp: 0,
    galaxyLevel: 1,
    galaxyInventory: [],
    galaxyCoinGeneratorLevel: 0,
    galaxyLuckUpgrades: {
      luckUpgrade1: 0,
      luckUpgrade2: 0,
      luckUpgrade3: 0,
    },
    galaxyPurchasedBoxes: [],
    galaxyHasAutoOpen: false,
    galaxyHasAutoSell: false,
    galaxyAutoSellRarities: new Set(),
    galaxyEggUpgrades: {
      common: false,
      uncommon: false,
      rare: false,
      epic: false,
      legendary: false,
    },
    galaxyEggs: [],
    galaxyPets: [],
    galaxyEquippedPets: [],
    galaxyDropsHistory: [],
    galaxyBattleWave: 1,
    galaxyBattleSlots: [null, null, null, null, null],
    galaxyRebirthTokens: 0,
    galaxyRebirthCount: 0,
    galaxyPrestigeCount: 0,
  };
}

function generatePetBonus(type: "dog" | "cat", rarity: Rarity): number {
  const baseBonus: Record<Rarity, number> = {
    [Rarity.Common]: type === "dog" ? 1 : 0.5,
    [Rarity.Uncommon]: type === "dog" ? 3 : 1.5,
    [Rarity.Rare]: type === "dog" ? 8 : 4,
    [Rarity.Epic]: type === "dog" ? 20 : 10,
    [Rarity.Legendary]: type === "dog" ? 50 : 25,
  };
  return baseBonus[rarity];
}

function getBoxRarityWeights(state: BotGameState): Record<Rarity, number> {
  const baseWeights = calculateRarityWeights(state.luckUpgrades);

  if (state.purchasedBoxes.includes("gold")) {
    return {
      ...baseWeights,
      [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 20),
      [Rarity.Epic]: baseWeights[Rarity.Epic] + 15,
      [Rarity.Legendary]: baseWeights[Rarity.Legendary] + 5,
    };
  } else if (state.purchasedBoxes.includes("silver")) {
    return {
      ...baseWeights,
      [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 15),
      [Rarity.Uncommon]: baseWeights[Rarity.Uncommon] + 5,
      [Rarity.Rare]: baseWeights[Rarity.Rare] + 10,
    };
  } else if (state.purchasedBoxes.includes("bronze")) {
    return {
      ...baseWeights,
      [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 8),
      [Rarity.Uncommon]: baseWeights[Rarity.Uncommon] + 8,
    };
  }

  return baseWeights;
}

type BotAction = (state: BotGameState) => { state: BotGameState; actionName: string };

const botActions: BotAction[] = [
  // Open chest (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const luckUpgrades = isGalaxy ? state.galaxyLuckUpgrades : state.luckUpgrades;
    const purchasedBoxes = isGalaxy ? state.galaxyPurchasedBoxes : state.purchasedBoxes;
    const hasAutoSell = isGalaxy ? state.galaxyHasAutoSell : state.hasAutoSell;
    const autoSellRarities = isGalaxy ? state.galaxyAutoSellRarities : state.autoSellRarities;
    const eggUpgrades = isGalaxy ? state.galaxyEggUpgrades : state.eggUpgrades;
    const rebirthCount = isGalaxy ? state.galaxyRebirthCount : state.rebirthCount;
    const prestigeCount = isGalaxy ? state.galaxyPrestigeCount : state.prestigeCount;
    const currentXp = isGalaxy ? state.galaxyXp : state.xp;
    const currentLevel = isGalaxy ? state.galaxyLevel : state.level;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;

    // Calculate weights based on current area's luck upgrades
    const baseWeights = calculateRarityWeights(luckUpgrades);
    let customWeights = { ...baseWeights };
    if (purchasedBoxes.includes("gold")) {
      customWeights = {
        ...customWeights,
        [Rarity.Common]: Math.max(0, customWeights[Rarity.Common] - 20),
        [Rarity.Epic]: customWeights[Rarity.Epic] + 15,
        [Rarity.Legendary]: customWeights[Rarity.Legendary] + 5,
      };
    } else if (purchasedBoxes.includes("silver")) {
      customWeights = {
        ...customWeights,
        [Rarity.Common]: Math.max(0, customWeights[Rarity.Common] - 15),
        [Rarity.Uncommon]: customWeights[Rarity.Uncommon] + 5,
        [Rarity.Rare]: customWeights[Rarity.Rare] + 10,
      };
    } else if (purchasedBoxes.includes("bronze")) {
      customWeights = {
        ...customWeights,
        [Rarity.Common]: Math.max(0, customWeights[Rarity.Common] - 8),
        [Rarity.Uncommon]: customWeights[Rarity.Uncommon] + 8,
      };
    }

    const newLoot = generateLoot(undefined, customWeights);
    const shouldAutoSell = hasAutoSell && autoSellRarities.has(newLoot.rarity);

    const newState = { ...state };

    // Update inventory for correct area
    if (!shouldAutoSell) {
      if (isGalaxy) {
        newState.galaxyInventory = [...state.galaxyInventory, newLoot];
      } else {
        newState.inventory = [...state.inventory, newLoot];
      }
    }

    // Update drops history for correct area
    if (isGalaxy) {
      newState.galaxyDropsHistory = [newLoot, ...state.galaxyDropsHistory];
    } else {
      newState.dropsHistory = [newLoot, ...state.dropsHistory];
    }

    // Calculate XP and level for correct area
    const { xp: newXp, level: newLevel, coinReward: levelUpCoins } = addXp(
      currentXp,
      currentLevel,
      XP_REWARDS[newLoot.rarity]
    );
    if (isGalaxy) {
      newState.galaxyXp = newXp;
      newState.galaxyLevel = newLevel;
    } else {
      newState.xp = newXp;
      newState.level = newLevel;
    }

    // Calculate coins with area-specific bonuses
    const autoSellBonus = shouldAutoSell ? SELL_PRICES[newLoot.rarity] : 0;
    const baseCoins = COIN_REWARDS[newLoot.rarity] + levelUpCoins + autoSellBonus;
    const rebirthBonus = rebirthCount * 0.1;
    const prestigeBonus = prestigeCount * 1.0;
    const earnedCoins = baseCoins * (1 + rebirthBonus + prestigeBonus);

    if (isGalaxy) {
      newState.galaxyCoins = currentCoins + earnedCoins;
    } else {
      newState.coins = currentCoins + earnedCoins;
    }

    newState.stats = {
      totalChestsOpened: state.stats.totalChestsOpened + 1,
      totalCoinsEarned: state.stats.totalCoinsEarned + earnedCoins,
      legendariesFound:
        state.stats.legendariesFound +
        (newLoot.rarity === Rarity.Legendary ? 1 : 0),
    };

    // Egg drops for correct area
    const eggChance = 0.1;
    const rarityToCheck: (keyof typeof eggUpgrades)[] = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ];
    for (const rarity of rarityToCheck) {
      if (eggUpgrades[rarity] && Math.random() < eggChance) {
        const newEgg = {
          rarity: rarity as Rarity,
          id: `egg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
        if (isGalaxy) {
          newState.galaxyEggs = [...state.galaxyEggs, newEgg];
        } else {
          newState.eggs = [...state.eggs, newEgg];
        }
        break;
      }
    }

    return { state: newState, actionName: "openChest" };
  },

  // Sell random item (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const inventory = isGalaxy ? state.galaxyInventory : state.inventory;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const battleSlots = isGalaxy ? state.galaxyBattleSlots : state.battleSlots;

    if (inventory.length === 0) {
      return { state, actionName: "sellItem_skipped_empty" };
    }

    const randomIndex = Math.floor(Math.random() * inventory.length);
    const item = inventory[randomIndex];

    // Check if item is in battle slots - remove from slots first
    const newBattleSlots = battleSlots.map((slotId) =>
      slotId === item.id ? null : slotId
    );

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins + SELL_PRICES[item.rarity],
        galaxyInventory: state.galaxyInventory.filter((_, i) => i !== randomIndex),
        galaxyBattleSlots: newBattleSlots,
      };
      return { state: newState, actionName: "sellItem" };
    }

    const newState = {
      ...state,
      coins: currentCoins + SELL_PRICES[item.rarity],
      inventory: state.inventory.filter((_, i) => i !== randomIndex),
      battleSlots: newBattleSlots,
    };

    return { state: newState, actionName: "sellItem" };
  },

  // Upgrade coin generator (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const currentLevel = isGalaxy ? state.galaxyCoinGeneratorLevel : state.coinGeneratorLevel;

    const cost = getIdleUpgradeCost(currentLevel);
    if (currentCoins < cost) {
      return { state, actionName: "upgradeCoinGen_skipped_insufficient" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyCoinGeneratorLevel: currentLevel + 1,
      };
      return { state: newState, actionName: "upgradeCoinGenerator" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      coinGeneratorLevel: currentLevel + 1,
    };

    return { state: newState, actionName: "upgradeCoinGenerator" };
  },

  // Upgrade luck 1 (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const currentLuckUpgrades = isGalaxy ? state.galaxyLuckUpgrades : state.luckUpgrades;

    const MAX_LUCK_LEVEL = 4;
    if (currentLuckUpgrades.luckUpgrade1 >= MAX_LUCK_LEVEL) {
      return { state, actionName: "upgradeLuck1_skipped_max" };
    }

    const cost = getLuckUpgradeCost(4, currentLuckUpgrades.luckUpgrade1);
    if (currentCoins < cost) {
      return { state, actionName: "upgradeLuck1_skipped_insufficient" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyLuckUpgrades: {
          ...state.galaxyLuckUpgrades,
          luckUpgrade1: currentLuckUpgrades.luckUpgrade1 + 1,
        },
      };
      return { state: newState, actionName: "upgradeLuck1" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      luckUpgrades: {
        ...state.luckUpgrades,
        luckUpgrade1: currentLuckUpgrades.luckUpgrade1 + 1,
      },
    };

    return { state: newState, actionName: "upgradeLuck1" };
  },

  // Upgrade luck 2 (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const currentLuckUpgrades = isGalaxy ? state.galaxyLuckUpgrades : state.luckUpgrades;

    const MAX_LUCK_LEVEL = 4;
    if (currentLuckUpgrades.luckUpgrade2 >= MAX_LUCK_LEVEL) {
      return { state, actionName: "upgradeLuck2_skipped_max" };
    }

    const cost = getLuckUpgradeCost(6, currentLuckUpgrades.luckUpgrade2);
    if (currentCoins < cost) {
      return { state, actionName: "upgradeLuck2_skipped_insufficient" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyLuckUpgrades: {
          ...state.galaxyLuckUpgrades,
          luckUpgrade2: currentLuckUpgrades.luckUpgrade2 + 1,
        },
      };
      return { state: newState, actionName: "upgradeLuck2" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      luckUpgrades: {
        ...state.luckUpgrades,
        luckUpgrade2: currentLuckUpgrades.luckUpgrade2 + 1,
      },
    };

    return { state: newState, actionName: "upgradeLuck2" };
  },

  // Upgrade luck 3 (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const currentLuckUpgrades = isGalaxy ? state.galaxyLuckUpgrades : state.luckUpgrades;

    const MAX_LUCK_LEVEL = 4;
    if (currentLuckUpgrades.luckUpgrade3 >= MAX_LUCK_LEVEL) {
      return { state, actionName: "upgradeLuck3_skipped_max" };
    }

    const cost = getLuckUpgradeCost(10, currentLuckUpgrades.luckUpgrade3);
    if (currentCoins < cost) {
      return { state, actionName: "upgradeLuck3_skipped_insufficient" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyLuckUpgrades: {
          ...state.galaxyLuckUpgrades,
          luckUpgrade3: currentLuckUpgrades.luckUpgrade3 + 1,
        },
      };
      return { state: newState, actionName: "upgradeLuck3" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      luckUpgrades: {
        ...state.luckUpgrades,
        luckUpgrade3: currentLuckUpgrades.luckUpgrade3 + 1,
      },
    };

    return { state: newState, actionName: "upgradeLuck3" };
  },

  // Buy auto open (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const hasAutoOpen = isGalaxy ? state.galaxyHasAutoOpen : state.hasAutoOpen;

    const cost = 50;
    if (hasAutoOpen || currentCoins < cost) {
      return { state, actionName: "buyAutoOpen_skipped" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyHasAutoOpen: true,
      };
      return { state: newState, actionName: "buyAutoOpen" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      hasAutoOpen: true,
    };

    return { state: newState, actionName: "buyAutoOpen" };
  },

  // Buy auto sell (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const hasAutoSell = isGalaxy ? state.galaxyHasAutoSell : state.hasAutoSell;

    const cost = 25;
    if (hasAutoSell || currentCoins < cost) {
      return { state, actionName: "buyAutoSell_skipped" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - cost,
        galaxyHasAutoSell: true,
      };
      return { state: newState, actionName: "buyAutoSell" };
    }

    const newState = {
      ...state,
      coins: currentCoins - cost,
      hasAutoSell: true,
    };

    return { state: newState, actionName: "buyAutoSell" };
  },

  // Toggle auto sell rarity (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const hasAutoSell = isGalaxy ? state.galaxyHasAutoSell : state.hasAutoSell;
    const currentAutoSellRarities = isGalaxy ? state.galaxyAutoSellRarities : state.autoSellRarities;

    if (!hasAutoSell) {
      return { state, actionName: "toggleAutoSell_skipped_noFeature" };
    }

    const rarities = Object.values(Rarity);
    const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];

    const newAutoSellRarities = new Set(currentAutoSellRarities);
    if (newAutoSellRarities.has(randomRarity)) {
      newAutoSellRarities.delete(randomRarity);
    } else {
      newAutoSellRarities.add(randomRarity);
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyAutoSellRarities: newAutoSellRarities,
      };
      return { state: newState, actionName: `toggleAutoSell_${randomRarity}` };
    }

    const newState = {
      ...state,
      autoSellRarities: newAutoSellRarities,
    };

    return { state: newState, actionName: `toggleAutoSell_${randomRarity}` };
  },

  // Buy box upgrade (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const purchasedBoxes = isGalaxy ? state.galaxyPurchasedBoxes : state.purchasedBoxes;

    const boxes = [
      { id: "bronze", cost: 50 },
      { id: "silver", cost: 200 },
      { id: "gold", cost: 500 },
    ];

    // Find next box to buy
    const hasGold = purchasedBoxes.includes("gold");
    const hasSilver = purchasedBoxes.includes("silver");
    const hasBronze = purchasedBoxes.includes("bronze");

    let boxToBuy: { id: string; cost: number } | null = null;
    if (!hasBronze && !hasSilver && !hasGold) {
      boxToBuy = boxes[0];
    } else if (hasBronze && !hasSilver && !hasGold) {
      boxToBuy = boxes[1];
    } else if ((hasBronze || hasSilver) && !hasGold) {
      boxToBuy = boxes[2];
    }

    if (!boxToBuy || currentCoins < boxToBuy.cost) {
      return { state, actionName: "buyBox_skipped" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - boxToBuy.cost,
        galaxyPurchasedBoxes: [...state.galaxyPurchasedBoxes, boxToBuy.id],
      };
      return { state: newState, actionName: `buyBox_${boxToBuy.id}` };
    }

    const newState = {
      ...state,
      coins: currentCoins - boxToBuy.cost,
      purchasedBoxes: [...state.purchasedBoxes, boxToBuy.id],
    };

    return { state: newState, actionName: `buyBox_${boxToBuy.id}` };
  },

  // Buy pets feature
  (state) => {
    const cost = 3; // rebirth tokens
    if (state.hasPets || state.rebirthTokens < cost) {
      return { state, actionName: "buyPets_skipped" };
    }

    const newState = {
      ...state,
      rebirthTokens: state.rebirthTokens - cost,
      hasPets: true,
    };

    return { state: newState, actionName: "buyPets" };
  },

  // Buy egg upgrade (area-aware)
  (state) => {
    if (!state.hasPets) {
      return { state, actionName: "buyEggUpgrade_skipped_noPets" };
    }

    const isGalaxy = state.currentArea === 2;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const currentEggUpgrades = isGalaxy ? state.galaxyEggUpgrades : state.eggUpgrades;

    const upgrades: {
      rarity: keyof typeof state.eggUpgrades;
      cost: number;
    }[] = [
      { rarity: "common", cost: 25 },
      { rarity: "uncommon", cost: 50 },
      { rarity: "rare", cost: 75 },
      { rarity: "epic", cost: 100 },
      { rarity: "legendary", cost: 250 },
    ];

    // Find first unpurchased upgrade we can afford
    const upgrade = upgrades.find(
      (u) => !currentEggUpgrades[u.rarity] && currentCoins >= u.cost
    );

    if (!upgrade) {
      return { state, actionName: "buyEggUpgrade_skipped" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins - upgrade.cost,
        galaxyEggUpgrades: {
          ...state.galaxyEggUpgrades,
          [upgrade.rarity]: true,
        },
      };
      return { state: newState, actionName: `buyEggUpgrade_${upgrade.rarity}` };
    }

    const newState = {
      ...state,
      coins: currentCoins - upgrade.cost,
      eggUpgrades: {
        ...state.eggUpgrades,
        [upgrade.rarity]: true,
      },
    };

    return { state: newState, actionName: `buyEggUpgrade_${upgrade.rarity}` };
  },

  // Hatch egg (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const eggs = isGalaxy ? state.galaxyEggs : state.eggs;
    const pets = isGalaxy ? state.galaxyPets : state.pets;

    if (eggs.length === 0) {
      return { state, actionName: "hatchEgg_skipped_noEggs" };
    }

    const randomIndex = Math.floor(Math.random() * eggs.length);
    const egg = eggs[randomIndex];

    const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
    const newPet = {
      id: `pet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: petType === "dog" ? "Dog" : "Cat",
      type: petType,
      rarity: egg.rarity,
      bonus: generatePetBonus(petType, egg.rarity),
    };

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyEggs: state.galaxyEggs.filter((_, i) => i !== randomIndex),
        galaxyPets: [...pets, newPet],
      };
      return { state: newState, actionName: "hatchEgg" };
    }

    const newState = {
      ...state,
      eggs: state.eggs.filter((_, i) => i !== randomIndex),
      pets: [...pets, newPet],
    };

    return { state: newState, actionName: "hatchEgg" };
  },

  // Rebirth
  (state) => {
    if (state.currentArea === 2) {
      // Galaxy rebirth
      const cost = getRebirthCost(state.galaxyRebirthCount);
      if (state.galaxyCoins < cost) {
        return { state, actionName: "rebirth_skipped_insufficient" };
      }

      const newState: BotGameState = {
        ...state,
        // Reset galaxy state
        galaxyCoins: 0,
        galaxyXp: 0,
        galaxyLevel: 1,
        galaxyInventory: [],
        galaxyCoinGeneratorLevel: 0,
        galaxyLuckUpgrades: { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 },
        galaxyHasAutoOpen: false,
        galaxyHasAutoSell: false,
        galaxyAutoSellRarities: new Set(),
        galaxyPurchasedBoxes: [],
        galaxyDropsHistory: [],
        galaxyEggUpgrades: { common: false, uncommon: false, rare: false, epic: false, legendary: false },
        galaxyBattleWave: 1,
        galaxyBattleSlots: [null, null, null, null, null],
        // Increment galaxy rebirth
        galaxyRebirthTokens: state.galaxyRebirthTokens + 1,
        galaxyRebirthCount: state.galaxyRebirthCount + 1,
      };
      return { state: newState, actionName: "rebirth" };
    }

    // Normal rebirth (Area 1)
    const cost = getRebirthCost(state.rebirthCount);
    if (state.coins < cost) {
      return { state, actionName: "rebirth_skipped_insufficient" };
    }

    const newState: BotGameState = {
      ...state,
      // Reset area 1 state
      level: 1,
      xp: 0,
      coins: 0,
      inventory: [],
      coinGeneratorLevel: 0,
      luckUpgrades: { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 },
      hasAutoOpen: false,
      hasAutoSell: false,
      autoSellRarities: new Set(),
      purchasedBoxes: [],
      dropsHistory: [],
      eggUpgrades: { common: false, uncommon: false, rare: false, epic: false, legendary: false },
      battleWave: 1,
      battleSlots: [null, null, null, null, null],
      battleStreak: 0,
      eggs: [],
      // Increment rebirth
      rebirthTokens: state.rebirthTokens + 1,
      rebirthCount: state.rebirthCount + 1,
    };

    return { state: newState, actionName: "rebirth" };
  },

  // Equip weapon to battle slot (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const inventory = isGalaxy ? state.galaxyInventory : state.inventory;
    const battleSlots = isGalaxy ? state.galaxyBattleSlots : state.battleSlots;

    const weaponCategories = [
      ItemCategory.Pistol,
      ItemCategory.Rifle,
      ItemCategory.SMG,
      ItemCategory.Shotgun,
      ItemCategory.Sniper,
      ItemCategory.Heavy,
      ItemCategory.Armor,
      ItemCategory.Shield,
    ];

    const weapons = inventory.filter((item) =>
      weaponCategories.includes(item.category)
    );

    if (weapons.length === 0) {
      return { state, actionName: "equipWeapon_skipped_noWeapons" };
    }

    const randomSlot = Math.floor(Math.random() * 5);
    const randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];

    // Remove from old slot if already equipped elsewhere
    const newSlots = battleSlots.map((slotId) =>
      slotId === randomWeapon.id ? null : slotId
    );
    newSlots[randomSlot] = randomWeapon.id;

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyBattleSlots: newSlots,
      };
      return { state: newState, actionName: `equipWeapon_slot${randomSlot}` };
    }

    const newState = {
      ...state,
      battleSlots: newSlots,
    };

    return { state: newState, actionName: `equipWeapon_slot${randomSlot}` };
  },

  // Fight battle (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const inventory = isGalaxy ? state.galaxyInventory : state.inventory;
    const battleSlots = isGalaxy ? state.galaxyBattleSlots : state.battleSlots;
    const battleWave = isGalaxy ? state.galaxyBattleWave : state.battleWave;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const rebirthCount = isGalaxy ? state.galaxyRebirthCount : state.rebirthCount;

    const filledSlots = battleSlots.filter((s) => s !== null).length;
    if (filledSlots === 0) {
      return { state, actionName: "battle_skipped_noWeapons" };
    }

    // Calculate shield reduction
    let totalShieldReduction = 0;
    for (const slotId of battleSlots) {
      if (slotId) {
        const item = inventory.find((it) => it.id === slotId);
        if (item && item.category === ItemCategory.Shield) {
          totalShieldReduction += Math.abs(getWeaponPower(item));
        }
      }
    }

    let wins = 0;
    for (let i = 0; i < 5; i++) {
      const slotId = battleSlots[i];
      const item = slotId
        ? inventory.find((it) => it.id === slotId)
        : null;
      const rawPower = item ? getWeaponPower(item) : 0;
      const baseEnemyPower = generateEnemyPower(battleWave, i);
      const enemyPowerAfterShield = Math.max(
        0,
        baseEnemyPower - totalShieldReduction
      );

      if (item && item.category === ItemCategory.Armor) {
        if (rawPower >= enemyPowerAfterShield) wins++;
      } else if (item && item.category === ItemCategory.Shield) {
        // Shields can't win slots by themselves
      } else {
        if (rawPower > enemyPowerAfterShield) wins++;
      }
    }

    const won = wins >= 3;

    if (won) {
      // Scale rewards with wave: base 5 + wave number
      let baseCoins = 5 + battleWave;

      // Early wave bonus to encourage new players (waves 1-3 get extra coins)
      if (battleWave <= 3) {
        const earlyWaveBonus = (4 - battleWave) * 3; // Wave 1: +9, Wave 2: +6, Wave 3: +3
        baseCoins += earlyWaveBonus;
      }

      // Streak bonus: +10% per consecutive win (max 100% at 10 streak)
      const newStreak = state.battleStreak + 1;
      const streakBonus = Math.min(newStreak * 0.10, 1.0);

      // Rebirth bonus
      const rebirthBonus = rebirthCount * 0.1;

      // Calculate total coins
      const earnedCoins = baseCoins * (1 + rebirthBonus) * (1 + streakBonus);

      // Chance to drop a guaranteed rare+ item (20% base, +2% per wave, max 50%)
      const dropChance = Math.min(0.20 + (battleWave * 0.02), 0.50);
      let battleDrop: LootItem | null = null;
      if (Math.random() < dropChance) {
        const rarityRoll = Math.random();
        let dropRarity: Rarity;
        if (battleWave >= 10 && rarityRoll < 0.10) {
          dropRarity = Rarity.Legendary;
        } else if (battleWave >= 5 && rarityRoll < 0.30) {
          dropRarity = Rarity.Epic;
        } else {
          dropRarity = Rarity.Rare;
        }
        battleDrop = generateLootWithGuaranteedRarity(dropRarity);
      }

      if (isGalaxy) {
        const newState = {
          ...state,
          galaxyCoins: currentCoins + earnedCoins,
          galaxyBattleWave: battleWave + 1,
          battleStreak: newStreak,
          galaxyInventory: battleDrop ? [...state.galaxyInventory, battleDrop] : state.galaxyInventory,
          galaxyDropsHistory: battleDrop ? [battleDrop, ...state.galaxyDropsHistory].slice(0, 1000) : state.galaxyDropsHistory,
        };
        return { state: newState, actionName: "battle_won" };
      }

      const newState = {
        ...state,
        coins: currentCoins + earnedCoins,
        battleWave: battleWave + 1,
        battleStreak: newStreak,
        inventory: battleDrop ? [...state.inventory, battleDrop] : state.inventory,
        dropsHistory: battleDrop ? [battleDrop, ...state.dropsHistory].slice(0, 1000) : state.dropsHistory,
      };
      return { state: newState, actionName: "battle_won" };
    } else {
      // Lost - reset streak
      const newState = {
        ...state,
        battleStreak: 0,
      };
      return { state: newState, actionName: "battle_lost" };
    }
  },

  // Bulk sell by rarity (area-aware)
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const inventory = isGalaxy ? state.galaxyInventory : state.inventory;
    const currentCoins = isGalaxy ? state.galaxyCoins : state.coins;
    const battleSlots = isGalaxy ? state.galaxyBattleSlots : state.battleSlots;

    if (inventory.length === 0) {
      return { state, actionName: "bulkSell_skipped_empty" };
    }

    const rarities = Object.values(Rarity);
    const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];

    const itemsToSell = inventory.filter(
      (item) => item.rarity === randomRarity
    );
    if (itemsToSell.length === 0) {
      return { state, actionName: `bulkSell_skipped_no${randomRarity}` };
    }

    const totalValue = itemsToSell.reduce(
      (total, item) => total + SELL_PRICES[item.rarity],
      0
    );
    const idsToSell = new Set(itemsToSell.map((i) => i.id));

    // Remove from battle slots
    const newBattleSlots = battleSlots.map((slotId) =>
      slotId && idsToSell.has(slotId) ? null : slotId
    );

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyCoins: currentCoins + totalValue,
        galaxyInventory: state.galaxyInventory.filter((item) => !idsToSell.has(item.id)),
        galaxyBattleSlots: newBattleSlots,
      };
      return {
        state: newState,
        actionName: `bulkSell_${randomRarity}_${itemsToSell.length}items`,
      };
    }

    const newState = {
      ...state,
      coins: currentCoins + totalValue,
      inventory: state.inventory.filter((item) => !idsToSell.has(item.id)),
      battleSlots: newBattleSlots,
    };

    return {
      state: newState,
      actionName: `bulkSell_${randomRarity}_${itemsToSell.length}items`,
    };
  },

  // Simulate idle coin generation (1 second worth)
  (state) => {
    if (state.currentArea === 2) {
      if (state.galaxyCoinGeneratorLevel <= 0) {
        return { state, actionName: "idleCoins_skipped_noGenerator" };
      }
      const baseCoinsPerSecond = state.galaxyCoinGeneratorLevel * 0.01;
      const rebirthBonus = state.galaxyRebirthCount * 0.1;
      const prestigeBonus = state.galaxyPrestigeCount * 1.0;
      const coinsPerSecond = baseCoinsPerSecond * (1 + rebirthBonus + prestigeBonus);
      const newState = {
        ...state,
        galaxyCoins: state.galaxyCoins + coinsPerSecond,
      };
      return { state: newState, actionName: "idleCoins" };
    }

    if (state.coinGeneratorLevel <= 0) {
      return { state, actionName: "idleCoins_skipped_noGenerator" };
    }

    const baseCoinsPerSecond = state.coinGeneratorLevel * 0.01;
    const rebirthBonus = state.rebirthCount * 0.1;
    const prestigeBonus = state.prestigeCount * 1.0;
    const coinsPerSecond = baseCoinsPerSecond * (1 + rebirthBonus + prestigeBonus);

    const newState = {
      ...state,
      coins: state.coins + coinsPerSecond,
    };

    return { state: newState, actionName: "idleCoins" };
  },

  // Switch area (Area 1 <-> Area 2 Galaxy)
  (state) => {
    // Can only go to Galaxy if prestige count >= 1
    if (state.currentArea === 1 && state.prestigeCount < 1) {
      return { state, actionName: "switchArea_skipped_noPrestige" };
    }

    const newArea = state.currentArea === 1 ? 2 : 1;
    const newState = {
      ...state,
      currentArea: newArea,
    };

    return { state: newState, actionName: `switchArea_to${newArea}` };
  },

  // Prestige
  (state) => {
    if (state.currentArea === 2) {
      // Galaxy prestige - costs galaxy rebirth tokens
      const cost = 5 * (state.galaxyPrestigeCount + 1);
      if (state.galaxyRebirthTokens < cost) {
        return { state, actionName: "prestige_skipped_insufficient" };
      }

      const newState: BotGameState = {
        ...state,
        // Reset galaxy rebirth tokens/count
        galaxyRebirthTokens: 0,
        galaxyRebirthCount: 0,
        // Reset galaxy state
        galaxyCoins: 0,
        galaxyXp: 0,
        galaxyLevel: 1,
        galaxyInventory: [],
        galaxyCoinGeneratorLevel: 0,
        galaxyLuckUpgrades: { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 },
        galaxyHasAutoOpen: false,
        galaxyHasAutoSell: false,
        galaxyAutoSellRarities: new Set(),
        galaxyPurchasedBoxes: [],
        galaxyDropsHistory: [],
        galaxyEggUpgrades: { common: false, uncommon: false, rare: false, epic: false, legendary: false },
        galaxyBattleWave: 1,
        galaxyBattleSlots: [null, null, null, null, null],
        galaxyEquippedPets: [],
        // Increment galaxy prestige
        galaxyPrestigeCount: state.galaxyPrestigeCount + 1,
      };
      return { state: newState, actionName: "prestige" };
    }

    // Normal prestige (Area 1) - costs rebirth tokens
    const cost = 5 * (state.prestigeCount + 1);
    if (state.rebirthTokens < cost) {
      return { state, actionName: "prestige_skipped_insufficient" };
    }

    const newState: BotGameState = {
      ...state,
      // Reset rebirth tokens/count
      rebirthTokens: 0,
      rebirthCount: 0,
      // Reset area 1 state
      level: 1,
      xp: 0,
      coins: 0,
      inventory: [],
      coinGeneratorLevel: 0,
      luckUpgrades: { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 },
      hasAutoOpen: false,
      hasAutoSell: false,
      autoSellRarities: new Set(),
      purchasedBoxes: [],
      dropsHistory: [],
      eggUpgrades: { common: false, uncommon: false, rare: false, epic: false, legendary: false },
      battleWave: 1,
      battleSlots: [null, null, null, null, null],
      battleStreak: 0,
      eggs: [],
      equippedPets: [],
      // Increment prestige
      prestigeCount: state.prestigeCount + 1,
    };

    return { state: newState, actionName: "prestige" };
  },

  // Merge 3 items of same rarity into 1 of higher rarity
  (state) => {
    const isGalaxy = state.currentArea === 2;
    const inventory = isGalaxy ? state.galaxyInventory : state.inventory;
    const battleSlots = isGalaxy ? state.galaxyBattleSlots : state.battleSlots;

    if (inventory.length < 3) {
      return { state, actionName: "mergeItems_skipped_notEnough" };
    }

    // Group items by rarity (exclude items in battle slots)
    const battleSlotIds = new Set(battleSlots.filter(Boolean) as string[]);
    const byRarity: Record<string, LootItem[]> = {};
    for (const item of inventory) {
      if (item.rarity !== Rarity.Legendary && !battleSlotIds.has(item.id)) { // Can't merge legendaries or equipped items
        if (!byRarity[item.rarity]) byRarity[item.rarity] = [];
        byRarity[item.rarity].push(item);
      }
    }

    // Find a rarity with 3+ items
    const mergeableRarity = Object.entries(byRarity).find(([_, items]) => items.length >= 3);
    if (!mergeableRarity) {
      return { state, actionName: "mergeItems_skipped_noTriples" };
    }

    const [rarity, items] = mergeableRarity;
    const itemsToMerge = items.slice(0, 3);
    const idsToRemove = new Set(itemsToMerge.map(i => i.id));

    // Get next rarity
    const rarityOrder = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];
    const currentIndex = rarityOrder.indexOf(rarity as Rarity);
    const nextRarity = rarityOrder[currentIndex + 1];

    const newItem = generateLootWithGuaranteedRarity(nextRarity);
    if (!newItem) {
      return { state, actionName: "mergeItems_failed" };
    }

    if (isGalaxy) {
      const newState = {
        ...state,
        galaxyInventory: [...state.galaxyInventory.filter(i => !idsToRemove.has(i.id)), newItem],
        galaxyDropsHistory: [newItem, ...state.galaxyDropsHistory].slice(0, 1000),
      };
      return { state: newState, actionName: `mergeItems_${rarity}` };
    }

    const newState = {
      ...state,
      inventory: [...state.inventory.filter(i => !idsToRemove.has(i.id)), newItem],
      dropsHistory: [newItem, ...state.dropsHistory].slice(0, 1000),
    };

    return { state: newState, actionName: `mergeItems_${rarity}` };
  },

  // Equip pet
  (state) => {
    const pets = state.currentArea === 2 ? state.galaxyPets : state.pets;
    const equippedPets = state.currentArea === 2 ? state.galaxyEquippedPets : state.equippedPets;

    if (pets.length === 0) {
      return { state, actionName: "equipPet_skipped_noPets" };
    }

    // Find a pet that's not already equipped
    const unequippedPets = pets.filter(p => !equippedPets.includes(p.id));
    if (unequippedPets.length === 0 || equippedPets.length >= 6) {
      return { state, actionName: "equipPet_skipped_allEquipped" };
    }

    const petToEquip = unequippedPets[Math.floor(Math.random() * unequippedPets.length)];

    if (state.currentArea === 2) {
      const newState = {
        ...state,
        galaxyEquippedPets: [...state.galaxyEquippedPets, petToEquip.id],
      };
      return { state: newState, actionName: "equipPet" };
    }

    const newState = {
      ...state,
      equippedPets: [...state.equippedPets, petToEquip.id],
    };

    return { state: newState, actionName: "equipPet" };
  },

  // Unequip pet
  (state) => {
    const equippedPets = state.currentArea === 2 ? state.galaxyEquippedPets : state.equippedPets;

    if (equippedPets.length === 0) {
      return { state, actionName: "unequipPet_skipped_noneEquipped" };
    }

    const randomIndex = Math.floor(Math.random() * equippedPets.length);

    if (state.currentArea === 2) {
      const newState = {
        ...state,
        galaxyEquippedPets: state.galaxyEquippedPets.filter((_, i) => i !== randomIndex),
      };
      return { state: newState, actionName: "unequipPet" };
    }

    const newState = {
      ...state,
      equippedPets: state.equippedPets.filter((_, i) => i !== randomIndex),
    };

    return { state: newState, actionName: "unequipPet" };
  },
];

// ============================================
// Test Runner
// ============================================

export interface BotTestConfig {
  numBots: number;
  actionsPerBot: number;
  verbose: boolean;
  seed?: number;
  battleMode?: boolean;
}

export function runBotTest(config: BotTestConfig): TestResult[] {
  const results: TestResult[] = [];

  for (let botIndex = 0; botIndex < config.numBots; botIndex++) {
    const startTime = Date.now();
    let state = createInitialState();
    const bugs: BugReport[] = [];
    const actionCounts: Record<string, number> = {};

    if (config.verbose) {
      console.log(`\n[Bot ${botIndex + 1}/${config.numBots}] Starting test...`);
    }

    for (let i = 0; i < config.actionsPerBot; i++) {
      // Pick a random action with configurable weights
      let actionIndex: number;
      const roll = Math.random();

      if (config.battleMode) {
        // Battle mode: 40% battle, 30% open chest, 30% other
        if (roll < 0.40) {
          actionIndex = 15; // Battle action (Fight battle)
        } else if (roll < 0.70) {
          actionIndex = 0; // Open chest
        } else {
          actionIndex = Math.floor(Math.random() * botActions.length);
        }
      } else {
        // Normal mode: 50% open chest, 50% random
        if (roll < 0.5) {
          actionIndex = 0; // Open chest
        } else {
          actionIndex = Math.floor(Math.random() * botActions.length);
        }
      }

      const action = botActions[actionIndex];
      const result = action(state);
      state = result.state;

      // Count actions - preserve battle_won and battle_lost for detailed tracking
      let baseActionName = result.actionName.split("_")[0];
      if (result.actionName === "battle_won" || result.actionName === "battle_lost") {
        baseActionName = result.actionName; // Keep full name for battle results
      }
      actionCounts[baseActionName] = (actionCounts[baseActionName] || 0) + 1;

      // Validate state after action
      const actionBugs = validateState(state, result.actionName);
      bugs.push(...actionBugs);

      if (config.verbose && actionBugs.length > 0) {
        console.log(
          `  [Action ${i + 1}] ${result.actionName}: ${actionBugs.length} bug(s) found`
        );
        for (const bug of actionBugs) {
          console.log(`    - [${bug.type}] ${bug.category}: ${bug.message}`);
        }
      }

      // Stop if critical bugs found
      const criticalBugs = bugs.filter((b) => b.type === "error");
      if (criticalBugs.length >= 10) {
        if (config.verbose) {
          console.log(`  [Bot ${botIndex + 1}] Stopping early: too many critical bugs`);
        }
        break;
      }
    }

    const duration = Date.now() - startTime;

    results.push({
      totalActions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
      bugs,
      actionCounts,
      finalState: state,
      duration,
    });

    if (config.verbose) {
      console.log(`[Bot ${botIndex + 1}] Completed in ${duration}ms`);
      console.log(`  Total actions: ${results[botIndex].totalActions}`);
      console.log(`  Bugs found: ${bugs.length}`);
      console.log(`  Final level: ${state.level}`);
      console.log(`  Final coins: ${state.coins.toFixed(2)}`);
      console.log(`  Final inventory: ${state.inventory.length} items`);
    }
  }

  return results;
}

export function generateTestReport(results: TestResult[]): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("BOT TEST REPORT");
  lines.push("=".repeat(60));
  lines.push("");

  // Summary
  const totalBugs = results.reduce((sum, r) => sum + r.bugs.length, 0);
  const totalActions = results.reduce((sum, r) => sum + r.totalActions, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  lines.push("SUMMARY");
  lines.push("-".repeat(40));
  lines.push(`Bots tested: ${results.length}`);
  lines.push(`Total actions: ${totalActions.toLocaleString()}`);
  lines.push(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  lines.push(`Total bugs found: ${totalBugs}`);
  lines.push("");

  // Bug breakdown
  const allBugs = results.flatMap((r) => r.bugs);
  const bugsByType: Record<string, BugReport[]> = {};
  for (const bug of allBugs) {
    const key = `${bug.type}:${bug.category}`;
    bugsByType[key] = bugsByType[key] || [];
    bugsByType[key].push(bug);
  }

  if (allBugs.length > 0) {
    lines.push("BUGS BY CATEGORY");
    lines.push("-".repeat(40));
    for (const [key, bugs] of Object.entries(bugsByType).sort(
      (a, b) => b[1].length - a[1].length
    )) {
      lines.push(`${key}: ${bugs.length}`);
      // Show first example
      lines.push(`  Example: ${bugs[0].message}`);
      if (bugs[0].action) {
        lines.push(`  Action: ${bugs[0].action}`);
      }
    }
    lines.push("");
  }

  // Action distribution
  const allActions: Record<string, number> = {};
  for (const result of results) {
    for (const [action, count] of Object.entries(result.actionCounts)) {
      allActions[action] = (allActions[action] || 0) + count;
    }
  }

  lines.push("ACTION DISTRIBUTION");
  lines.push("-".repeat(40));
  for (const [action, count] of Object.entries(allActions).sort(
    (a, b) => b[1] - a[1]
  )) {
    const pct = ((count / totalActions) * 100).toFixed(1);
    lines.push(`${action}: ${count.toLocaleString()} (${pct}%)`);
  }
  lines.push("");

  // Final state summary
  lines.push("FINAL STATE SUMMARY (averages)");
  lines.push("-".repeat(40));
  const avgLevel =
    results.reduce((sum, r) => sum + r.finalState.level, 0) / results.length;
  const avgCoins =
    results.reduce((sum, r) => sum + r.finalState.coins, 0) / results.length;
  const avgInventory =
    results.reduce((sum, r) => sum + r.finalState.inventory.length, 0) /
    results.length;
  const avgChestsOpened =
    results.reduce((sum, r) => sum + r.finalState.stats.totalChestsOpened, 0) /
    results.length;
  const avgRebirths =
    results.reduce((sum, r) => sum + r.finalState.rebirthCount, 0) /
    results.length;

  const avgPrestige =
    results.reduce((sum, r) => sum + r.finalState.prestigeCount, 0) /
    results.length;
  const avgPets =
    results.reduce((sum, r) => sum + r.finalState.pets.length, 0) /
    results.length;
  const avgEquippedPets =
    results.reduce((sum, r) => sum + r.finalState.equippedPets.length, 0) /
    results.length;

  lines.push(`Average level: ${avgLevel.toFixed(1)}`);
  lines.push(`Average coins: ${avgCoins.toFixed(2)}`);
  lines.push(`Average inventory size: ${avgInventory.toFixed(0)}`);
  lines.push(`Average chests opened: ${avgChestsOpened.toFixed(0)}`);
  lines.push(`Average rebirths: ${avgRebirths.toFixed(2)}`);
  lines.push(`Average prestiges: ${avgPrestige.toFixed(2)}`);
  lines.push(`Average pets: ${avgPets.toFixed(1)}`);
  lines.push(`Average equipped pets: ${avgEquippedPets.toFixed(1)}`);
  lines.push("");

  // Galaxy statistics
  const botsInGalaxy = results.filter(r => r.finalState.currentArea === 2).length;
  const avgGalaxyCoins =
    results.reduce((sum, r) => sum + r.finalState.galaxyCoins, 0) /
    results.length;
  const avgGalaxyLevel =
    results.reduce((sum, r) => sum + r.finalState.galaxyLevel, 0) /
    results.length;
  const avgGalaxyRebirths =
    results.reduce((sum, r) => sum + r.finalState.galaxyRebirthCount, 0) /
    results.length;
  const avgGalaxyPrestige =
    results.reduce((sum, r) => sum + r.finalState.galaxyPrestigeCount, 0) /
    results.length;

  if (avgGalaxyCoins > 0 || avgGalaxyRebirths > 0 || botsInGalaxy > 0) {
    lines.push("GALAXY AREA STATISTICS");
    lines.push("-".repeat(40));
    lines.push(`Bots in galaxy area: ${botsInGalaxy}/${results.length}`);
    lines.push(`Average galaxy level: ${avgGalaxyLevel.toFixed(1)}`);
    lines.push(`Average galaxy coins: ${avgGalaxyCoins.toFixed(2)}`);
    lines.push(`Average galaxy rebirths: ${avgGalaxyRebirths.toFixed(2)}`);
    lines.push(`Average galaxy prestiges: ${avgGalaxyPrestige.toFixed(2)}`);
    lines.push("");
  }

  // Battle statistics
  const totalBattleWins = allActions["battle_won"] || 0;
  const totalBattleLosses = allActions["battle_lost"] || 0;
  const totalBattles = totalBattleWins + totalBattleLosses;

  if (totalBattles > 0) {
    lines.push("BATTLE STATISTICS");
    lines.push("-".repeat(40));
    const winRate = ((totalBattleWins / totalBattles) * 100).toFixed(1);
    lines.push(`Total battles: ${totalBattles.toLocaleString()}`);
    lines.push(`  Wins: ${totalBattleWins.toLocaleString()} (${winRate}%)`);
    lines.push(`  Losses: ${totalBattleLosses.toLocaleString()} (${(100 - parseFloat(winRate)).toFixed(1)}%)`);

    const avgWave = results.reduce((sum, r) => sum + r.finalState.battleWave, 0) / results.length;
    const maxWave = Math.max(...results.map(r => r.finalState.battleWave));
    const avgStreak = results.reduce((sum, r) => sum + r.finalState.battleStreak, 0) / results.length;
    const botsWithStreak = results.filter(r => r.finalState.battleStreak > 0).length;

    lines.push(`Average final wave: ${avgWave.toFixed(1)}`);
    lines.push(`Highest wave reached: ${maxWave}`);
    lines.push(`Bots with active streak: ${botsWithStreak}/${results.length}`);
    lines.push(`Average streak at end: ${avgStreak.toFixed(1)}`);
    lines.push("");
  }

  // Conclusion
  lines.push("=".repeat(60));
  if (totalBugs === 0) {
    lines.push("RESULT: NO BUGS FOUND");
  } else {
    const errors = allBugs.filter((b) => b.type === "error").length;
    const warnings = allBugs.filter((b) => b.type === "warning").length;
    const anomalies = allBugs.filter((b) => b.type === "anomaly").length;
    lines.push(`RESULT: ${totalBugs} ISSUES FOUND`);
    lines.push(`  Errors: ${errors}`);
    lines.push(`  Warnings: ${warnings}`);
    lines.push(`  Anomalies: ${anomalies}`);
  }
  lines.push("=".repeat(60));

  return lines.join("\n");
}

// CLI entry point
declare const process: { argv: string[] } | undefined;
if (typeof process !== "undefined" && process?.argv) {
  const args = process.argv.slice(2);
  const numBots = parseInt(args[0]) || 5;
  const actionsPerBot = parseInt(args[1]) || 5000;
  const verbose = args.includes("--verbose") || args.includes("-v");
  const battleMode = args.includes("--battle-mode");

  const modeLabel = battleMode ? " (battle mode: 40% battles)" : "";
  console.log(`Running bot test with ${numBots} bots, ${actionsPerBot} actions each${modeLabel}...`);
  console.log("");

  const results = runBotTest({
    numBots,
    actionsPerBot,
    verbose,
    battleMode,
  });

  console.log("");
  console.log(generateTestReport(results));
}
