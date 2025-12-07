import { GameSave, LootItem, SAVE_KEY, SAVE_VERSION, Rarity, ItemCategory } from "../types";
import { Pet, EggUpgrades } from "../game/pets";
import { LuckUpgrades } from "./calculations";
import {
  MAX_OFFLINE_SECONDS,
  IDLE_COINS_PER_SECOND_PER_LEVEL,
} from "../constants/gameBalance";

export type SaveError = { type: 'quota' | 'unknown'; message: string } | null;

let lastSaveError: SaveError = null;

/**
 * Game state interface for creating saves
 */
export interface GameStateForSave {
  level: number;
  xp: number;
  coins: number;
  inventory: LootItem[];
  coinGeneratorLevel: number;
  luckUpgrades: LuckUpgrades;
  hasAutoOpen: boolean;
  hasAutoSell: boolean;
  autoSellRarities: Set<Rarity>;
  hasPets: boolean;
  eggUpgrades: EggUpgrades;
  rebirthTokens: number;
  rebirthCount: number;
  prestigeCount: number;
  currentArea: number;
  eggs: { rarity: Rarity; id: string }[];
  pets: Pet[];
  equippedPets: string[];
  dropsHistory: LootItem[];
  stats: {
    totalChestsOpened: number;
    totalCoinsEarned: number;
    legendariesFound: number;
  };
  purchasedBoxes: string[];
  battleWave: number;
  battleSlots: (string | null)[];
  // Galaxy state
  galaxyRebirthTokens: number;
  galaxyRebirthCount: number;
  galaxyPrestigeCount: number;
  galaxyEggs: { rarity: Rarity; id: string }[];
  galaxyPets: Pet[];
  galaxyEquippedPets: string[];
  // Permanent prestige upgrades (survives prestige)
  permanentCoinGen: number;
  galaxyPermanentCoinGen: number;
  // Galaxy area-specific state (separate from area 1)
  galaxyCoins?: number;
  galaxyXp?: number;
  galaxyLevel?: number;
  galaxyInventory?: LootItem[];
  galaxyCoinGeneratorLevel?: number;
  galaxyLuckUpgrades?: LuckUpgrades;
  galaxyHasAutoOpen?: boolean;
  galaxyHasAutoSell?: boolean;
  galaxyAutoSellRarities?: Set<Rarity>;
  galaxyPurchasedBoxes?: string[];
  galaxyDropsHistory?: LootItem[];
  galaxyEggUpgrades?: EggUpgrades;
  galaxyBattleWave?: number;
  galaxyBattleSlots?: (string | null)[];
}

/**
 * Creates a GameSave object from the current game state.
 * Single source of truth - eliminates duplication.
 */
export function createGameSave(state: GameStateForSave): GameSave {
  return {
    version: SAVE_VERSION,
    lastSaved: Date.now(),
    player: {
      level: state.level,
      xp: state.xp,
      coins: state.coins,
    },
    inventory: state.inventory,
    upgrades: {
      coinGeneratorLevel: state.coinGeneratorLevel,
      luckUpgrade1: state.luckUpgrades.luckUpgrade1,
      luckUpgrade2: state.luckUpgrades.luckUpgrade2,
      luckUpgrade3: state.luckUpgrades.luckUpgrade3,
      hasAutoOpen: state.hasAutoOpen,
      hasAutoSell: state.hasAutoSell,
      autoSellRarities: Array.from(state.autoSellRarities),
      hasPets: state.hasPets,
      eggUpgrades: state.eggUpgrades,
    },
    rebirth: {
      tokens: state.rebirthTokens,
      count: state.rebirthCount,
    },
    prestige: {
      count: state.prestigeCount,
      permanentCoinGen: state.permanentCoinGen,
    },
    galaxyRebirth: {
      tokens: state.galaxyRebirthTokens,
      count: state.galaxyRebirthCount,
    },
    galaxyPrestige: {
      count: state.galaxyPrestigeCount,
      permanentCoinGen: state.galaxyPermanentCoinGen,
    },
    area: state.currentArea,
    eggs: state.eggs,
    pets: state.pets,
    equippedPets: state.equippedPets,
    galaxyEggs: state.galaxyEggs,
    galaxyPets: state.galaxyPets,
    galaxyEquippedPets: state.galaxyEquippedPets,
    dropsHistory: state.dropsHistory,
    stats: state.stats,
    purchasedBoxes: state.purchasedBoxes,
    battle: {
      wave: state.battleWave,
      slots: state.battleSlots,
    },
    // Galaxy area-specific state
    galaxyState: {
      coins: state.galaxyCoins ?? 0,
      xp: state.galaxyXp ?? 0,
      level: state.galaxyLevel ?? 1,
      inventory: state.galaxyInventory ?? [],
      coinGeneratorLevel: state.galaxyCoinGeneratorLevel ?? 0,
      luckUpgrades: state.galaxyLuckUpgrades ?? { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 },
      hasAutoOpen: state.galaxyHasAutoOpen ?? false,
      hasAutoSell: state.galaxyHasAutoSell ?? false,
      autoSellRarities: state.galaxyAutoSellRarities ? Array.from(state.galaxyAutoSellRarities) : [],
      purchasedBoxes: state.galaxyPurchasedBoxes ?? [],
      dropsHistory: state.galaxyDropsHistory ?? [],
      eggUpgrades: state.galaxyEggUpgrades ?? { common: false, uncommon: false, rare: false, epic: false, legendary: false },
      battleWave: state.galaxyBattleWave ?? 1,
      battleSlots: state.galaxyBattleSlots ?? [null, null, null, null, null],
    },
  };
}

