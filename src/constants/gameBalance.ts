/**
 * Game Balance Constants
 * All magic numbers extracted to a single location for easy balancing.
 */

// ============================================
// MULTIPLIERS & BONUSES
// ============================================

/** Coin bonus per rebirth (10% = 0.10) */
export const REBIRTH_COIN_BONUS_PER_LEVEL = 0.10;

/** Coin bonus per prestige (100% = 1.0) */
export const PRESTIGE_COIN_BONUS_PER_LEVEL = 1.0;

/** Divisor for converting pet bonus percentage to multiplier */
export const PET_BONUS_DIVISOR = 100;

/** Bonus event multiplier (adds 100% = 2x total) */
export const BONUS_EVENT_MULTIPLIER = 1.0;

/** Bonus event duration in milliseconds (5 minutes) */
export const BONUS_EVENT_DURATION_MS = 5 * 60 * 1000;

// ============================================
// CHEST & CRITICAL HITS
// ============================================

/** Critical hit chance on manual chest open (15%) */
export const CRITICAL_HIT_CHANCE = 0.15;

/** Critical hit reward multiplier */
export const CRITICAL_HIT_MULTIPLIER = 2;

/** Chance to trigger bonus event on critical hit (10%) */
export const BONUS_EVENT_TRIGGER_CHANCE = 0.10;

/** Egg drop chance per eligible rarity (10%) */
export const EGG_DROP_CHANCE = 0.10;

// ============================================
// AUTO-OPEN
// ============================================

/** Auto-open interval in milliseconds */
export const AUTO_OPEN_INTERVAL_MS = 5000;

/** Progress bar update interval in milliseconds */
export const AUTO_OPEN_PROGRESS_UPDATE_MS = 50;

// ============================================
// IDLE GENERATION
// ============================================

/** Base coins per second per generator level */
export const IDLE_COINS_PER_SECOND_PER_LEVEL = 0.01;

/** Idle generation tick rate in milliseconds */
export const IDLE_TICK_INTERVAL_MS = 100;

/** Maximum offline earnings in seconds (8 hours) */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

// ============================================
// UPGRADE COSTS
// ============================================

/** Base cost for idle upgrade */
export const IDLE_UPGRADE_BASE_COST = 3;

/** Idle upgrade cost multiplier per level */
export const IDLE_UPGRADE_COST_MULTIPLIER = 1.05;

/** Luck upgrade cost multiplier per level */
export const LUCK_UPGRADE_COST_MULTIPLIER = 1.07;

/** Luck upgrade base costs */
export const LUCK_UPGRADE_BASE_COSTS = {
  1: 4,
  2: 6,
  3: 10,
} as const;

/** Auto-open upgrade cost */
export const AUTO_OPEN_COST = 50;

/** Auto-sell upgrade cost */
export const AUTO_SELL_COST = 25;

/** Pets unlock cost (in rebirth tokens) */
export const PETS_UNLOCK_COST = 3;

/** Egg upgrade costs by rarity */
export const EGG_UPGRADE_COSTS = {
  common: 25,
  uncommon: 50,
  rare: 75,
  epic: 100,
  legendary: 250,
} as const;

// ============================================
// BOX MODIFIERS
// ============================================

export const BOX_RARITY_MODIFIERS = {
  gold: {
    common: -20,
    epic: 15,
    legendary: 5,
  },
  silver: {
    common: -15,
    uncommon: 5,
    rare: 10,
  },
  bronze: {
    common: -8,
    uncommon: 8,
  },
} as const;

/** Box costs */
export const BOX_COSTS = {
  bronze: 50,
  silver: 200,
  gold: 500,
} as const;

// ============================================
// REBIRTH & PRESTIGE
// ============================================

/** Base rebirth cost */
export const REBIRTH_BASE_COST = 200;

/** Rebirth cost multiplier per rebirth */
export const REBIRTH_COST_MULTIPLIER = 1.25;

/** Prestige costs by level (doubles after index 4) */
export const PRESTIGE_COSTS = [8, 20, 50, 100, 200] as const;

/** Prestige required for area 2 */
export const AREA_2_PRESTIGE_REQUIREMENT = 2;

// ============================================
// BATTLE SYSTEM
// ============================================

/** Number of battle slots */
export const BATTLE_SLOTS_COUNT = 5;

/** Wins required to win battle */
export const BATTLE_WINS_REQUIRED = 3;

/** Base coins per battle win */
export const BATTLE_BASE_COINS = 5;

/** Early wave bonus coins per wave difference from 4 */
export const BATTLE_EARLY_WAVE_BONUS_MULTIPLIER = 3;

/** Maximum early wave for bonus (waves 1-3 get bonus) */
export const BATTLE_EARLY_WAVE_THRESHOLD = 3;

/** Streak bonus per streak (10% = 0.10) */
export const BATTLE_STREAK_BONUS_PER_STREAK = 0.10;

/** Maximum streak bonus (100% = 1.0) */
export const BATTLE_MAX_STREAK_BONUS = 1.0;

/** Streak milestones for guaranteed drops */
export const BATTLE_STREAK_DROP_INTERVAL = 5;

