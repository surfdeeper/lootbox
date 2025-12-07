import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { generateLoot, generateLootWithGuaranteedRarity } from "./generator";
import { LootItem, RARITY_COLORS, Rarity, ItemCategory, GameSave, SELL_PRICES, XP_REWARDS, COIN_REWARDS } from "./types";

// Utils
import { getAudioContext } from "./utils/audio";
import { saveGame, loadGame, calculateOfflineEarnings, createGameSave } from "./utils/save";
import { formatNumber } from "./utils/format";
import { addXp, getLuckUpgradeCost, calculateRarityWeights, getIdleUpgradeCost, LuckUpgrades } from "./utils/calculations";
import { safeAddCoins } from "./utils/coins";

// Game logic
import { getPrestigeCost } from "./game/prestige";
import { generatePetBonus, Pet, EggUpgrades } from "./game/pets";
import { getWeaponPower, isShield, isArmor, generateEnemyPower } from "./game/battle";

// Constants
import {
  REBIRTH_COIN_BONUS_PER_LEVEL,
  PRESTIGE_COIN_BONUS_PER_LEVEL,
  PET_BONUS_DIVISOR,
  BONUS_EVENT_MULTIPLIER,
  BONUS_EVENT_DURATION_MS,
  CRITICAL_HIT_CHANCE,
  CRITICAL_HIT_MULTIPLIER,
  BONUS_EVENT_TRIGGER_CHANCE,
  EGG_DROP_CHANCE,
  AUTO_OPEN_INTERVAL_MS,
  AUTO_OPEN_PROGRESS_UPDATE_MS,
  IDLE_COINS_PER_SECOND_PER_LEVEL,
  IDLE_TICK_INTERVAL_MS,
  LUCK_UPGRADE_BASE_COSTS,
  AUTO_OPEN_COST,
  AUTO_SELL_COST,
  PETS_UNLOCK_COST,
  EGG_UPGRADE_COSTS,
  BOX_RARITY_MODIFIERS,
  REBIRTH_BASE_COST,
  REBIRTH_COST_MULTIPLIER,
  BATTLE_BASE_COINS,
  BATTLE_EARLY_WAVE_BONUS_MULTIPLIER,
  BATTLE_EARLY_WAVE_THRESHOLD,
  BATTLE_STREAK_BONUS_PER_STREAK,
  BATTLE_MAX_STREAK_BONUS,
  BATTLE_STREAK_DROP_INTERVAL,
  BATTLE_STREAK_RARITY_THRESHOLDS,
  BATTLE_BASE_DROP_CHANCE,
  BATTLE_DROP_CHANCE_PER_WAVE,
  BATTLE_MAX_DROP_CHANCE,
  BATTLE_DROP_RARITY_THRESHOLDS,
  MAX_DROPS_HISTORY,
  LEVEL_UP_NOTIFICATION_DURATION_MS,
  CRITICAL_HIT_NOTIFICATION_DURATION_MS,
  RECENT_EGG_NOTIFICATION_DURATION_MS,
  BATTLE_DROP_NOTIFICATION_DURATION_MS,
  CHEST_OPEN_ANIMATION_MS,
  CHEST_CLOSE_DELAY_MS,
  OFFLINE_EARNINGS_DISPLAY_MS,
  SOUND_FREQUENCIES,
} from "./constants/gameBalance";

// Components
import { LootItemCard } from "./components/LootItemCard";
import { Shop } from "./components/Shop";
import { PetsMenu } from "./components/PetsMenu";
import { BattleMenu } from "./components/BattleMenu";
import { DropsHistory } from "./components/DropsHistory";
import { Inventory } from "./components/Inventory";
import { XPBar } from "./components/XPBar";