export function saveGame(save: GameSave): SaveError {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    lastSaveError = null;
    return null;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      lastSaveError = { type: 'quota', message: 'Storage full! Try selling some items.' };
    } else {
      lastSaveError = { type: 'unknown', message: 'Failed to save game.' };
    }
    console.error("Failed to save game:", e);
    return lastSaveError;
  }
}

export function getLastSaveError(): SaveError {
  return lastSaveError;
}

/**
 * Validation result for save data
 */
export interface SaveValidationResult {
  valid: boolean;
  errors: string[];
  save: GameSave | null;
}

/**
 * Validates a parsed save object to ensure all required fields exist and have valid values.
 */
export function validateSave(data: unknown): SaveValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Save data is not an object'], save: null };
  }

  const save = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof save.version !== 'number') {
    errors.push('Missing or invalid version');
  }

  if (!save.player || typeof save.player !== 'object') {
    errors.push('Missing or invalid player data');
  } else {
    const player = save.player as Record<string, unknown>;
    if (typeof player.level !== 'number' || player.level < 1) {
      errors.push('Invalid player level');
    }
    if (typeof player.xp !== 'number' || player.xp < 0) {
      errors.push('Invalid player xp');
    }
    if (typeof player.coins !== 'number' || player.coins < 0) {
      errors.push('Invalid player coins');
    }
  }

  if (!Array.isArray(save.inventory)) {
    errors.push('Invalid inventory');
  }

  if (!save.stats || typeof save.stats !== 'object') {
    errors.push('Missing or invalid stats');
  }

  if (errors.length > 0) {
    return { valid: false, errors, save: null };
  }

  return { valid: true, errors: [], save: save as unknown as GameSave };
}

export function loadGame(): GameSave | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    const validation = validateSave(parsed);

    if (!validation.valid) {
      console.error("Invalid save data:", validation.errors);
      return null;
    }

    // Version check for future migrations
    if (validation.save && validation.save.version !== SAVE_VERSION) {
      console.log("Save version mismatch, may need migration");
    }

    return validation.save;
  } catch (e) {
    console.error("Failed to load game:", e);
    return null;
  }
}

/**
 * Multiplier info for offline earnings calculation
 */
export interface OfflineMultipliers {
  rebirthCount: number;
  prestigeCount: number;
  totalDogBonus: number;
}

/**
 * Calculates offline earnings including all multipliers.
 * FIXED: Now includes rebirth, prestige, and pet bonuses.
 */
export function calculateOfflineEarnings(
  lastSaved: number,
  coinGeneratorLevel: number,
  multipliers?: OfflineMultipliers
): number {
  if (coinGeneratorLevel <= 0) return 0;

  const now = Date.now();
  const secondsAway = (now - lastSaved) / 1000;
  const cappedSeconds = Math.min(secondsAway, MAX_OFFLINE_SECONDS);
  const baseCoinsPerSecond = coinGeneratorLevel * IDLE_COINS_PER_SECOND_PER_LEVEL;

  // Calculate total multiplier (same formula as online earnings)
  let coinMultiplier = 1;
  if (multipliers) {
    const rebirthBonus = multipliers.rebirthCount * 0.10;
    const prestigeBonus = multipliers.prestigeCount * 1.0;
    const dogBonus = multipliers.totalDogBonus / 100;
    coinMultiplier = 1 + rebirthBonus + prestigeBonus + dogBonus;
  }

  return cappedSeconds * baseCoinsPerSecond * coinMultiplier;
}