/** Streak thresholds for drop rarities */
export const BATTLE_STREAK_RARITY_THRESHOLDS = {
  legendary: 15,
  epic: 10,
  rare: 0,
} as const;

/** Base drop chance after battle win */
export const BATTLE_BASE_DROP_CHANCE = 0.20;

/** Drop chance increase per wave */
export const BATTLE_DROP_CHANCE_PER_WAVE = 0.02;

/** Maximum drop chance */
export const BATTLE_MAX_DROP_CHANCE = 0.50;

/** Wave thresholds for drop rarities */
export const BATTLE_DROP_RARITY_THRESHOLDS = {
  legendary: { minWave: 10, chance: 0.10 },
  epic: { minWave: 5, chance: 0.30 },
} as const;

/** Wave 1 enemy power (easier for new players) */
export const BATTLE_WAVE_1_BASE_POWER = 25;

/** Wave 2+ base power */
export const BATTLE_WAVE_2_PLUS_BASE_POWER = 50;

/** Power increase per wave after wave 1 */
export const BATTLE_POWER_PER_WAVE = 20;

/** Enemy power variance (40% for wave 1, 60% for wave 2+) */
export const BATTLE_POWER_VARIANCE_WAVE_1 = 0.4;
export const BATTLE_POWER_VARIANCE_WAVE_2_PLUS = 0.6;

/** Enemy power slot bonus per slot */
export const BATTLE_SLOT_BONUS_WAVE_1 = 3;
export const BATTLE_SLOT_BONUS_WAVE_2_PLUS = 8;

/** Minimum enemy power */
export const BATTLE_MIN_POWER_WAVE_1 = 15;
export const BATTLE_MIN_POWER_WAVE_2_PLUS = 30;

// ============================================
// PETS
// ============================================

/** Pet type selection chance (50% dog, 50% cat) */
export const PET_DOG_CHANCE = 0.5;

/** Maximum equipped pets */
export const MAX_EQUIPPED_PETS = 6;

/** Dog bonus ranges by rarity (coin generation %) */
export const DOG_BONUS_RANGES = {
  common: { min: 5, max: 30 },
  uncommon: { min: 7.5, max: 55 },
  rare: { min: 10, max: 130 },
  epic: { min: 12.5, max: 180 },
  legendary: { min: 15, max: 230 },
} as const;

/** Cat bonus ranges by rarity (legendary drop chance %) */
export const CAT_BONUS_RANGES = {
  common: { min: 5, max: 10 },
  uncommon: { min: 6.25, max: 16.25 },
  rare: { min: 7.5, max: 32.5 },
  epic: { min: 8.75, max: 48.75 },
  legendary: { min: 10, max: 55 },
} as const;

// ============================================
// UI & DISPLAY
// ============================================

/** Maximum drops history length */
export const MAX_DROPS_HISTORY = 1000;

/** Level up notification duration in milliseconds */
export const LEVEL_UP_NOTIFICATION_DURATION_MS = 3000;

/** Critical hit notification duration in milliseconds */
export const CRITICAL_HIT_NOTIFICATION_DURATION_MS = 2000;

/** Recent egg notification duration in milliseconds */
export const RECENT_EGG_NOTIFICATION_DURATION_MS = 2000;

/** Battle drop notification duration in milliseconds */
export const BATTLE_DROP_NOTIFICATION_DURATION_MS = 3000;

/** Chest open animation duration in milliseconds */
export const CHEST_OPEN_ANIMATION_MS = 500;

/** Chest close delay after open in milliseconds */
export const CHEST_CLOSE_DELAY_MS = 2000;

/** Offline earnings display duration in milliseconds */
export const OFFLINE_EARNINGS_DISPLAY_MS = 5000;

// ============================================
// RARITY WEIGHTS
// ============================================

/** Base rarity weights */
export const BASE_RARITY_WEIGHTS = {
  common: 67,
  uncommon: 20,
  rare: 10,
  epic: 2,
  legendary: 1,
} as const;

/** Luck upgrade 1: per level effects */
export const LUCK_1_EFFECTS = {
  uncommon: 0.5,
  common: -0.5,
} as const;

/** Luck upgrade 2: per level effects */
export const LUCK_2_EFFECTS = {
  rare: 2,
  uncommon: 2,
  common: -4,
} as const;

/** Luck upgrade 3: per level effects */
export const LUCK_3_EFFECTS = {
  epic: 3,
  legendary: 1,
  common: -4,
} as const;

// ============================================
// XP & LEVELING
// ============================================

/** XP required per level multiplier */
export const XP_PER_LEVEL_MULTIPLIER = 100;

/** Level up coin rewards */
export const LEVEL_UP_COIN_REWARDS = {
  level1: 2,
  level2: 5,
  perLevelAfter: 5,
} as const;

// ============================================
// AUDIO
// ============================================

/** Sound frequencies by rarity */
export const SOUND_FREQUENCIES = {
  common: 200,
  uncommon: 300,
  rare: 400,
  epic: 500,
  legendary: 600,
} as const;

// ============================================
// NUMBER LIMITS
// ============================================

/** Maximum safe coin value */
export const MAX_SAFE_COINS = Number.MAX_SAFE_INTEGER;