export default function App() {
  const [loot, setLoot] = useState<LootItem | null>(null);
  const [inventory, setInventory] = useState<LootItem[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [chestState, setChestState] = useState<"closed" | "opening" | "open">("closed");
  const [showInventory, setShowInventory] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [coinGeneratorLevel, setCoinGeneratorLevel] = useState(0);
  const [luckUpgrades, setLuckUpgrades] = useState<LuckUpgrades>({
    luckUpgrade1: 0,
    luckUpgrade2: 0,
    luckUpgrade3: 0,
  });
  const [stats, setStats] = useState({
    totalChestsOpened: 0,
    totalCoinsEarned: 0,
    legendariesFound: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [offlineEarnings, setOfflineEarnings] = useState<number | null>(null);
  const [purchasedBoxes, setPurchasedBoxes] = useState<string[]>([]);
  const [hasAutoOpen, setHasAutoOpen] = useState(false);
  const [hasAutoSell, setHasAutoSell] = useState(false);
  const [autoSellRarities, setAutoSellRarities] = useState<Set<Rarity>>(new Set());
  const [rebirthTokens, setRebirthTokens] = useState(0);
  const [rebirthCount, setRebirthCount] = useState(0);
  const [prestigeCount, setPrestigeCount] = useState(0);
  const [currentArea, setCurrentArea] = useState(1);
  // Galaxy state
  const [galaxyRebirthTokens, setGalaxyRebirthTokens] = useState(0);
  const [galaxyRebirthCount, setGalaxyRebirthCount] = useState(0);
  const [galaxyPrestigeCount, setGalaxyPrestigeCount] = useState(0);
  const [galaxyEggs, setGalaxyEggs] = useState<{ rarity: Rarity; id: string }[]>([]);
  const [galaxyPets, setGalaxyPets] = useState<Pet[]>([]);
  const [galaxyEquippedPets, setGalaxyEquippedPets] = useState<string[]>([]);
  // Galaxy versions of shared state (area 2 has independent progress)
  const [galaxyCoins, setGalaxyCoins] = useState(0);
  const [galaxyXp, setGalaxyXp] = useState(0);
  const [galaxyLevel, setGalaxyLevel] = useState(1);
  const [galaxyInventory, setGalaxyInventory] = useState<LootItem[]>([]);
  const [galaxyCoinGeneratorLevel, setGalaxyCoinGeneratorLevel] = useState(0);
  const [galaxyLuckUpgrades, setGalaxyLuckUpgrades] = useState<LuckUpgrades>({
    luckUpgrade1: 0,
    luckUpgrade2: 0,
    luckUpgrade3: 0,
  });
  const [galaxyHasAutoOpen, setGalaxyHasAutoOpen] = useState(false);
  const [galaxyHasAutoSell, setGalaxyHasAutoSell] = useState(false);
  const [galaxyAutoSellRarities, setGalaxyAutoSellRarities] = useState<Set<Rarity>>(new Set());
  const [galaxyPurchasedBoxes, setGalaxyPurchasedBoxes] = useState<string[]>([]);
  const [galaxyDropsHistory, setGalaxyDropsHistory] = useState<LootItem[]>([]);
  const [galaxyEggUpgrades, setGalaxyEggUpgrades] = useState<EggUpgrades>({
    common: false,
    uncommon: false,
    rare: false,
    epic: false,
    legendary: false,
  });
  const [galaxyBattleWave, setGalaxyBattleWave] = useState(1);
  const [galaxyBattleSlots, setGalaxyBattleSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const galaxyBattleWaveRef = useRef(1);
  const [hasPets, setHasPets] = useState(false);
  const [showPets, setShowPets] = useState(false);
  const [eggUpgrades, setEggUpgrades] = useState<EggUpgrades>({
    common: false,
    uncommon: false,
    rare: false,
    epic: false,
    legendary: false,
  });
  const [eggs, setEggs] = useState<{ rarity: Rarity; id: string }[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [equippedPets, setEquippedPets] = useState<string[]>([]);
  const [recentEgg, setRecentEgg] = useState<Rarity | null>(null);
  const [levelUpNotification, setLevelUpNotification] = useState<number | null>(null);
  const [dropsHistory, setDropsHistory] = useState<LootItem[]>([]);
  const [showDropsHistory, setShowDropsHistory] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [usedCheatCode, setUsedCheatCode] = useState(false);
  const [autoOpenProgress, setAutoOpenProgress] = useState(0);
  const [showBattle, setShowBattle] = useState(false);
  const [battleWave, setBattleWave] = useState(1);
  const [battleSlots, setBattleSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [battleStreak, setBattleStreak] = useState(0);
  const battleStreakRef = useRef(0);
  const battleWaveRef = useRef(1);
  const [lastBattleDrop, setLastBattleDrop] = useState<LootItem | null>(null);
  const [criticalHit, setCriticalHit] = useState(false);
  const [bonusEventActive, setBonusEventActive] = useState(false);
  const [bonusEventEndTime, setBonusEventEndTime] = useState<number | null>(null);
  const [dailyChallenges, setDailyChallenges] = useState<{
    id: string;
    description: string;
    target: number;
    progress: number;
    reward: number;
    completed: boolean;
  }[]>([]);
  const [lastChallengeReset, setLastChallengeReset] = useState<number>(0);
  const [showChallenges, setShowChallenges] = useState(false);
  const initialLoadRef = useRef(false);
  const loadedLevelRef = useRef<number | null>(null);
  const saveEnabledRef = useRef(false);

  // Load game on mount
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const save = loadGame();
    if (save) {
      loadedLevelRef.current = save.player.level;
      setLevel(save.player.level);
      setXp(save.player.xp);
      setCoins(save.player.coins);
      setInventory(save.inventory);
      setCoinGeneratorLevel(save.upgrades.coinGeneratorLevel);
      setLuckUpgrades({
        luckUpgrade1: save.upgrades.luckUpgrade1 || 0,
        luckUpgrade2: save.upgrades.luckUpgrade2 || 0,
        luckUpgrade3: save.upgrades.luckUpgrade3 || 0,
      });
      setStats(save.stats);
      setPurchasedBoxes(save.purchasedBoxes || []);
      setHasAutoOpen(save.upgrades.hasAutoOpen || false);
      setHasAutoSell(save.upgrades.hasAutoSell || false);
      setAutoSellRarities(new Set((save.upgrades.autoSellRarities || []) as Rarity[]));
      setHasPets(save.upgrades.hasPets || false);
      setEggUpgrades(save.upgrades.eggUpgrades || {
        common: false,
        uncommon: false,
        rare: false,
        epic: false,
        legendary: false,
      });
      setEggs((save.eggs || []).map(e => ({ ...e, rarity: e.rarity as Rarity })));
      setPets((save.pets || []).map(p => {
        const rarity = p.rarity as Rarity;
        const type = p.type as "dog" | "cat";
        const bonus = (p as { bonus?: number }).bonus ?? generatePetBonus(type, rarity);
        const count = (p as { count?: number }).count ?? 1;
        return { id: p.id, name: p.name, rarity, type, bonus, count };
      }));
      const loadedEquippedPets = save.equippedPets || [];
      setEquippedPets(loadedEquippedPets);
      setDropsHistory((save.dropsHistory || []).map(d => ({ ...d, rarity: d.rarity as Rarity, category: d.category as ItemCategory })));
      const loadedRebirthCount = save.rebirth?.count || 0;
      const loadedPrestigeCount = save.prestige?.count || 0;
      setRebirthTokens(save.rebirth?.tokens || 0);
      setRebirthCount(loadedRebirthCount);
      setPrestigeCount(loadedPrestigeCount);
      setCurrentArea(save.area || 1);
      // Load galaxy state
      setGalaxyRebirthTokens(save.galaxyRebirth?.tokens || 0);
      setGalaxyRebirthCount(save.galaxyRebirth?.count || 0);
      setGalaxyPrestigeCount(save.galaxyPrestige?.count || 0);
      setGalaxyEggs((save.galaxyEggs || []).map(e => ({ ...e, rarity: e.rarity as Rarity })));
      setGalaxyPets((save.galaxyPets || []).map(p => {
        const rarity = p.rarity as Rarity;
        const type = p.type as "dog" | "cat";
        const bonus = (p as { bonus?: number }).bonus ?? generatePetBonus(type, rarity);
        const count = (p as { count?: number }).count ?? 1;
        return { id: p.id, name: p.name, rarity, type, bonus, count };
      }));
      setGalaxyEquippedPets(save.galaxyEquippedPets || []);
      // Load galaxy area-specific state
      const gs = save.galaxyState;
      setGalaxyCoins(gs?.coins ?? 0);
      setGalaxyXp(gs?.xp ?? 0);
      setGalaxyLevel(gs?.level ?? 1);
      setGalaxyInventory((gs?.inventory || []).map(i => ({ ...i, rarity: i.rarity as Rarity, category: i.category as ItemCategory })));
      setGalaxyCoinGeneratorLevel(gs?.coinGeneratorLevel ?? 0);
      setGalaxyLuckUpgrades(gs?.luckUpgrades ?? { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
      setGalaxyHasAutoOpen(gs?.hasAutoOpen ?? false);
      setGalaxyHasAutoSell(gs?.hasAutoSell ?? false);
      setGalaxyAutoSellRarities(new Set((gs?.autoSellRarities || []) as Rarity[]));
      setGalaxyPurchasedBoxes(gs?.purchasedBoxes ?? []);
      setGalaxyDropsHistory((gs?.dropsHistory || []).map(d => ({ ...d, rarity: d.rarity as Rarity, category: d.category as ItemCategory })));
      setGalaxyEggUpgrades(gs?.eggUpgrades ?? { common: false, uncommon: false, rare: false, epic: false, legendary: false });
      const loadedGalaxyWave = gs?.battleWave ?? 1;
      setGalaxyBattleWave(loadedGalaxyWave);
      galaxyBattleWaveRef.current = loadedGalaxyWave;
      setGalaxyBattleSlots(gs?.battleSlots ?? [null, null, null, null, null]);

      const loadedWave = save.battle?.wave || 1;
      setBattleWave(loadedWave);
      battleWaveRef.current = loadedWave;
      setBattleSlots(save.battle?.slots || [null, null, null, null, null]);

      // Calculate dog bonus for offline earnings (only equipped dogs)
      const loadedPets = (save.pets || []).map(p => {
        const rarity = p.rarity as Rarity;
        const type = p.type as "dog" | "cat";
        const bonus = (p as { bonus?: number }).bonus ?? generatePetBonus(type, rarity);
        return { id: p.id, type, bonus };
      });
      const loadedDogBonus = loadedPets
        .filter(pet => pet.type === "dog" && loadedEquippedPets.includes(pet.id))
        .reduce((sum, pet) => sum + (pet.bonus || 0), 0);

      // FIX: Pass multipliers to offline earnings calculation
      const earnings = calculateOfflineEarnings(save.lastSaved, save.upgrades.coinGeneratorLevel, {
        rebirthCount: loadedRebirthCount,
        prestigeCount: loadedPrestigeCount,
        totalDogBonus: loadedDogBonus,
      });
      if (earnings > 0.01) {
        setOfflineEarnings(earnings);
        setCoins((prev) => safeAddCoins(prev, earnings));
        setTimeout(() => {
          setOfflineEarnings(null);
        }, OFFLINE_EARNINGS_DISPLAY_MS);
      }
    } else {
      loadedLevelRef.current = 1;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        saveEnabledRef.current = true;
        setIsLoaded(true);
      });
    });
  }, []);

  // Auto-save when state changes
  useEffect(() => {
    if (!saveEnabledRef.current) return;
    if (!isLoaded) return;
    if (usedCheatCode) return;

    const save = createGameSave({
      level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades,
      hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, eggUpgrades,
      rebirthTokens, rebirthCount, prestigeCount, currentArea,
      eggs, pets, equippedPets, dropsHistory, stats, purchasedBoxes,
      battleWave, battleSlots,
      galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount,
      galaxyEggs, galaxyPets, galaxyEquippedPets,
      // Galaxy area-specific state
      galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory,
      galaxyCoinGeneratorLevel, galaxyLuckUpgrades,
      galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities,
      galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades,
      galaxyBattleWave, galaxyBattleSlots,
    });
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, isLoaded, purchasedBoxes, usedCheatCode, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots, galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount, galaxyEggs, galaxyPets, galaxyEquippedPets, galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory, galaxyCoinGeneratorLevel, galaxyLuckUpgrades, galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities, galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades, galaxyBattleWave, galaxyBattleSlots]);

  // Show level-up notification
  const prevLevelRef = useRef<number>(level);
  useEffect(() => {
    if (!isLoaded) return;
    if (level > prevLevelRef.current && level > (loadedLevelRef.current || 1)) {
      setLevelUpNotification(level);
      setTimeout(() => setLevelUpNotification(null), LEVEL_UP_NOTIFICATION_DURATION_MS);
    }
    prevLevelRef.current = level;
  }, [level, isLoaded]);

  // Calculate total dog bonus for coin generation (only equipped pets)
  // Normal pets do nothing in area 2
  const totalDogBonus = useMemo(() => {
    if (currentArea === 2) return 0;
    return pets
      .filter(pet => pet.type === "dog" && equippedPets.includes(pet.id))
      .reduce((sum, pet) => sum + (pet.bonus || 0), 0);
  }, [pets, equippedPets, currentArea]);

  // Calculate galaxy dog bonus (only active in area 2)
  const totalGalaxyDogBonus = useMemo(() => {
    if (currentArea !== 2) return 0;
    return galaxyPets
      .filter(pet => pet.type === "dog" && galaxyEquippedPets.includes(pet.id))
      .reduce((sum, pet) => sum + (pet.bonus || 0), 0);
  }, [galaxyPets, galaxyEquippedPets, currentArea]);

  // Calculate coin multiplier
  const coinMultiplier = useMemo(() => {
    const bonusEventMult = bonusEventActive ? BONUS_EVENT_MULTIPLIER : 0;
    if (currentArea === 2) {
      // In area 2, use galaxy bonuses
      const galaxyRebirthBonus = galaxyRebirthCount * REBIRTH_COIN_BONUS_PER_LEVEL;
      const galaxyPrestigeBonus = galaxyPrestigeCount * PRESTIGE_COIN_BONUS_PER_LEVEL;
      const galaxyDogBonus = totalGalaxyDogBonus / PET_BONUS_DIVISOR;
      return 1 + galaxyRebirthBonus + galaxyPrestigeBonus + galaxyDogBonus + bonusEventMult;
    }
    // In area 1, use normal bonuses
    const rebirthBonus = rebirthCount * REBIRTH_COIN_BONUS_PER_LEVEL;
    const prestigeBonus = prestigeCount * PRESTIGE_COIN_BONUS_PER_LEVEL;
    const dogBonus = totalDogBonus / PET_BONUS_DIVISOR;
    return 1 + rebirthBonus + prestigeBonus + dogBonus + bonusEventMult;
  }, [rebirthCount, prestigeCount, totalDogBonus, bonusEventActive, currentArea, galaxyRebirthCount, galaxyPrestigeCount, totalGalaxyDogBonus]);

  // Effective state values based on current area
  const effectiveCoins = currentArea === 2 ? galaxyCoins : coins;
  const effectiveXp = currentArea === 2 ? galaxyXp : xp;
  const effectiveLevel = currentArea === 2 ? galaxyLevel : level;
  const effectiveInventory = currentArea === 2 ? galaxyInventory : inventory;
  const effectiveCoinGeneratorLevel = currentArea === 2 ? galaxyCoinGeneratorLevel : coinGeneratorLevel;
  const effectiveLuckUpgrades = currentArea === 2 ? galaxyLuckUpgrades : luckUpgrades;
  const effectiveHasAutoOpen = currentArea === 2 ? galaxyHasAutoOpen : hasAutoOpen;
  const effectiveHasAutoSell = currentArea === 2 ? galaxyHasAutoSell : hasAutoSell;
  const effectiveAutoSellRarities = currentArea === 2 ? galaxyAutoSellRarities : autoSellRarities;
  const effectivePurchasedBoxes = currentArea === 2 ? galaxyPurchasedBoxes : purchasedBoxes;
  const effectiveDropsHistory = currentArea === 2 ? galaxyDropsHistory : dropsHistory;
  const effectiveEggUpgrades = currentArea === 2 ? galaxyEggUpgrades : eggUpgrades;
  const effectiveBattleWave = currentArea === 2 ? galaxyBattleWave : battleWave;
  const effectiveBattleSlots = currentArea === 2 ? galaxyBattleSlots : battleSlots;
  const effectiveBattleWaveRef = currentArea === 2 ? galaxyBattleWaveRef : battleWaveRef;

  // Setters for effective state (automatically route to correct area)
  const setEffectiveCoins: React.Dispatch<React.SetStateAction<number>> = currentArea === 2 ? setGalaxyCoins : setCoins;
  const setEffectiveXp: React.Dispatch<React.SetStateAction<number>> = currentArea === 2 ? setGalaxyXp : setXp;
  const setEffectiveLevel: React.Dispatch<React.SetStateAction<number>> = currentArea === 2 ? setGalaxyLevel : setLevel;
  const setEffectiveInventory: React.Dispatch<React.SetStateAction<LootItem[]>> = currentArea === 2 ? setGalaxyInventory : setInventory;
  const setEffectiveCoinGeneratorLevel: React.Dispatch<React.SetStateAction<number>> = currentArea === 2 ? setGalaxyCoinGeneratorLevel : setCoinGeneratorLevel;
  const setEffectiveLuckUpgrades: React.Dispatch<React.SetStateAction<LuckUpgrades>> = currentArea === 2 ? setGalaxyLuckUpgrades : setLuckUpgrades;
  const setEffectiveHasAutoOpen: React.Dispatch<React.SetStateAction<boolean>> = currentArea === 2 ? setGalaxyHasAutoOpen : setHasAutoOpen;
  const setEffectiveHasAutoSell: React.Dispatch<React.SetStateAction<boolean>> = currentArea === 2 ? setGalaxyHasAutoSell : setHasAutoSell;
  const setEffectiveAutoSellRarities: React.Dispatch<React.SetStateAction<Set<Rarity>>> = currentArea === 2 ? setGalaxyAutoSellRarities : setAutoSellRarities;
  const setEffectivePurchasedBoxes: React.Dispatch<React.SetStateAction<string[]>> = currentArea === 2 ? setGalaxyPurchasedBoxes : setPurchasedBoxes;
  const setEffectiveDropsHistory: React.Dispatch<React.SetStateAction<LootItem[]>> = currentArea === 2 ? setGalaxyDropsHistory : setDropsHistory;
  const setEffectiveEggUpgrades: React.Dispatch<React.SetStateAction<EggUpgrades>> = currentArea === 2 ? setGalaxyEggUpgrades : setEggUpgrades;
  const setEffectiveBattleWave: React.Dispatch<React.SetStateAction<number>> = currentArea === 2 ? setGalaxyBattleWave : setBattleWave;
  const setEffectiveBattleSlots: React.Dispatch<React.SetStateAction<(string | null)[]>> = currentArea === 2 ? setGalaxyBattleSlots : setBattleSlots;

  // Generate daily challenges - rewards scale with coin count
  const generateDailyChallenges = useCallback((currentCoins: number) => {
    // Scale factor based on coins - rewards are approximately 1-5% of current coins
    const baseRewardPercent = 0.02; // 2% of current coins as base
    const minReward = 100;
    const scaledReward = Math.max(minReward, Math.floor(currentCoins * baseRewardPercent));
    const challengeTemplates = [
      { id: 'open_chests', description: 'Open 50 chests', target: 50, reward: Math.floor(scaledReward * 1.0) },
      { id: 'sell_items', description: 'Sell 20 items', target: 20, reward: Math.floor(scaledReward * 0.5) },
      { id: 'win_battles', description: 'Win 5 battles', target: 5, reward: Math.floor(scaledReward * 1.5) },
      { id: 'find_rares', description: 'Find 10 rare+ items', target: 10, reward: Math.floor(scaledReward * 0.75) },
      { id: 'earn_coins', description: 'Earn 500 coins', target: 500, reward: Math.floor(scaledReward * 2.0) },
    ];
    const shuffled = [...challengeTemplates].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    return selected.map(c => ({ ...c, progress: 0, completed: false }));
  }, []);

  // Check and reset daily challenges
  useEffect(() => {
    const now = Date.now();
    const today = new Date(now).toDateString();
    const lastReset = new Date(lastChallengeReset).toDateString();

    if (today !== lastReset && isLoaded) {
      setDailyChallenges(generateDailyChallenges(coins));
      setLastChallengeReset(now);
    }
  }, [isLoaded, lastChallengeReset, generateDailyChallenges, coins]);

  // Bonus event timer
  useEffect(() => {
    if (!bonusEventEndTime) return;

    const checkEvent = setInterval(() => {
      if (Date.now() >= bonusEventEndTime) {
        setBonusEventActive(false);
        setBonusEventEndTime(null);
      }
    }, 1000);

    return () => clearInterval(checkEvent);
  }, [bonusEventEndTime]);

  // Start bonus event
  const startBonusEvent = useCallback(() => {
    if (bonusEventActive) return;
    setBonusEventActive(true);
    setBonusEventEndTime(Date.now() + BONUS_EVENT_DURATION_MS);
  }, [bonusEventActive]);

  // Update challenge progress
  const updateChallengeProgress = useCallback((challengeId: string, amount: number = 1) => {
    setDailyChallenges(prev => prev.map(c => {
      if (c.id !== challengeId || c.completed) return c;
      const newProgress = c.progress + amount;
      const completed = newProgress >= c.target;
      if (completed && !c.completed) {
        setCoins(coins => coins + c.reward);
      }
      return { ...c, progress: Math.min(newProgress, c.target), completed };
    }));
  }, []);

  // Idle coin generation
  useEffect(() => {
    if (effectiveCoinGeneratorLevel <= 0) return;

    const interval = setInterval(() => {
      const baseCoinsPerSecond = effectiveCoinGeneratorLevel * IDLE_COINS_PER_SECOND_PER_LEVEL;
      const coinsPerSecond = baseCoinsPerSecond * coinMultiplier;
      setEffectiveCoins((prev) => safeAddCoins(prev, coinsPerSecond / (1000 / IDLE_TICK_INTERVAL_MS)));
    }, IDLE_TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [effectiveCoinGeneratorLevel, coinMultiplier, setEffectiveCoins]);

  // Auto-open chests
  useEffect(() => {
    if (!effectiveHasAutoOpen || !isLoaded) return;

    let elapsed = 0;

    const progressInterval = setInterval(() => {
      if (!isOpening && !showInventory && !showShop && !showPets && !showDropsHistory && !showBattle) {
        elapsed += AUTO_OPEN_PROGRESS_UPDATE_MS;
        const progress = (elapsed / AUTO_OPEN_INTERVAL_MS) * 100;
        setAutoOpenProgress(Math.min(progress, 100));

        if (elapsed >= AUTO_OPEN_INTERVAL_MS) {
          openChest();
          elapsed = 0;
          setAutoOpenProgress(0);
        }
      }
    }, AUTO_OPEN_PROGRESS_UPDATE_MS);

    return () => {
      clearInterval(progressInterval);
      setAutoOpenProgress(0);
    };
  }, [effectiveHasAutoOpen, isLoaded, isOpening, showInventory, showShop, showPets, showDropsHistory, showBattle]);

  // Calculate total cat bonus for legendary drop chance (only equipped pets)
  const totalCatBonus = useMemo(() => {
    return pets
      .filter(pet => pet.type === "cat" && equippedPets.includes(pet.id))
      .reduce((sum, pet) => sum + (pet.bonus || 0), 0);
  }, [pets, equippedPets]);

  const getBoxRarityWeights = useCallback((): Record<Rarity, number> => {
    const baseWeights = calculateRarityWeights(effectiveLuckUpgrades);
    let weights = { ...baseWeights };

    if (effectivePurchasedBoxes.includes('gold')) {
      const mods = BOX_RARITY_MODIFIERS.gold;
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] + mods.common),
        [Rarity.Epic]: weights[Rarity.Epic] + mods.epic,
        [Rarity.Legendary]: weights[Rarity.Legendary] + mods.legendary,
      };
    } else if (effectivePurchasedBoxes.includes('silver')) {
      const mods = BOX_RARITY_MODIFIERS.silver;
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] + mods.common),
        [Rarity.Uncommon]: weights[Rarity.Uncommon] + mods.uncommon,
        [Rarity.Rare]: weights[Rarity.Rare] + mods.rare,
      };
    } else if (effectivePurchasedBoxes.includes('bronze')) {
      const mods = BOX_RARITY_MODIFIERS.bronze;
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] + mods.common),
        [Rarity.Uncommon]: weights[Rarity.Uncommon] + mods.uncommon,
      };
    }

    if (totalCatBonus > 0) {
      const legendaryBoost = totalCatBonus / PET_BONUS_DIVISOR * weights[Rarity.Legendary];
      weights = {
        ...weights,
        [Rarity.Legendary]: weights[Rarity.Legendary] + legendaryBoost,
      };
    }

    return weights;
  }, [effectiveLuckUpgrades, effectivePurchasedBoxes, totalCatBonus]);

  const openChest = (isManual: boolean = false) => {
    if (isOpening) return;

    setIsOpening(true);
    setChestState("opening");
    setLoot(null);

    setTimeout(() => {
      setChestState("open");

      const isCritical = isManual && Math.random() < CRITICAL_HIT_CHANCE;
      if (isCritical) {
        setCriticalHit(true);
        setTimeout(() => setCriticalHit(false), CRITICAL_HIT_NOTIFICATION_DURATION_MS);
        if (Math.random() < BONUS_EVENT_TRIGGER_CHANCE && !bonusEventActive) {
          startBonusEvent();
        }
      }

      const customWeights = getBoxRarityWeights();
      const newLoot = generateLoot(undefined, customWeights);
      setLoot(newLoot);

      const shouldAutoSell = effectiveHasAutoSell && effectiveAutoSellRarities.has(newLoot.rarity);

      if (!shouldAutoSell) {
        setEffectiveInventory((prev) => [...prev, newLoot]);
      }

      setEffectiveDropsHistory(prev => [newLoot, ...prev].slice(0, MAX_DROPS_HISTORY));

      playChestOpenSound(newLoot.rarity);

      const xpMultiplier = isCritical ? CRITICAL_HIT_MULTIPLIER : 1;
      const { xp: newXp, level: newLevel, coinReward: levelUpCoins } = addXp(effectiveXp, effectiveLevel, XP_REWARDS[newLoot.rarity] * xpMultiplier);
      setEffectiveXp(newXp);
      setEffectiveLevel(newLevel);

      const autoSellBonus = shouldAutoSell ? SELL_PRICES[newLoot.rarity] : 0;
      const baseCoins = COIN_REWARDS[newLoot.rarity] + levelUpCoins + autoSellBonus;
      const criticalMultiplier = isCritical ? CRITICAL_HIT_MULTIPLIER : 1;
      const earnedCoins = baseCoins * coinMultiplier * criticalMultiplier;
      setEffectiveCoins((prev) => safeAddCoins(prev, earnedCoins));

      setStats((prev) => ({
        totalChestsOpened: prev.totalChestsOpened + 1,
        totalCoinsEarned: prev.totalCoinsEarned + earnedCoins,
        legendariesFound: prev.legendariesFound + (newLoot.rarity === Rarity.Legendary ? 1 : 0),
      }));

      updateChallengeProgress('open_chests', 1);
      updateChallengeProgress('earn_coins', earnedCoins);
      if ([Rarity.Rare, Rarity.Epic, Rarity.Legendary].includes(newLoot.rarity)) {
        updateChallengeProgress('find_rares', 1);
      }
      if (shouldAutoSell) {
        updateChallengeProgress('sell_items', 1);
      }

      const rarityToCheck: (keyof EggUpgrades)[] = ["common", "uncommon", "rare", "epic", "legendary"];
      for (const rarity of rarityToCheck) {
        if (effectiveEggUpgrades[rarity] && Math.random() < EGG_DROP_CHANCE) {
          const newEgg = { rarity: rarity as Rarity, id: crypto.randomUUID() };
          // In area 2, eggs go to galaxy eggs
          if (currentArea === 2) {
            setGalaxyEggs((prev) => [...prev, newEgg]);
          } else {
            setEggs((prev) => [...prev, newEgg]);
          }
          setRecentEgg(rarity as Rarity);
          setTimeout(() => setRecentEgg(null), RECENT_EGG_NOTIFICATION_DURATION_MS);
          break;
        }
      }

      setTimeout(() => {
        setChestState("closed");
        setIsOpening(false);
      }, CHEST_CLOSE_DELAY_MS);
    }, CHEST_OPEN_ANIMATION_MS);
  };

  // Spacebar to open chest
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !showInventory && !showShop && !showSettings && !showBattle) {
        e.preventDefault();
        openChest(true);
      }
      if (e.code === "Escape") {
        if (showInventory) setShowInventory(false);
        if (showShop) setShowShop(false);
        if (showSettings) setShowSettings(false);
        if (showBattle) setShowBattle(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpening, showInventory, showShop, showSettings, showBattle]);

  const handleSellItem = useCallback((itemId: string) => {
    const item = effectiveInventory.find(i => i.id === itemId);
    if (!item) return;

    const sellValue = SELL_PRICES[item.rarity] * coinMultiplier;
    setEffectiveCoins(prev => prev + sellValue);
    setEffectiveInventory(prev => prev.filter(i => i.id !== itemId));
    updateChallengeProgress('sell_items', 1);
    updateChallengeProgress('earn_coins', sellValue);
  }, [effectiveInventory, coinMultiplier, updateChallengeProgress, setEffectiveCoins, setEffectiveInventory]);

  const handleBulkSell = useCallback((itemIds: string[]) => {
    const itemsToSell = effectiveInventory.filter(i => itemIds.includes(i.id));
    const baseValue = itemsToSell.reduce((total, item) => total + SELL_PRICES[item.rarity], 0);
    const totalValue = baseValue * coinMultiplier;

    setEffectiveCoins(prev => prev + totalValue);
    setEffectiveInventory(prev => prev.filter(i => !itemIds.includes(i.id)));
    updateChallengeProgress('sell_items', itemsToSell.length);
    updateChallengeProgress('earn_coins', totalValue);

    return totalValue;
  }, [effectiveInventory, coinMultiplier, updateChallengeProgress, setEffectiveCoins, setEffectiveInventory]);

  const handleMergeItems = useCallback((itemIds: string[]): LootItem | null => {
    if (itemIds.length !== 3) return null;

    const itemsToMerge = effectiveInventory.filter(i => itemIds.includes(i.id));
    if (itemsToMerge.length !== 3) return null;

    const rarity = itemsToMerge[0].rarity;
    if (!itemsToMerge.every(i => i.rarity === rarity)) return null;

    if (rarity === Rarity.Legendary) return null;

    const rarityOrder = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];
    const currentIndex = rarityOrder.indexOf(rarity);
    const nextRarity = rarityOrder[currentIndex + 1];

    const newItem = generateLootWithGuaranteedRarity(nextRarity);
    if (!newItem) return null;

    setEffectiveInventory(prev => [...prev.filter(i => !itemIds.includes(i.id)), newItem]);
    setEffectiveDropsHistory(prev => [newItem, ...prev].slice(0, 1000));

    return newItem;
  }, [effectiveInventory, setEffectiveInventory, setEffectiveDropsHistory]);

  const playChestOpenSound = (rarity: Rarity) => {
    const frequencies: Record<Rarity, number> = {
      [Rarity.Common]: SOUND_FREQUENCIES.common,
      [Rarity.Uncommon]: SOUND_FREQUENCIES.uncommon,
      [Rarity.Rare]: SOUND_FREQUENCIES.rare,
      [Rarity.Epic]: SOUND_FREQUENCIES.epic,
      [Rarity.Legendary]: SOUND_FREQUENCIES.legendary,
    };

    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequencies[rarity];
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    if (rarity === Rarity.Epic || rarity === Rarity.Legendary) {
      setTimeout(() => {
        const ctx2 = getAudioContext();
        if (!ctx2) return;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = frequencies[rarity] * 2;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.2, ctx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.3);
        osc2.start(ctx2.currentTime);
        osc2.stop(ctx2.currentTime + 0.3);
      }, 100);
    }
  };

  const manualSave = useCallback(() => {
    const save = createGameSave({
      level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades,
      hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, eggUpgrades,
      rebirthTokens, rebirthCount, prestigeCount, currentArea,
      eggs, pets, equippedPets, dropsHistory, stats, purchasedBoxes,
      battleWave, battleSlots,
      galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount,
      galaxyEggs, galaxyPets, galaxyEquippedPets,
      galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory,
      galaxyCoinGeneratorLevel, galaxyLuckUpgrades,
      galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities,
      galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades,
      galaxyBattleWave, galaxyBattleSlots,
    });
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, purchasedBoxes, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots, galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount, galaxyEggs, galaxyPets, galaxyEquippedPets, galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory, galaxyCoinGeneratorLevel, galaxyLuckUpgrades, galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities, galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades, galaxyBattleWave, galaxyBattleSlots]);

  const exportSave = useCallback(() => {
    const save = createGameSave({
      level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades,
      hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, eggUpgrades,
      rebirthTokens, rebirthCount, prestigeCount, currentArea,
      eggs, pets, equippedPets, dropsHistory, stats, purchasedBoxes,
      battleWave, battleSlots,
      galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount,
      galaxyEggs, galaxyPets, galaxyEquippedPets,
      galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory,
      galaxyCoinGeneratorLevel, galaxyLuckUpgrades,
      galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities,
      galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades,
      galaxyBattleWave, galaxyBattleSlots,
    });
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lootbox-save-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, purchasedBoxes, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots, galaxyRebirthTokens, galaxyRebirthCount, galaxyPrestigeCount, galaxyEggs, galaxyPets, galaxyEquippedPets, galaxyCoins, galaxyXp, galaxyLevel, galaxyInventory, galaxyCoinGeneratorLevel, galaxyLuckUpgrades, galaxyHasAutoOpen, galaxyHasAutoSell, galaxyAutoSellRarities, galaxyPurchasedBoxes, galaxyDropsHistory, galaxyEggUpgrades, galaxyBattleWave, galaxyBattleSlots]);

  const importSave = useCallback((data: string): boolean => {
    try {
      const save = JSON.parse(data) as GameSave;
      if (!save.version || !save.player) {
        return false;
      }

      setLevel(save.player.level);
      setXp(save.player.xp);
      setCoins(save.player.coins);
      setInventory(save.inventory || []);
      setCoinGeneratorLevel(save.upgrades?.coinGeneratorLevel || 0);
      setLuckUpgrades({
        luckUpgrade1: save.upgrades?.luckUpgrade1 || 0,
        luckUpgrade2: save.upgrades?.luckUpgrade2 || 0,
        luckUpgrade3: save.upgrades?.luckUpgrade3 || 0,
      });
      setStats(save.stats || { totalChestsOpened: 0, totalCoinsEarned: 0, legendariesFound: 0 });
      setPurchasedBoxes(save.purchasedBoxes || []);
      setHasAutoOpen(save.upgrades?.hasAutoOpen || false);
      setHasAutoSell(save.upgrades?.hasAutoSell || false);
      setAutoSellRarities(new Set((save.upgrades?.autoSellRarities || []) as Rarity[]));
      setHasPets(save.upgrades?.hasPets || false);
      setEggUpgrades(save.upgrades?.eggUpgrades || { common: false, uncommon: false, rare: false, epic: false, legendary: false });
      setEggs((save.eggs || []).map(e => ({ ...e, rarity: e.rarity as Rarity })));
      setPets((save.pets || []).map(p => {
        const rarity = p.rarity as Rarity;
        const type = p.type as "dog" | "cat";
        const bonus = (p as { bonus?: number }).bonus ?? generatePetBonus(type, rarity);
        const count = (p as { count?: number }).count ?? 1;
        return { id: p.id, name: p.name, rarity, type, bonus, count };
      }));
      setEquippedPets(save.equippedPets || []);
      setDropsHistory((save.dropsHistory || []).map(d => ({ ...d, rarity: d.rarity as Rarity, category: d.category as ItemCategory })));
      setRebirthTokens(save.rebirth?.tokens || 0);
      setRebirthCount(save.rebirth?.count || 0);
      setPrestigeCount(save.prestige?.count || 0);
      setCurrentArea(save.area || 1);
      // Import galaxy state
      setGalaxyRebirthTokens(save.galaxyRebirth?.tokens || 0);
      setGalaxyRebirthCount(save.galaxyRebirth?.count || 0);
      setGalaxyPrestigeCount(save.galaxyPrestige?.count || 0);
      setGalaxyEggs((save.galaxyEggs || []).map(e => ({ ...e, rarity: e.rarity as Rarity })));
      setGalaxyPets((save.galaxyPets || []).map(p => {
        const rarity = p.rarity as Rarity;
        const type = p.type as "dog" | "cat";
        const bonus = (p as { bonus?: number }).bonus ?? generatePetBonus(type, rarity);
        const count = (p as { count?: number }).count ?? 1;
        return { id: p.id, name: p.name, rarity, type, bonus, count };
      }));
      setGalaxyEquippedPets(save.galaxyEquippedPets || []);
      // Import galaxy area-specific state
      const gs = save.galaxyState;
      setGalaxyCoins(gs?.coins ?? 0);
      setGalaxyXp(gs?.xp ?? 0);
      setGalaxyLevel(gs?.level ?? 1);
      setGalaxyInventory((gs?.inventory || []).map(i => ({ ...i, rarity: i.rarity as Rarity, category: i.category as ItemCategory })));
      setGalaxyCoinGeneratorLevel(gs?.coinGeneratorLevel ?? 0);
      setGalaxyLuckUpgrades(gs?.luckUpgrades ?? { luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
      setGalaxyHasAutoOpen(gs?.hasAutoOpen ?? false);
      setGalaxyHasAutoSell(gs?.hasAutoSell ?? false);
      setGalaxyAutoSellRarities(new Set((gs?.autoSellRarities || []) as Rarity[]));
      setGalaxyPurchasedBoxes(gs?.purchasedBoxes ?? []);
      setGalaxyDropsHistory((gs?.dropsHistory || []).map(d => ({ ...d, rarity: d.rarity as Rarity, category: d.category as ItemCategory })));
      setGalaxyEggUpgrades(gs?.eggUpgrades ?? { common: false, uncommon: false, rare: false, epic: false, legendary: false });
      setGalaxyBattleWave(gs?.battleWave ?? 1);
      galaxyBattleWaveRef.current = gs?.battleWave ?? 1;
      setGalaxyBattleSlots(gs?.battleSlots ?? [null, null, null, null, null]);

      const importedWave = save.battle?.wave || 1;
      setBattleWave(importedWave);
      battleWaveRef.current = importedWave;
      setBattleSlots(save.battle?.slots || [null, null, null, null, null]);
      setBattleStreak(0);

      saveGame(save);
      return true;
    } catch (e) {
      console.error("Failed to import save:", e);
      return false;
    }
  }, []);

  // Handler for hatching eggs - uses galaxy eggs/pets in area 2
  const handleHatchEgg = useCallback((eggId: string) => {
    const isGalaxy = currentArea === 2;
    const eggList = isGalaxy ? galaxyEggs : eggs;
    const egg = eggList.find(e => e.id === eggId);
    if (!egg) return;

    if (isGalaxy) {
      setGalaxyEggs(prev => prev.filter(e => e.id !== eggId));
    } else {
      setEggs(prev => prev.filter(e => e.id !== eggId));
    }

    const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
    const petName = isGalaxy
      ? (petType === "dog" ? "Galaxy Dog" : "Galaxy Cat")
      : (petType === "dog" ? "Dog" : "Cat");

    const bonus = generatePetBonus(petType, egg.rarity);

    const updatePets = (prev: Pet[]) => {
      const existingPetIndex = prev.findIndex(p => p.type === petType && p.rarity === egg.rarity);
      if (existingPetIndex !== -1) {
        const updated = [...prev];
        updated[existingPetIndex] = {
          ...updated[existingPetIndex],
          bonus: updated[existingPetIndex].bonus + bonus,
          count: updated[existingPetIndex].count + 1,
        };
        return updated;
      } else {
        const newPet: Pet = {
          id: crypto.randomUUID(),
          name: petName,
          type: petType,
          rarity: egg.rarity,
          bonus,
          count: 1,
        };
        return [...prev, newPet];
      }
    };

    if (isGalaxy) {
      setGalaxyPets(updatePets);
    } else {
      setPets(updatePets);
    }
  }, [eggs, galaxyEggs, currentArea]);

  const handleHatchAll = useCallback(() => {
    const isGalaxy = currentArea === 2;
    const eggList = isGalaxy ? galaxyEggs : eggs;
    if (eggList.length === 0) return;

    const newPetsMap = new Map<string, Pet>();

    eggList.forEach(egg => {
      const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
      const petName = isGalaxy
        ? (petType === "dog" ? "Galaxy Dog" : "Galaxy Cat")
        : (petType === "dog" ? "Dog" : "Cat");
      const bonus = generatePetBonus(petType, egg.rarity);
      const key = `${petType}-${egg.rarity}`;

      if (newPetsMap.has(key)) {
        const existing = newPetsMap.get(key)!;
        existing.bonus += bonus;
        existing.count += 1;
      } else {
        newPetsMap.set(key, {
          id: crypto.randomUUID(),
          name: petName,
          type: petType,
          rarity: egg.rarity,
          bonus,
          count: 1,
        });
      }
    });

    if (isGalaxy) {
      setGalaxyEggs([]);
      setGalaxyPets(prev => {
        const updated = [...prev];
        newPetsMap.forEach((newPet, key) => {
          const [type, rarity] = key.split('-') as ["dog" | "cat", Rarity];
          const existingIndex = updated.findIndex(p => p.type === type && p.rarity === rarity);
          if (existingIndex !== -1) {
            updated[existingIndex] = {
              ...updated[existingIndex],
              bonus: updated[existingIndex].bonus + newPet.bonus,
              count: updated[existingIndex].count + newPet.count,
            };
          } else {
            updated.push(newPet);
          }
        });
        return updated;
      });
    } else {
      setEggs([]);
      setPets(prev => {
        const updated = [...prev];
        newPetsMap.forEach((newPet, key) => {
          const [type, rarity] = key.split('-') as ["dog" | "cat", Rarity];
          const existingIndex = updated.findIndex(p => p.type === type && p.rarity === rarity);
          if (existingIndex !== -1) {
            updated[existingIndex] = {
              ...updated[existingIndex],
              bonus: updated[existingIndex].bonus + newPet.bonus,
              count: updated[existingIndex].count + newPet.count,
            };
          } else {
            updated.push(newPet);
          }
        });
        return updated;
      });
    }
  }, [eggs, galaxyEggs, currentArea]);

  const getRebirthCost = useCallback(() => {
    if (currentArea === 2) {
      // Galaxy rebirth costs space coins (scales with galaxy rebirth count)
      return Math.floor(REBIRTH_BASE_COST * Math.pow(REBIRTH_COST_MULTIPLIER, galaxyRebirthCount));
    }
    return Math.floor(REBIRTH_BASE_COST * Math.pow(REBIRTH_COST_MULTIPLIER, rebirthCount));
  }, [rebirthCount, galaxyRebirthCount, currentArea]);

  const handleRebirth = useCallback(() => {
    const cost = getRebirthCost();
    const currentCoins = currentArea === 2 ? galaxyCoins : coins;
    if (currentCoins >= cost) {
      if (currentArea === 2) {
        // Galaxy rebirth - only reset galaxy state
        setGalaxyCoins(0);
        setGalaxyXp(0);
        setGalaxyLevel(1);
        setGalaxyInventory([]);
        setGalaxyCoinGeneratorLevel(0);
        setGalaxyLuckUpgrades({ luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
        setGalaxyHasAutoOpen(false);
        setGalaxyHasAutoSell(false);
        setGalaxyAutoSellRarities(new Set());
        setGalaxyPurchasedBoxes([]);
        setGalaxyDropsHistory([]);
        setGalaxyEggUpgrades({ common: false, uncommon: false, rare: false, epic: false, legendary: false });
        setGalaxyBattleWave(1);
        galaxyBattleWaveRef.current = 1;
        setGalaxyBattleSlots([null, null, null, null, null]);
        setGalaxyRebirthTokens(prev => prev + 1);
        setGalaxyRebirthCount(prev => prev + 1);
      } else {
        // Normal rebirth - only reset area 1 state
        setCoins(0);
        setXp(0);
        setLevel(1);
        setInventory([]);
        setCoinGeneratorLevel(0);
        setLuckUpgrades({ luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
        setHasAutoOpen(false);
        setHasAutoSell(false);
        setAutoSellRarities(new Set());
        setPurchasedBoxes([]);
        setDropsHistory([]);
        setEggUpgrades({ common: false, uncommon: false, rare: false, epic: false, legendary: false });
        setBattleWave(1);
        battleWaveRef.current = 1;
        setBattleSlots([null, null, null, null, null]);
        setRebirthTokens(prev => prev + 1);
        setRebirthCount(prev => prev + 1);
      }
    }
  }, [coins, galaxyCoins, getRebirthCost, currentArea]);

  // Get galaxy prestige cost (5, 10, 15, etc.)
  const getGalaxyPrestigeCost = useCallback(() => {
    return 5 * (galaxyPrestigeCount + 1);
  }, [galaxyPrestigeCount]);

  const handlePrestige = useCallback(() => {
    if (currentArea === 2) {
      // Galaxy prestige - costs galaxy rebirth tokens, only resets galaxy state
      const cost = getGalaxyPrestigeCost();
      if (galaxyRebirthTokens >= cost) {
        setGalaxyRebirthTokens(0);
        setGalaxyRebirthCount(0);
        setGalaxyCoins(0);
        setGalaxyXp(0);
        setGalaxyLevel(1);
        setGalaxyInventory([]);
        setGalaxyCoinGeneratorLevel(0);
        setGalaxyLuckUpgrades({ luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
        setGalaxyHasAutoOpen(false);
        setGalaxyHasAutoSell(false);
        setGalaxyAutoSellRarities(new Set());
        setGalaxyPurchasedBoxes([]);
        setGalaxyDropsHistory([]);
        setGalaxyEggUpgrades({ common: false, uncommon: false, rare: false, epic: false, legendary: false });
        setGalaxyBattleWave(1);
        galaxyBattleWaveRef.current = 1;
        setGalaxyBattleSlots([null, null, null, null, null]);
        setBattleStreak(0);
        battleStreakRef.current = 0;
        setGalaxyEquippedPets([]);
        setGalaxyPrestigeCount(prev => prev + 1);
      }
    } else {
      // Normal prestige - only resets area 1 state
      const cost = getPrestigeCost(prestigeCount);
      if (rebirthTokens >= cost) {
        setRebirthTokens(0);
        setRebirthCount(0);
        setCoins(0);
        setXp(0);
        setLevel(1);
        setInventory([]);
        setCoinGeneratorLevel(0);
        setLuckUpgrades({ luckUpgrade1: 0, luckUpgrade2: 0, luckUpgrade3: 0 });
        setHasAutoOpen(false);
        setHasAutoSell(false);
        setAutoSellRarities(new Set());
        setPurchasedBoxes([]);
        setDropsHistory([]);
        setEggUpgrades({ common: false, uncommon: false, rare: false, epic: false, legendary: false });
        setBattleWave(1);
        battleWaveRef.current = 1;
        setBattleSlots([null, null, null, null, null]);
        setBattleStreak(0);
        battleStreakRef.current = 0;
        setEquippedPets([]);
        setPrestigeCount(prev => prev + 1);
      }
    }
  }, [rebirthTokens, prestigeCount, currentArea, galaxyRebirthTokens, getGalaxyPrestigeCost]);

  const handleNextArea = useCallback(() => {
    if (prestigeCount >= 2) {
      setCurrentArea(2);
    }
  }, [prestigeCount]);

  const handleBackArea = useCallback(() => {
    setCurrentArea(1);
  }, []);

  const handleBattle = useCallback(() => {
    const results: { playerPower: number; enemyPower: number; won: boolean; isArmor?: boolean }[] = [];

    let totalShieldReduction = 0;
    for (const slotId of effectiveBattleSlots) {
      if (slotId) {
        const item = effectiveInventory.find(it => it.id === slotId);
        if (item && isShield(item)) {
          totalShieldReduction += Math.abs(getWeaponPower(item));
        }
      }
    }
    const shieldReductionPerEnemy = totalShieldReduction;

    const currentWave = effectiveBattleWaveRef.current;
    for (let i = 0; i < 5; i++) {
      const slotId = effectiveBattleSlots[i];
      const item = slotId ? effectiveInventory.find(it => it.id === slotId) : null;
      const rawPower = item ? getWeaponPower(item) : 0;
      const baseEnemyPower = generateEnemyPower(currentWave, i);
      const enemyPowerAfterShield = Math.max(0, baseEnemyPower - shieldReductionPerEnemy);

      if (item && isArmor(item)) {
        const armorPower = rawPower;
        results.push({
          playerPower: armorPower,
          enemyPower: enemyPowerAfterShield,
          won: armorPower >= enemyPowerAfterShield,
          isArmor: true,
        });
      } else if (item && isShield(item)) {
        results.push({
          playerPower: rawPower,
          enemyPower: enemyPowerAfterShield,
          won: false,
        });
      } else {
        results.push({
          playerPower: rawPower,
          enemyPower: enemyPowerAfterShield,
          won: rawPower > enemyPowerAfterShield,
        });
      }
    }

    const wins = results.filter(r => r.won).length;
    const won = wins >= 3;

    if (won) {
      let baseCoins = BATTLE_BASE_COINS + currentWave;

      if (currentWave <= BATTLE_EARLY_WAVE_THRESHOLD) {
        const earlyWaveBonus = (BATTLE_EARLY_WAVE_THRESHOLD + 1 - currentWave) * BATTLE_EARLY_WAVE_BONUS_MULTIPLIER;
        baseCoins += earlyWaveBonus;
      }

      const newStreak = battleStreakRef.current + 1;
      battleStreakRef.current = newStreak;
      const streakBonus = Math.min(newStreak * BATTLE_STREAK_BONUS_PER_STREAK, BATTLE_MAX_STREAK_BONUS);

      const earnedCoins = baseCoins * coinMultiplier * (1 + streakBonus);
      setEffectiveCoins(prev => safeAddCoins(prev, earnedCoins));
      effectiveBattleWaveRef.current = currentWave + 1;
      setEffectiveBattleWave(currentWave + 1);
      setBattleStreak(newStreak);

      updateChallengeProgress('win_battles', 1);
      updateChallengeProgress('earn_coins', earnedCoins);

      if (newStreak > 0 && newStreak % BATTLE_STREAK_DROP_INTERVAL === 0) {
        let streakDropRarity: Rarity;
        if (newStreak >= BATTLE_STREAK_RARITY_THRESHOLDS.legendary) {
          streakDropRarity = Rarity.Legendary;
        } else if (newStreak >= BATTLE_STREAK_RARITY_THRESHOLDS.epic) {
          streakDropRarity = Rarity.Epic;
        } else {
          streakDropRarity = Rarity.Rare;
        }
        const streakDrop = generateLootWithGuaranteedRarity(streakDropRarity);
        if (streakDrop) {
          setEffectiveInventory(prev => [...prev, streakDrop]);
          setEffectiveDropsHistory(prev => [streakDrop, ...prev].slice(0, MAX_DROPS_HISTORY));
        }
      }

      const dropChance = Math.min(BATTLE_BASE_DROP_CHANCE + (currentWave * BATTLE_DROP_CHANCE_PER_WAVE), BATTLE_MAX_DROP_CHANCE);
      if (Math.random() < dropChance) {
        const rarityRoll = Math.random();
        let dropRarity: Rarity;
        if (currentWave >= BATTLE_DROP_RARITY_THRESHOLDS.legendary.minWave && rarityRoll < BATTLE_DROP_RARITY_THRESHOLDS.legendary.chance) {
          dropRarity = Rarity.Legendary;
        } else if (currentWave >= BATTLE_DROP_RARITY_THRESHOLDS.epic.minWave && rarityRoll < BATTLE_DROP_RARITY_THRESHOLDS.epic.chance) {
          dropRarity = Rarity.Epic;
        } else {
          dropRarity = Rarity.Rare;
        }

        const battleDrop = generateLootWithGuaranteedRarity(dropRarity);
        if (battleDrop) {
          setEffectiveInventory(prev => [...prev, battleDrop]);
          setEffectiveDropsHistory(prev => [battleDrop, ...prev].slice(0, MAX_DROPS_HISTORY));
          setLastBattleDrop(battleDrop);
          setTimeout(() => setLastBattleDrop(null), BATTLE_DROP_NOTIFICATION_DURATION_MS);
        }
      }

      return { won, results, streak: newStreak, coinsEarned: earnedCoins };
    } else {
      battleStreakRef.current = 0;
      setBattleStreak(0);
    }

    return { won, results, streak: 0 };
  }, [effectiveBattleSlots, effectiveInventory, coinMultiplier, updateChallengeProgress, effectiveBattleWaveRef, setEffectiveCoins, setEffectiveBattleWave, setEffectiveInventory, setEffectiveDropsHistory]);

  const getChestEmoji = () => {
    if (currentArea === 2) {
      // In galaxy area, show different boxes based on galaxy purchases
      if (chestState === "open") return "🌕";
      if (effectivePurchasedBoxes.includes('gold')) return "🌟";
      if (effectivePurchasedBoxes.includes('silver')) return "⭐";
      if (effectivePurchasedBoxes.includes('bronze')) return "✨";
      return "🌑"; // Default new moon in galaxy area
    }
    if (chestState === "open") return "📭";
    if (purchasedBoxes.includes('gold')) return "🥇";
    if (purchasedBoxes.includes('silver')) return "🥈";
    if (purchasedBoxes.includes('bronze')) return "🥉";
    return "📦";
  };

  const handleCodeSubmit = () => {
    if (codeValue === "1337") {
      setCoins((prev) => prev + 1000000000);
      setPrestigeCount((prev) => prev + 5);
      setUsedCheatCode(true);
      setCodeValue("");
      setShowCodeInput(false);
    }
  };

  return (
    <div className={`app ${currentArea === 2 ? 'area-galaxy' : ''}`}>
      <div className="version-tracker">vs: 1.01</div>
      <XPBar xp={effectiveXp} level={effectiveLevel} coins={effectiveCoins} rebirthTokens={rebirthTokens} showSettings={showSettings} onToggleSettings={() => setShowSettings(!showSettings)} coinGeneratorLevel={effectiveCoinGeneratorLevel} onManualSave={manualSave} onExportSave={exportSave} onImportSave={importSave} rebirthCount={rebirthCount} stats={stats} totalDogBonus={totalDogBonus} totalCatBonus={totalCatBonus} prestigeCount={prestigeCount} currentArea={currentArea} galaxyRebirthTokens={galaxyRebirthTokens} galaxyRebirthCount={galaxyRebirthCount} galaxyPrestigeCount={galaxyPrestigeCount} totalGalaxyDogBonus={totalGalaxyDogBonus} />

      {effectiveHasAutoOpen && (
        <div className="auto-open-bar-container">
          <div className="auto-open-bar-track">
            <div
              className="auto-open-bar-fill"
              style={{ width: `${autoOpenProgress}%` }}
            />
          </div>
          <span className="auto-open-label">Auto Open</span>
        </div>
      )}

      {bonusEventActive && bonusEventEndTime && (
        <div className="bonus-event-banner-small">
          <span className="bonus-small-icon">🔥</span>
          <span className="bonus-small-text">2x</span>
          <span className="bonus-small-timer">
            {Math.max(0, Math.ceil((bonusEventEndTime - Date.now()) / 1000))}s
          </span>
        </div>
      )}

      <div className="rebirth-prestige-container">
        <button
          className={`rebirth-btn ${effectiveCoins >= getRebirthCost() ? '' : 'disabled'}`}
          onClick={handleRebirth}
          disabled={effectiveCoins < getRebirthCost()}
        >
          <span className="rebirth-icon">{currentArea === 2 ? '🌌' : '🔄'}</span>
          <span className="rebirth-text">{currentArea === 2 ? 'Galaxy Rebirth' : 'Rebirth'}</span>
          <span className="rebirth-cost">{currentArea === 2 ? '🪐' : '💰'} {formatNumber(getRebirthCost())}</span>
        </button>

        <button
          className={`prestige-btn ${currentArea === 2
            ? (galaxyRebirthTokens >= getGalaxyPrestigeCost() ? '' : 'disabled')
            : (rebirthTokens >= getPrestigeCost(prestigeCount) ? '' : 'disabled')}`}
          onClick={handlePrestige}
          disabled={currentArea === 2
            ? galaxyRebirthTokens < getGalaxyPrestigeCost()
            : rebirthTokens < getPrestigeCost(prestigeCount)}
        >
          <span className="prestige-icon">{currentArea === 2 ? '🌟' : '⭐'}</span>
          <span className="prestige-text">{currentArea === 2 ? 'Galaxy Prestige' : 'Prestige'}</span>
          <span className="prestige-cost">{currentArea === 2 ? '🌌' : '🔄'} {currentArea === 2 ? getGalaxyPrestigeCost() : getPrestigeCost(prestigeCount)}</span>
        </button>
      </div>

      {dailyChallenges.length > 0 && (
        <button className="challenges-btn" onClick={() => setShowChallenges(true)}>
          <span className="challenges-btn-icon">📋</span>
          <span className="challenges-btn-text">Challenges</span>
          <span className="challenges-btn-progress">
            {dailyChallenges.filter(c => c.completed).length}/{dailyChallenges.length}
          </span>
        </button>
      )}

      <button className="battle-btn" onClick={() => setShowBattle(true)}>
        ⚔️ Battle
      </button>

      {hasPets && (
        <button className="pets-btn" onClick={() => setShowPets(true)}>
          🐾 Pets
        </button>
      )}

      {levelUpNotification && (
        <div className="level-up-notification">
          <div className="level-up-content">
            <span className="level-up-icon">⭐</span>
            <span className="level-up-text">Level {levelUpNotification}!</span>
            <span className="level-up-icon">⭐</span>
          </div>
        </div>
      )}

      {criticalHit && (
        <div className="critical-hit-notification">
          <div className="critical-hit-content">
            <span className="critical-hit-text">CRITICAL HIT!</span>
            <span className="critical-hit-bonus">2x Rewards!</span>
          </div>
        </div>
      )}

      <button className="drops-history-btn" onClick={() => setShowDropsHistory(true)}>
        📜 Drops ({effectiveDropsHistory.length})
      </button>

      <button className="shop-btn" onClick={() => setShowShop(true)}>
        🛒 Shop
      </button>

      {currentArea === 1 ? (
        <button
          className={`next-area-btn ${prestigeCount >= 2 ? '' : 'disabled'}`}
          onClick={handleNextArea}
          disabled={prestigeCount < 2}
        >
          <span className="next-area-icon">🌌</span>
          <span className="next-area-text">Next Area</span>
          {prestigeCount < 2 && <span className="next-area-cost">⭐ 2 Prestige</span>}
        </button>
      ) : (
        <button className="back-area-btn" onClick={handleBackArea}>
          <span className="back-area-icon">◀</span>
          <span className="back-area-text">Back</span>
        </button>
      )}

      <button className="inventory-btn" onClick={() => setShowInventory(true)}>
        🎒 Inventory ({effectiveInventory.length})
      </button>

      <div className="chest-container" onClick={() => openChest(true)}>
        {recentEgg && (
          <div className={`egg-on-chest rarity-${recentEgg}`} style={{ color: RARITY_COLORS[recentEgg] }}>
            <span className="egg-on-chest-emoji">🥚</span>
            <span className="egg-on-chest-label" style={{ backgroundColor: RARITY_COLORS[recentEgg] }}>
              {recentEgg.toUpperCase()}
            </span>
          </div>
        )}
        <div className={`chest ${chestState}`}>{getChestEmoji()}</div>
        {chestState === "closed" && !isOpening && (
          <p className="hint">Click or press Space to open!</p>
        )}
      </div>

      <div className="loot-display">{loot && <LootItemCard item={loot} />}</div>

      {showInventory && (
        <Inventory
          items={effectiveInventory}
          onClose={() => setShowInventory(false)}
          onSellItem={handleSellItem}
          onBulkSell={handleBulkSell}
          onMergeItems={handleMergeItems}
          hasAutoSell={effectiveHasAutoSell}
          autoSellRarities={effectiveAutoSellRarities}
          onToggleAutoSellRarity={(rarity) => {
            setEffectiveAutoSellRarities(prev => {
              const newSet = new Set(prev);
              if (newSet.has(rarity)) {
                newSet.delete(rarity);
              } else {
                newSet.add(rarity);
              }
              return newSet;
            });
          }}
        />
      )}

      {showShop && (
        <Shop
          onClose={() => setShowShop(false)}
          coins={effectiveCoins}
          onPurchase={(cost, itemId) => {
            setEffectiveCoins((prev) => prev - cost);
            setEffectivePurchasedBoxes((prev) => {
              const filtered = prev.filter(box => box !== 'bronze' && box !== 'silver' && box !== 'gold');
              return [...filtered, itemId];
            });
          }}
          purchasedBoxes={effectivePurchasedBoxes}
          coinGeneratorLevel={effectiveCoinGeneratorLevel}
          onUpgradeCoinGenerator={() => {
            const cost = getIdleUpgradeCost(effectiveCoinGeneratorLevel);
            if (effectiveCoins >= cost) {
              setEffectiveCoins((prev) => prev - cost);
              setEffectiveCoinGeneratorLevel((prev) => prev + 1);
            }
          }}
          luckUpgrades={effectiveLuckUpgrades}
          onUpgradeLuck={(upgradeId) => {
            const costs = {
              1: getLuckUpgradeCost(LUCK_UPGRADE_BASE_COSTS[1], effectiveLuckUpgrades.luckUpgrade1),
              2: getLuckUpgradeCost(LUCK_UPGRADE_BASE_COSTS[2], effectiveLuckUpgrades.luckUpgrade2),
              3: getLuckUpgradeCost(LUCK_UPGRADE_BASE_COSTS[3], effectiveLuckUpgrades.luckUpgrade3),
            };
            const cost = costs[upgradeId];
            if (effectiveCoins >= cost) {
              setEffectiveCoins((prev) => prev - cost);
              setEffectiveLuckUpgrades((prev) => ({
                ...prev,
                [`luckUpgrade${upgradeId}`]: prev[`luckUpgrade${upgradeId}` as keyof LuckUpgrades] + 1,
              }));
            }
          }}
          hasAutoOpen={effectiveHasAutoOpen}
          onBuyAutoOpen={() => {
            if (effectiveCoins >= AUTO_OPEN_COST) {
              setEffectiveCoins((prev) => prev - AUTO_OPEN_COST);
              setEffectiveHasAutoOpen(true);
            }
          }}
          hasAutoSell={effectiveHasAutoSell}
          onBuyAutoSell={() => {
            if (effectiveCoins >= AUTO_SELL_COST) {
              setEffectiveCoins((prev) => prev - AUTO_SELL_COST);
              setEffectiveHasAutoSell(true);
            }
          }}
          hasPets={hasPets}
          onBuyPets={() => {
            if (rebirthTokens >= PETS_UNLOCK_COST) {
              setRebirthTokens((prev) => prev - PETS_UNLOCK_COST);
              setHasPets(true);
            }
          }}
          rebirthTokens={rebirthTokens}
          eggUpgrades={effectiveEggUpgrades}
          onBuyEggUpgrade={(rarity) => {
            const cost = EGG_UPGRADE_COSTS[rarity];
            if (effectiveCoins >= cost && !effectiveEggUpgrades[rarity]) {
              setEffectiveCoins((prev) => prev - cost);
              setEffectiveEggUpgrades((prev) => ({ ...prev, [rarity]: true }));
            }
          }}
        />
      )}

      {showPets && (
        <PetsMenu
          onClose={() => setShowPets(false)}
          eggs={currentArea === 2 ? galaxyEggs : eggs}
          pets={currentArea === 2 ? galaxyPets : pets}
          equippedPets={currentArea === 2 ? galaxyEquippedPets : equippedPets}
          onHatchEgg={handleHatchEgg}
          onHatchAll={handleHatchAll}
          onEquipPet={(petId) => {
            if (currentArea === 2) {
              if (galaxyEquippedPets.length < 6 && !galaxyEquippedPets.includes(petId)) {
                setGalaxyEquippedPets([...galaxyEquippedPets, petId]);
              }
            } else {
              if (equippedPets.length < 6 && !equippedPets.includes(petId)) {
                setEquippedPets([...equippedPets, petId]);
              }
            }
          }}
          onUnequipPet={(petId) => {
            if (currentArea === 2) {
              setGalaxyEquippedPets(galaxyEquippedPets.filter(id => id !== petId));
            } else {
              setEquippedPets(equippedPets.filter(id => id !== petId));
            }
          }}
          isGalaxy={currentArea === 2}
        />
      )}

      {showBattle && (
        <BattleMenu
          onClose={() => setShowBattle(false)}
          inventory={effectiveInventory}
          battleSlots={effectiveBattleSlots}
          onUpdateSlots={setEffectiveBattleSlots}
          wave={effectiveBattleWave}
          streak={battleStreak}
          rebirthCount={rebirthCount}
          onBattle={handleBattle}
        />
      )}

      {showChallenges && (
        <div className="challenges-overlay" onClick={() => setShowChallenges(false)}>
          <div className="challenges-modal" onClick={(e) => e.stopPropagation()}>
            <div className="challenges-modal-header">
              <h2>📋 Daily Challenges</h2>
              <button className="close-btn" onClick={() => setShowChallenges(false)}>✕</button>
            </div>
            <div className="challenges-modal-content">
              {dailyChallenges.map(c => (
                <div key={c.id} className={`challenge-modal-item ${c.completed ? 'completed' : ''}`}>
                  <div className="challenge-modal-info">
                    <span className="challenge-modal-desc">{c.description}</span>
                    <div className="challenge-modal-progress-bar">
                      <div
                        className="challenge-modal-progress-fill"
                        style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="challenge-modal-stats">
                    <span className="challenge-modal-count">{c.progress}/{c.target}</span>
                    <span className="challenge-modal-reward">
                      {c.completed ? '✓' : `🪙 ${c.reward}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="challenges-modal-footer">
              <p className="challenges-reset-info">Challenges reset daily</p>
            </div>
          </div>
        </div>
      )}

      {showDropsHistory && (
        <DropsHistory
          drops={effectiveDropsHistory}
          onClose={() => setShowDropsHistory(false)}
          onClear={() => setEffectiveDropsHistory([])}
        />
      )}

      {offlineEarnings !== null && (
        <div className="offline-earnings-overlay" onClick={() => setOfflineEarnings(null)}>
          <div className="offline-earnings-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Welcome Back!</h2>
            <p>While you were away, your coin generators earned:</p>
            <div className="offline-earnings-amount">
              💰 +{offlineEarnings.toFixed(2)} Coins
            </div>
            <button className="offline-earnings-btn" onClick={() => setOfflineEarnings(null)}>
              Collect
            </button>
          </div>
        </div>
      )}

      <button className="code-btn" onClick={() => setShowCodeInput(true)}>
        🔑 Code
      </button>

      {showCodeInput && (
        <div className="code-overlay" onClick={() => { setShowCodeInput(false); setCodeValue(""); }}>
          <div className="code-modal" onClick={(e) => e.stopPropagation()}>
            <button className="code-close-btn" onClick={() => { setShowCodeInput(false); setCodeValue(""); }}>
              ✕
            </button>
            <h2>Enter Code</h2>
            <input
              type="text"
              className="code-input"
              placeholder="Enter code..."
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              autoFocus
            />
            <button className="code-submit-btn" onClick={handleCodeSubmit}>
              Redeem
            </button>
            {usedCheatCode && <span className="cheat-warning">* Save disabled this session</span>}
          </div>
        </div>
      )}
    </div>
  );
}
