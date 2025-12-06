import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { generateLoot, generateLootWithGuaranteedRarity } from "./generator";
import { LootItem, RARITY_EMOJIS, RARITY_COLORS, Rarity, CATEGORY_ICONS, ItemCategory, GameSave, SAVE_KEY, SAVE_VERSION, SELL_PRICES, XP_REWARDS, COIN_REWARDS } from "./types";

// Reusable audio context for sound effects
let audioContext: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContext;
  } catch {
    return null;
  }
}

// Save/Load utilities
type SaveError = { type: 'quota' | 'unknown'; message: string } | null;
let lastSaveError: SaveError = null;

function saveGame(save: GameSave): SaveError {
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

function getLastSaveError(): SaveError {
  return lastSaveError;
}

function loadGame(): GameSave | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    const save = JSON.parse(data) as GameSave;
    // Version check for future migrations
    if (save.version !== SAVE_VERSION) {
      console.log("Save version mismatch, may need migration");
    }
    return save;
  } catch (e) {
    console.error("Failed to load game:", e);
    return null;
  }
}

function calculateOfflineEarnings(lastSaved: number, coinGeneratorLevel: number): number {
  if (coinGeneratorLevel <= 0) return 0;
  const now = Date.now();
  const secondsAway = (now - lastSaved) / 1000;
  const maxOfflineSeconds = 8 * 60 * 60; // Cap at 8 hours
  const cappedSeconds = Math.min(secondsAway, maxOfflineSeconds);
  const coinsPerSecond = coinGeneratorLevel * 0.01;
  return cappedSeconds * coinsPerSecond;
}

// Format large numbers with K, M, B suffixes
function formatNumber(num: number): string {
  if (num < 1000) return num.toFixed(2);
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
  if (num < 1000000000000) return (num / 1000000000).toFixed(1) + 'B';
  return (num / 1000000000000).toFixed(1) + 'T';
}

// Get prestige cost based on current prestige count
function getPrestigeCost(prestigeCount: number): number {
  const costs = [8, 20, 50, 100];
  if (prestigeCount < costs.length) return costs[prestigeCount];
  // After first 4: 200, 400, 800, etc. (doubling)
  return 200 * Math.pow(2, prestigeCount - costs.length);
}

function ItemIcon({ category, color, size = 32 }: { category: ItemCategory; color: string; size?: number }) {
  const path = CATEGORY_ICONS[category];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="item-icon"
      style={{
        filter: `drop-shadow(0 0 4px ${color})`,
      }}
    >
      <path d={path} />
    </svg>
  );
}

function getLevelUpCoinReward(level: number): number {
  // Level 1->2: 2 coins, 2->3: 5 coins, 3->4: 10, 4->5: 15, 5->6: 20, etc.
  if (level === 1) return 2;
  if (level === 2) return 5;
  return (level - 1) * 5;
}

function addXp(currentXp: number, currentLevel: number, amount: number): { xp: number; level: number; coinReward: number } {
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

function LootItemCard({ item, compact = false, onView }: { item: LootItem; compact?: boolean; onView?: () => void }) {
  const color = RARITY_COLORS[item.rarity];

  if (compact) {
    return (
      <div className={`loot-item-compact rarity-${item.rarity}`}>
        <div className="item-icon-wrapper" style={{ borderColor: color }}>
          <ItemIcon category={item.category} color={color} size={24} />
        </div>
        <span className="loot-name" style={{ color }}>
          {item.name}
        </span>
        <span className="loot-category">{item.category}</span>
        <span className="loot-sell-price">{SELL_PRICES[item.rarity]}c</span>
        {onView && (
          <button className="view-btn" onClick={onView}>
            View
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`loot-item rarity-${item.rarity}`}>
      {item.rarity === "legendary" && <div className="legendary-burst" />}
      <div className="loot-header">
        <div className="item-icon-wrapper large" style={{ borderColor: color }}>
          <ItemIcon category={item.category} color={color} size={40} />
        </div>
        <span className="loot-name" style={{ color }}>
          {item.name}
        </span>
      </div>
      <div className="loot-category">{item.category}</div>
      <div className="loot-description">{item.description}</div>
      <div className="loot-stats">
        {Object.entries(item.stats).map(([key, value]) => (
          <div className="stat" key={key}>
            <span className="stat-name">{formatStatName(key)}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemDetailModal({ item, onClose, onSell }: { item: LootItem; onClose: () => void; onSell?: () => void }) {
  const color = RARITY_COLORS[item.rarity];

  return (
    <div className="item-detail-overlay" onClick={onClose}>
      <div className="item-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
        <div className={`item-detail-content rarity-${item.rarity}`}>
          <div className="item-detail-header">
            <div className="item-icon-wrapper xlarge" style={{ borderColor: color }}>
              <ItemIcon category={item.category} color={color} size={56} />
            </div>
            <div>
              <h2 className="item-detail-name" style={{ color }}>
                {item.name}
              </h2>
              <span className="item-detail-rarity" style={{ color }}>
                {item.rarity.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="item-detail-category">{item.category}</div>
          <p className="item-detail-description">{item.description}</p>
          <div className="item-detail-stats">
            <h3>Stats</h3>
            {Object.entries(item.stats).map(([key, value]) => (
              <div className="item-detail-stat" key={key}>
                <span className="stat-name">{formatStatName(key)}</span>
                <div className="stat-bar-container">
                  <div
                    className="stat-bar"
                    style={{
                      width: `${Math.min((value as number) / 5, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="stat-value">{value}</span>
              </div>
            ))}
          </div>
          {onSell && (
            <button className="sell-item-btn" onClick={onSell}>
              💰 Sell for {SELL_PRICES[item.rarity]} Coins
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatStatName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim();
}

type RarityFilter = "all" | Rarity;

type ShopSection = "idle" | "luck" | "consumables" | "boxes" | "specials";

interface LuckUpgrades {
  luckUpgrade1: number;
  luckUpgrade2: number;
  luckUpgrade3: number;
}

function getLuckUpgradeCost(basePrice: number, level: number): number {
  return Math.round(basePrice * Math.pow(1.07, level) * 100) / 100;
}

function calculateRarityWeights(luckUpgrades: LuckUpgrades): Record<Rarity, number> {
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

interface BoxUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  emoji: string;
}

const BOX_UPGRADES: BoxUpgrade[] = [
  { id: "bronze", name: "Bronze Box", description: "Slightly better odds for uncommon items", cost: 50, emoji: "🥉" },
  { id: "silver", name: "Silver Box", description: "Better odds for rare items", cost: 200, emoji: "🥈" },
  { id: "gold", name: "Gold Box", description: "Much better odds for epic and legendary items", cost: 500, emoji: "🥇" },
];

function getIdleUpgradeCost(level: number): number {
  const baseCost = 3;
  return Math.round(baseCost * Math.pow(1.05, level) * 100) / 100;
}

interface EggUpgrades {
  common: boolean;
  uncommon: boolean;
  rare: boolean;
  epic: boolean;
  legendary: boolean;
}

function Shop({
  onClose,
  coins,
  onPurchase,
  coinGeneratorLevel,
  onUpgradeCoinGenerator,
  luckUpgrades,
  onUpgradeLuck,
  purchasedBoxes,
  hasAutoOpen,
  onBuyAutoOpen,
  hasAutoSell,
  onBuyAutoSell,
  hasPets,
  onBuyPets,
  rebirthTokens,
  eggUpgrades,
  onBuyEggUpgrade,
}: {
  onClose: () => void;
  coins: number;
  onPurchase: (cost: number, itemId: string) => void;
  coinGeneratorLevel: number;
  onUpgradeCoinGenerator: () => void;
  luckUpgrades: LuckUpgrades;
  onUpgradeLuck: (upgradeId: 1 | 2 | 3) => void;
  purchasedBoxes: string[];
  hasAutoOpen: boolean;
  onBuyAutoOpen: () => void;
  hasAutoSell: boolean;
  onBuyAutoSell: () => void;
  hasPets: boolean;
  onBuyPets: () => void;
  rebirthTokens: number;
  eggUpgrades: EggUpgrades;
  onBuyEggUpgrade: (rarity: keyof EggUpgrades) => void;
}) {
  const [activeSection, setActiveSection] = useState<ShopSection>("idle");

  const sections: { id: ShopSection; label: string; emoji: string }[] = [
    { id: "idle", label: "Idle", emoji: "⏰" },
    { id: "luck", label: "Luck", emoji: "🍀" },
    { id: "consumables", label: "Active Upgrades", emoji: "🧪" },
    { id: "boxes", label: "Boxes", emoji: "📦" },
    { id: "specials", label: "Specials", emoji: "✨" },
  ];

  const coinGenCost = getIdleUpgradeCost(coinGeneratorLevel);
  const coinsPerSecond = coinGeneratorLevel * 0.01;

  const MAX_LUCK_LEVEL = 4;
  const luck1Cost = getLuckUpgradeCost(4, luckUpgrades.luckUpgrade1);
  const luck2Cost = getLuckUpgradeCost(6, luckUpgrades.luckUpgrade2);
  const luck3Cost = getLuckUpgradeCost(10, luckUpgrades.luckUpgrade3);

  const autoOpenCost = 50;

  const renderIdleContent = () => (
    <div className="shop-items-grid">
      <div className="shop-item-card">
        <span className="shop-item-emoji">💰</span>
        <h3 className="shop-item-name">Coin Generator</h3>
        <p className="shop-item-description">
          Generates coins automatically over time.
          <br />
          <span className="upgrade-stats">
            Level: {coinGeneratorLevel} | +{(coinsPerSecond).toFixed(2)}/sec
          </span>
        </p>
        <button
          className={`shop-buy-btn ${coins < coinGenCost ? "disabled" : ""}`}
          onClick={() => coins >= coinGenCost && onUpgradeCoinGenerator()}
          disabled={coins < coinGenCost}
        >
          {coins < coinGenCost ? `Need ${(coinGenCost - coins).toFixed(0)} more` : `💰 ${coinGenCost.toFixed(2)} Coins`}
        </button>
      </div>
      <div className="shop-item-card">
        <span className="shop-item-emoji">📦</span>
        <h3 className="shop-item-name">Auto Open</h3>
        <p className="shop-item-description">
          Automatically opens a box every 5 seconds.
        </p>
        <button
          className={`shop-buy-btn ${hasAutoOpen || coins < autoOpenCost ? "disabled" : ""}`}
          onClick={() => !hasAutoOpen && coins >= autoOpenCost && onBuyAutoOpen()}
          disabled={hasAutoOpen || coins < autoOpenCost}
        >
          {hasAutoOpen ? "✓ Owned" : coins < autoOpenCost ? `Need ${(autoOpenCost - coins).toFixed(0)} more` : `💰 ${autoOpenCost} Coins`}
        </button>
      </div>
    </div>
  );

  const renderLuckContent = () => (
    <div className="shop-items-grid">
      <div className="shop-item-card">
        <span className="shop-item-emoji">🟢</span>
        <h3 className="shop-item-name">Uncommon Luck</h3>
        <p className="shop-item-description">
          Increases uncommon drop rate.
          <br />
          <span className="upgrade-stats">
            +{(luckUpgrades.luckUpgrade1 * 0.5).toFixed(1)}% Uncommon
          </span>
        </p>
        <div className="upgrade-progress">
          <div className="upgrade-progress-bar" style={{ width: `${(luckUpgrades.luckUpgrade1 / MAX_LUCK_LEVEL) * 100}%`, backgroundColor: '#1eff00' }} />
          <span className="upgrade-progress-text">{luckUpgrades.luckUpgrade1}/{MAX_LUCK_LEVEL}</span>
        </div>
        <button
          className={`shop-buy-btn ${coins < luck1Cost || luckUpgrades.luckUpgrade1 >= MAX_LUCK_LEVEL ? "disabled" : ""}`}
          onClick={() => coins >= luck1Cost && luckUpgrades.luckUpgrade1 < MAX_LUCK_LEVEL && onUpgradeLuck(1)}
          disabled={coins < luck1Cost || luckUpgrades.luckUpgrade1 >= MAX_LUCK_LEVEL}
        >
          {luckUpgrades.luckUpgrade1 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck1Cost ? `Need ${(luck1Cost - coins).toFixed(0)} more` : `💰 ${luck1Cost.toFixed(2)} Coins`}
        </button>
      </div>
      <div className="shop-item-card">
        <span className="shop-item-emoji">🔵</span>
        <h3 className="shop-item-name">Rare Luck</h3>
        <p className="shop-item-description">
          Increases rare & uncommon drop rates.
          <br />
          <span className="upgrade-stats">
            +{(luckUpgrades.luckUpgrade2 * 2).toFixed(0)}% each
          </span>
        </p>
        <div className="upgrade-progress">
          <div className="upgrade-progress-bar" style={{ width: `${(luckUpgrades.luckUpgrade2 / MAX_LUCK_LEVEL) * 100}%`, backgroundColor: '#0070dd' }} />
          <span className="upgrade-progress-text">{luckUpgrades.luckUpgrade2}/{MAX_LUCK_LEVEL}</span>
        </div>
        <button
          className={`shop-buy-btn ${coins < luck2Cost || luckUpgrades.luckUpgrade2 >= MAX_LUCK_LEVEL ? "disabled" : ""}`}
          onClick={() => coins >= luck2Cost && luckUpgrades.luckUpgrade2 < MAX_LUCK_LEVEL && onUpgradeLuck(2)}
          disabled={coins < luck2Cost || luckUpgrades.luckUpgrade2 >= MAX_LUCK_LEVEL}
        >
          {luckUpgrades.luckUpgrade2 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck2Cost ? `Need ${(luck2Cost - coins).toFixed(0)} more` : `💰 ${luck2Cost.toFixed(2)} Coins`}
        </button>
      </div>
      <div className="shop-item-card">
        <span className="shop-item-emoji">🟣</span>
        <h3 className="shop-item-name">Epic Luck</h3>
        <p className="shop-item-description">
          Increases epic & legendary drop rates.
          <br />
          <span className="upgrade-stats">
            +{(luckUpgrades.luckUpgrade3 * 3).toFixed(0)}% Epic, +{(luckUpgrades.luckUpgrade3 * 1).toFixed(0)}% Legendary
          </span>
        </p>
        <div className="upgrade-progress">
          <div className="upgrade-progress-bar" style={{ width: `${(luckUpgrades.luckUpgrade3 / MAX_LUCK_LEVEL) * 100}%`, backgroundColor: '#a335ee' }} />
          <span className="upgrade-progress-text">{luckUpgrades.luckUpgrade3}/{MAX_LUCK_LEVEL}</span>
        </div>
        <button
          className={`shop-buy-btn ${coins < luck3Cost || luckUpgrades.luckUpgrade3 >= MAX_LUCK_LEVEL ? "disabled" : ""}`}
          onClick={() => coins >= luck3Cost && luckUpgrades.luckUpgrade3 < MAX_LUCK_LEVEL && onUpgradeLuck(3)}
          disabled={coins < luck3Cost || luckUpgrades.luckUpgrade3 >= MAX_LUCK_LEVEL}
        >
          {luckUpgrades.luckUpgrade3 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck3Cost ? `Need ${(luck3Cost - coins).toFixed(0)} more` : `💰 ${luck3Cost.toFixed(2)} Coins`}
        </button>
      </div>
    </div>
  );

  const renderBoxesContent = () => {
    const hasGold = purchasedBoxes.includes('gold');
    const hasSilver = purchasedBoxes.includes('silver');
    const hasBronze = purchasedBoxes.includes('bronze');
    
    return (
      <div className="shop-items-grid">
        {BOX_UPGRADES.map((box) => {
          const isOwned = purchasedBoxes.includes(box.id);
          const isDisabled = 
            (box.id === 'bronze' && (hasSilver || hasGold)) ||
            (box.id === 'silver' && hasGold) ||
            isOwned ||
            coins < box.cost;
          
          return (
            <div key={box.id} className="shop-item-card">
              <span className="shop-item-emoji">{box.emoji}</span>
              <h3 className="shop-item-name">{box.name}</h3>
              <p className="shop-item-description">{box.description}</p>
              <button
                className={`shop-buy-btn ${isDisabled ? "disabled" : ""}`}
                onClick={() => !isDisabled && onPurchase(box.cost, box.id)}
                disabled={isDisabled}
              >
                {isOwned ? "✓ Owned" :
                 (box.id === 'bronze' && (hasSilver || hasGold)) || (box.id === 'silver' && hasGold)
                   ? "Upgraded"
                   : coins < box.cost
                     ? `Need ${(box.cost - coins).toFixed(0)} more`
                     : `💰 ${box.cost} Coins`}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const autoSellCost = 25;
  const petsCost = 3; // rebirth tokens

  const renderSpecialsContent = () => (
    <div className="shop-items-grid">
      <div className="shop-item-card">
        <span className="shop-item-emoji">🔄</span>
        <h3 className="shop-item-name">Auto Sell</h3>
        <p className="shop-item-description">
          Unlocks auto-sell settings in your inventory. Automatically sell items of selected rarities when unboxed.
        </p>
        <button
          className={`shop-buy-btn ${hasAutoSell || coins < autoSellCost ? "disabled" : ""}`}
          onClick={() => !hasAutoSell && coins >= autoSellCost && onBuyAutoSell()}
          disabled={hasAutoSell || coins < autoSellCost}
        >
          {hasAutoSell ? "✓ Owned" : coins < autoSellCost ? `Need ${(autoSellCost - coins).toFixed(0)} more` : `💰 ${autoSellCost} Coins`}
        </button>
      </div>
      <div className="shop-item-card">
        <span className="shop-item-emoji">🐾</span>
        <h3 className="shop-item-name">Unlock Pets</h3>
        <p className="shop-item-description">
          Unlocks the pets system. Collect and equip pets to boost your gameplay!
        </p>
        <button
          className={`shop-buy-btn rebirth-currency ${hasPets || rebirthTokens < petsCost ? "disabled" : ""}`}
          onClick={() => !hasPets && rebirthTokens >= petsCost && onBuyPets()}
          disabled={hasPets || rebirthTokens < petsCost}
        >
          {hasPets ? "✓ Owned" : rebirthTokens < petsCost ? `Need ${petsCost - rebirthTokens} more` : `🔄 ${petsCost} Rebirth Tokens`}
        </button>
      </div>
    </div>
  );

  const eggUpgradeData: { rarity: keyof EggUpgrades; name: string; cost: number; color: string }[] = [
    { rarity: "common", name: "Common Eggs Upgrade", cost: 25, color: "#9d9d9d" },
    { rarity: "uncommon", name: "Uncommon Eggs Upgrade", cost: 50, color: "#1eff00" },
    { rarity: "rare", name: "Rare Eggs Upgrade", cost: 75, color: "#0070dd" },
    { rarity: "epic", name: "Epic Eggs Upgrade", cost: 100, color: "#a335ee" },
    { rarity: "legendary", name: "Legendary Eggs Upgrade", cost: 250, color: "#ff8000" },
  ];

  const renderActiveUpgradesContent = () => (
    <div className="shop-items-grid">
      {eggUpgradeData.map(({ rarity, name, cost, color }) => (
        <div key={rarity} className="shop-item-card">
          <span className="shop-item-emoji">🥚</span>
          <h3 className="shop-item-name" style={{ color }}>{name}</h3>
          <p className="shop-item-description">
            Unlocks {rarity} eggs from opening boxes.
          </p>
          <button
            className={`shop-buy-btn ${eggUpgrades[rarity] || coins < cost ? "disabled" : ""}`}
            onClick={() => !eggUpgrades[rarity] && coins >= cost && onBuyEggUpgrade(rarity)}
            disabled={eggUpgrades[rarity] || coins < cost}
          >
            {eggUpgrades[rarity] ? "✓ Owned" : coins < cost ? `Need ${(cost - coins).toFixed(0)} more` : `💰 ${cost} Coins`}
          </button>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "idle":
        return renderIdleContent();
      case "luck":
        return renderLuckContent();
      case "consumables":
        return renderActiveUpgradesContent();
      case "boxes":
        return renderBoxesContent();
      case "specials":
        return renderSpecialsContent();
      default:
        return <p className="shop-empty">Coming soon...</p>;
    }
  };

  return (
    <div className="shop-overlay">
      <div className="shop-modal">
        <div className="shop-header">
          <span className="shop-coins">💰 {coins.toFixed(2)} Coins</span>
          <button className="shop-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shop-tabs">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`shop-tab ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="shop-tab-emoji">{section.emoji}</span>
              <span className="shop-tab-label">{section.label}</span>
            </button>
          ))}
        </div>
        <div className="shop-content">
          <h2 className="shop-section-title">
            {sections.find((s) => s.id === activeSection)?.emoji}{" "}
            {sections.find((s) => s.id === activeSection)?.label}
          </h2>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

type PetsTab = "pets" | "equip-pets" | "open-pets";

interface Pet {
  id: string;
  name: string;
  type: "dog" | "cat";
  rarity: Rarity;
  bonus: number; // Dogs: +X% coin gen, Cats: +X% legendary drop
  count: number; // Number of stacked pets
}

// Calculate pet bonus range based on rarity
// Dogs: 5-230% coin generation (scaled by rarity)
// Cats: 5-55% legendary drop chance (scaled by rarity)
function getPetBonusRange(type: "dog" | "cat", rarity: Rarity): { min: number; max: number } {
  const rarityMultipliers: Record<Rarity, number> = {
    [Rarity.Common]: 0.1,
    [Rarity.Uncommon]: 0.25,
    [Rarity.Rare]: 0.5,
    [Rarity.Epic]: 0.75,
    [Rarity.Legendary]: 1.0,
  };
  const mult = rarityMultipliers[rarity];

  if (type === "dog") {
    // Dogs: 5-230% coin generation
    return { min: 5 + mult * 25, max: 30 + mult * 200 };
  } else {
    // Cats: 5-55% legendary drop chance
    return { min: 5 + mult * 5, max: 10 + mult * 45 };
  }
}

function generatePetBonus(type: "dog" | "cat", rarity: Rarity): number {
  const { min, max } = getPetBonusRange(type, rarity);
  return Math.round(min + Math.random() * (max - min));
}

function PetsMenu({
  onClose,
  eggs,
  pets,
  equippedPets,
  onHatchEgg,
  onHatchAll,
  onEquipPet,
  onUnequipPet
}: {
  onClose: () => void;
  eggs: { rarity: Rarity; id: string }[];
  pets: Pet[];
  equippedPets: string[];
  onHatchEgg: (eggId: string) => void;
  onHatchAll: () => void;
  onEquipPet: (petId: string) => void;
  onUnequipPet: (petId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<PetsTab>("pets");
  const [selectedEgg, setSelectedEgg] = useState<{ rarity: Rarity; id: string } | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);

  const renderPetsContent = () => (
    <div className="pets-grid">
      {pets.length === 0 ? (
        <p className="no-pets-message">No pets yet. Hatch some eggs!</p>
      ) : (
        pets.map((pet) => (
          <div key={pet.id} className="pet-slot has-pet" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
            <div className="pet-slot-content" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
              <span className="pet-emoji">{pet.type === "dog" ? "🐕" : "🐈"}</span>
              {pet.count > 1 && (
                <span className="pet-count" style={{ backgroundColor: RARITY_COLORS[pet.rarity] }}>
                  x{pet.count}
                </span>
              )}
            </div>
            <span className="pet-name" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.name}</span>
            <span className="pet-bonus" style={{ color: RARITY_COLORS[pet.rarity] }}>
              +{pet.bonus || 0}% {pet.type === "dog" ? "Coins" : "Legendary"}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const renderEquipPetsContent = () => {
    // Get unequipped pets for the selection modal
    const unequippedPets = pets.filter(pet => !equippedPets.includes(pet.id));

    return (
      <div className="equip-pets-content">
        <div className="equip-slots-grid">
          {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
            const equippedPetId = equippedPets[slotIndex];
            const equippedPet = equippedPetId ? pets.find(p => p.id === equippedPetId) : null;

            return (
              <div key={slotIndex} className={`equip-slot ${equippedPet ? 'has-pet' : ''}`} style={equippedPet ? { borderColor: RARITY_COLORS[equippedPet.rarity] } : undefined}>
                <div className="equip-slot-content" style={equippedPet ? { borderColor: RARITY_COLORS[equippedPet.rarity] } : undefined}>
                  {equippedPet ? (
                    <span className="pet-emoji">{equippedPet.type === "dog" ? "🐕" : "🐈"}</span>
                  ) : (
                    <span className="equip-slot-empty">?</span>
                  )}
                </div>
                {equippedPet ? (
                  <>
                    <span className="pet-name" style={{ color: RARITY_COLORS[equippedPet.rarity] }}>{equippedPet.name}</span>
                    <span className="pet-bonus" style={{ color: RARITY_COLORS[equippedPet.rarity] }}>
                      +{equippedPet.bonus || 0}% {equippedPet.type === "dog" ? "Coins" : "Legendary"}
                    </span>
                    <button className="equip-slot-btn unequip" onClick={() => onUnequipPet(equippedPetId)}>Unequip</button>
                  </>
                ) : (
                  <>
                    <span className="equip-slot-label">Slot {slotIndex + 1}</span>
                    <button
                      className="equip-slot-btn"
                      onClick={() => setSelectingSlot(slotIndex)}
                      disabled={unequippedPets.length === 0}
                    >
                      Equip
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {selectingSlot !== null && (
          <div className="pet-select-overlay" onClick={() => setSelectingSlot(null)}>
            <div className="pet-select-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Select a Pet to Equip</h3>
              <div className="pet-select-grid">
                {unequippedPets.length === 0 ? (
                  <p className="no-pets-message">No unequipped pets available.</p>
                ) : (
                  unequippedPets.map((pet) => (
                    <div
                      key={pet.id}
                      className="pet-select-item"
                      style={{ borderColor: RARITY_COLORS[pet.rarity] }}
                      onClick={() => {
                        onEquipPet(pet.id);
                        setSelectingSlot(null);
                      }}
                    >
                      <span className="pet-emoji">{pet.type === "dog" ? "🐕" : "🐈"}</span>
                      <span className="pet-name" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.name}</span>
                      <span className="pet-bonus" style={{ color: RARITY_COLORS[pet.rarity] }}>
                        +{pet.bonus || 0}% {pet.type === "dog" ? "Coins" : "Legendary"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button className="pet-select-close" onClick={() => setSelectingSlot(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOpenPetsContent = () => {
    const rarities: Rarity[] = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];

    // Count eggs by rarity
    const eggCounts = rarities.reduce((acc, rarity) => {
      acc[rarity] = eggs.filter(e => e.rarity === rarity).length;
      return acc;
    }, {} as Record<Rarity, number>);

    // Get first egg of each rarity for hatching
    const getFirstEggOfRarity = (rarity: Rarity) => {
      return eggs.find(e => e.rarity === rarity);
    };

    return (
      <div className="open-pets-content">
        <div className="eggs-slots-grid">
          {rarities.map((rarity) => {
            const count = eggCounts[rarity];
            const egg = getFirstEggOfRarity(rarity);
            return (
              <div
                key={rarity}
                className={`egg-slot ${count > 0 ? 'has-eggs clickable' : 'empty'}`}
                style={{ borderColor: RARITY_COLORS[rarity] }}
                onClick={() => egg && setSelectedEgg(egg)}
              >
                <div className="egg-slot-content" style={{ borderColor: RARITY_COLORS[rarity] }}>
                  {count > 0 ? (
                    <>
                      <span className="egg-slot-emoji">🥚</span>
                      <span className="egg-slot-count" style={{ backgroundColor: RARITY_COLORS[rarity] }}>
                        x{count}
                      </span>
                    </>
                  ) : (
                    <span className="egg-slot-empty">?</span>
                  )}
                </div>
                <span className="egg-slot-rarity" style={{ color: RARITY_COLORS[rarity] }}>
                  {rarity}
                </span>
              </div>
            );
          })}
          <div className="egg-slot coming-soon">
            <div className="egg-slot-content coming-soon-content">
              <span className="coming-soon-icon">✨</span>
            </div>
            <span className="coming-soon-text">Coming Soon...</span>
          </div>
        </div>
        {eggs.length > 0 && (
          <button className="hatch-all-btn" onClick={onHatchAll}>
            🥚 Hatch All ({eggs.length})
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="pets-overlay" onClick={onClose}>
      <div className="pets-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pets-header">
          <h2>Pets</h2>
          <button className="pets-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="pets-tabs">
          <button
            className={`pets-tab ${activeTab === "pets" ? "active" : ""}`}
            onClick={() => setActiveTab("pets")}
          >
            Pets
          </button>
          <button
            className={`pets-tab ${activeTab === "equip-pets" ? "active" : ""}`}
            onClick={() => setActiveTab("equip-pets")}
          >
            Equip Pets
          </button>
          <button
            className={`pets-tab ${activeTab === "open-pets" ? "active" : ""}`}
            onClick={() => setActiveTab("open-pets")}
          >
            Open Pets
          </button>
        </div>
        <div className="pets-content">
          {activeTab === "pets" && renderPetsContent()}
          {activeTab === "equip-pets" && renderEquipPetsContent()}
          {activeTab === "open-pets" && renderOpenPetsContent()}
        </div>
      </div>

      {selectedEgg && (
        <div className="hatch-modal-overlay" onClick={() => setSelectedEgg(null)}>
          <div className="hatch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hatch-egg-display" style={{ borderColor: RARITY_COLORS[selectedEgg.rarity] }}>
              <span className="hatch-egg-emoji">🥚</span>
              <span className="hatch-egg-rarity" style={{ color: RARITY_COLORS[selectedEgg.rarity] }}>
                {selectedEgg.rarity.toUpperCase()}
              </span>
            </div>
            <p className="hatch-prompt">Would you like to hatch this egg?</p>
            <div className="hatch-buttons">
              <button
                className="hatch-btn hatch-confirm"
                onClick={() => {
                  onHatchEgg(selectedEgg.id);
                  setSelectedEgg(null);
                }}
              >
                Hatch
              </button>
              <button
                className="hatch-btn hatch-cancel"
                onClick={() => setSelectedEgg(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SortOrder = "newest" | "oldest";

// Calculate weapon power from stats (shields return negative power, armor returns positive defensive power)
function getWeaponPower(item: LootItem): number {
  // Rarity multiplier
  const rarityMultiplier: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Uncommon]: 1.5,
    [Rarity.Rare]: 2.5,
    [Rarity.Epic]: 4,
    [Rarity.Legendary]: 7,
  };

  // Shields give negative power (reduces all enemy power globally)
  if (item.category === ItemCategory.Shield) {
    const shieldStats = item.stats as { capacity?: number; rechargeRate?: number; rechargeDelay?: number };
    let shieldPower = 0;
    if (shieldStats.capacity) shieldPower += shieldStats.capacity * 3;
    if (shieldStats.rechargeRate) shieldPower += shieldStats.rechargeRate * 2;
    return -(shieldPower * rarityMultiplier[item.rarity]);
  }

  // Armor gives defensive power (absorbs enemy damage in its slot)
  if (item.category === ItemCategory.Armor) {
    const armorStats = item.stats as { defense?: number; mobility?: number };
    let armorPower = 0;
    if (armorStats.defense) armorPower += armorStats.defense * 4;
    if (armorStats.mobility) armorPower += armorStats.mobility * 1;
    return armorPower * rarityMultiplier[item.rarity];
  }

  // Regular weapons
  const stats = item.stats as { damage?: number; fireRate?: number; accuracy?: number; magazineSize?: number };
  let power = 0;
  if (stats.damage) power += stats.damage * 2;
  if (stats.fireRate) power += stats.fireRate;
  if (stats.accuracy) power += stats.accuracy * 0.5;
  if (stats.magazineSize) power += stats.magazineSize * 0.3;

  return power * rarityMultiplier[item.rarity];
}

// Check if item is a shield
function isShield(item: LootItem): boolean {
  return item.category === ItemCategory.Shield;
}

// Check if item is armor
function isArmor(item: LootItem): boolean {
  return item.category === ItemCategory.Armor;
}

// Generate enemy weapon power based on wave
function generateEnemyPower(wave: number, slotIndex: number): number {
  // Wave 1 is easier to help new players learn the system
  if (wave === 1) {
    const basePower = 25; // Much lower base for first battle
    const variance = (Math.random() - 0.5) * (basePower * 0.4); // Less variance
    const slotBonus = slotIndex * 3; // Smaller slot bonus
    return Math.max(15, Math.round(basePower + variance + slotBonus));
  }

  // Start at 50 base power, increasing by 20 per wave
  const basePower = 50 + (wave - 1) * 20;
  // Add random variance of ±30% of base power for each enemy
  const variance = (Math.random() - 0.5) * (basePower * 0.6);
  // Add slight bonus for later slots (enemies get slightly harder within a wave)
  const slotBonus = slotIndex * 8;
  return Math.max(30, Math.round(basePower + variance + slotBonus));
}

function BattleMenu({
  onClose,
  inventory,
  battleSlots,
  onUpdateSlots,
  wave,
  streak,
  rebirthCount,
  onBattle,
}: {
  onClose: () => void;
  inventory: LootItem[];
  battleSlots: (string | null)[];
  onUpdateSlots: (slots: (string | null)[]) => void;
  wave: number;
  streak: number;
  rebirthCount: number;
  onBattle: () => { won: boolean; results: { playerPower: number; enemyPower: number; won: boolean }[]; streak?: number; coinsEarned?: number };
}) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [battleResults, setBattleResults] = useState<{ playerPower: number; enemyPower: number; won: boolean }[] | null>(null);
  const [battleWon, setBattleWon] = useState<boolean | null>(null);
  const [autoBattleResults, setAutoBattleResults] = useState<{ wins: number; losses: number; totalCoins: number; isMax?: boolean } | null>(null);

  // Filter inventory to only show weapons, armor, and shields, sorted by power (best first, shields at end)
  const weaponCategories = [ItemCategory.Pistol, ItemCategory.Rifle, ItemCategory.SMG, ItemCategory.Shotgun, ItemCategory.Sniper, ItemCategory.Heavy, ItemCategory.Armor, ItemCategory.Shield];
  const weapons = inventory
    .filter(item => weaponCategories.includes(item.category))
    .sort((a, b) => getWeaponPower(b) - getWeaponPower(a));

  const handleSelectWeapon = (itemId: string) => {
    if (selectedSlot === null) return;

    const newSlots = [...battleSlots];
    // If this weapon is already in another slot, remove it from there
    const existingIndex = newSlots.indexOf(itemId);
    if (existingIndex !== -1) {
      newSlots[existingIndex] = null;
    }
    newSlots[selectedSlot] = itemId;
    onUpdateSlots(newSlots);
    setSelectedSlot(null);
  };

  const handleClearSlot = (index: number) => {
    const newSlots = [...battleSlots];
    newSlots[index] = null;
    onUpdateSlots(newSlots);
  };

  // Auto-equip the best available weapons to empty slots
  const handleAutoEquip = () => {
    const newSlots = [...battleSlots];
    const equippedIds = new Set(newSlots.filter(id => id !== null));

    // Get unequipped weapons sorted by power (best first), but put shields at the end
    const availableWeapons = weapons
      .filter(w => !equippedIds.has(w.id))
      .sort((a, b) => {
        // Prioritize non-shields first
        const aIsShield = isShield(a);
        const bIsShield = isShield(b);
        if (aIsShield && !bIsShield) return 1;
        if (!aIsShield && bIsShield) return -1;
        return getWeaponPower(b) - getWeaponPower(a);
      });

    // Fill empty slots with best available weapons
    for (let i = 0; i < 5; i++) {
      if (newSlots[i] === null && availableWeapons.length > 0) {
        const weapon = availableWeapons.shift()!;
        newSlots[i] = weapon.id;
      }
    }

    onUpdateSlots(newSlots);
  };

  const handleBattle = () => {
    const { won, results } = onBattle();
    setBattleResults(results);
    setBattleWon(won);
  };

  const handleCloseBattleResults = () => {
    setBattleResults(null);
    setBattleWon(null);
  };

  const handleAutoBattle = () => {
    let wins = 0;
    let losses = 0;
    let totalCoins = 0;

    for (let i = 0; i < 10; i++) {
      const { won, coinsEarned } = onBattle();
      if (won) {
        wins++;
        totalCoins += coinsEarned || 0;
      } else {
        losses++;
      }
    }

    setAutoBattleResults({ wins, losses, totalCoins, isMax: false });
  };

  const handleMaxBattle = () => {
    let wins = 0;
    let totalCoins = 0;

    // Battle until we lose
    while (true) {
      const { won, coinsEarned } = onBattle();
      if (won) {
        wins++;
        totalCoins += coinsEarned || 0;
      } else {
        break; // Stop on first loss
      }
      // Safety limit to prevent infinite loops
      if (wins >= 1000) break;
    }

    setAutoBattleResults({ wins, losses: 1, totalCoins, isMax: true });
  };

  const handleCloseAutoBattleResults = () => {
    setAutoBattleResults(null);
  };

  const filledSlots = battleSlots.filter(s => s !== null).length;
  const canBattle = filledSlots > 0;

  return (
    <div className="battle-overlay" onClick={onClose}>
      <div className="battle-modal" onClick={(e) => e.stopPropagation()}>
        <div className="battle-header">
          <h2>Battle ⚔️</h2>
          <div className="battle-info">
            <span className="battle-wave">Wave {wave}</span>
            {streak > 0 && <span className="battle-streak">Streak: {streak}</span>}
          </div>
          <button className="battle-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="battle-rewards-preview">
          <span className="reward-label">Win Reward:</span>
          <span className="reward-coins">
            {(() => {
              let baseCoins = 5 + wave;
              // Early wave bonus (waves 1-3)
              if (wave <= 3) {
                baseCoins += (4 - wave) * 3;
              }
              const streakBonus = Math.min((streak + 1) * 0.10, 1.0);
              const rebirthBonus = rebirthCount * 0.10;
              const total = baseCoins * (1 + rebirthBonus) * (1 + streakBonus);
              return `${total.toFixed(1)} coins`;
            })()}
          </span>
          {wave <= 3 && <span className="early-wave-bonus">Early wave bonus!</span>}
          <span className="reward-drop">+ chance for rare+ drop</span>
        </div>

        <div className="battle-content">
          <div className="battle-slots-section">
            <h3>Your Weapons</h3>
            <div className="battle-slots-grid">
              {battleSlots.map((slotId, index) => {
                const item = slotId ? inventory.find(i => i.id === slotId) : null;
                return (
                  <div
                    key={index}
                    className={`battle-slot ${selectedSlot === index ? 'selected' : ''} ${item ? 'has-weapon' : ''}`}
                    style={{ borderColor: item ? RARITY_COLORS[item.rarity] : undefined }}
                    onClick={() => setSelectedSlot(selectedSlot === index ? null : index)}
                  >
                    {item ? (
                      <>
                        <div className="battle-slot-content" style={{ borderColor: RARITY_COLORS[item.rarity] }}>
                          <ItemIcon category={item.category} color={RARITY_COLORS[item.rarity]} size={32} />
                        </div>
                        <span className="battle-slot-name" style={{ color: RARITY_COLORS[item.rarity] }}>
                          {item.name}
                        </span>
                        <span className="battle-slot-power">
                          {(isArmor(item) || isShield(item)) ? '🛡️' : '⚡'} {Math.round(getWeaponPower(item))}
                        </span>
                        <button
                          className="battle-slot-clear"
                          onClick={(e) => { e.stopPropagation(); handleClearSlot(index); }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="battle-slot-content empty">
                          <span className="battle-slot-empty">?</span>
                        </div>
                        <span className="battle-slot-label">Slot {index + 1}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {weapons.length > 0 && filledSlots < 5 && (
              <button className="auto-equip-btn" onClick={handleAutoEquip}>
                ⚡ Auto-Equip Best Weapons
              </button>
            )}
            {wave === 1 && filledSlots === 0 && weapons.length > 0 && (
              <div className="battle-tutorial">
                <p>💡 <strong>Tip:</strong> Click "Auto-Equip" to quickly fill your slots with your best weapons, or click on empty slots to manually select weapons.</p>
              </div>
            )}
            {wave === 1 && weapons.length === 0 && (
              <div className="battle-tutorial">
                <p>💡 <strong>Tip:</strong> You need weapons to battle! Open some chests first to find pistols, rifles, armor, and more.</p>
              </div>
            )}
          </div>

          {selectedSlot !== null && (
            <div className="battle-weapon-picker">
              <h3>Select Weapon for Slot {selectedSlot + 1}</h3>
              <div className="battle-weapon-list">
                {weapons.length === 0 ? (
                  <p className="no-weapons-message">No weapons in inventory!</p>
                ) : (
                  weapons.map(weapon => {
                    const isEquipped = battleSlots.includes(weapon.id);
                    return (
                      <div
                        key={weapon.id}
                        className={`battle-weapon-item ${isEquipped ? 'equipped' : ''}`}
                        style={{ borderColor: RARITY_COLORS[weapon.rarity] }}
                        onClick={() => handleSelectWeapon(weapon.id)}
                      >
                        <div className="item-icon-wrapper" style={{ borderColor: RARITY_COLORS[weapon.rarity] }}>
                          <ItemIcon category={weapon.category} color={RARITY_COLORS[weapon.rarity]} size={24} />
                        </div>
                        <span className="weapon-name" style={{ color: RARITY_COLORS[weapon.rarity] }}>
                          {weapon.name}
                        </span>
                        <span className="weapon-power">{(isArmor(weapon) || isShield(weapon)) ? '🛡️' : '⚡'} {Math.round(getWeaponPower(weapon))}</span>
                        {isEquipped && <span className="equipped-badge">Equipped</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="battle-buttons">
            <button
              className={`battle-fight-btn ${!canBattle ? 'disabled' : ''}`}
              onClick={handleBattle}
              disabled={!canBattle}
            >
              ⚔️ Fight Wave {wave}!
            </button>
            <button
              className={`battle-auto-btn ${!canBattle ? 'disabled' : ''}`}
              onClick={handleAutoBattle}
              disabled={!canBattle}
            >
              ⚔️ Auto x10
            </button>
            <button
              className={`battle-max-btn ${!canBattle ? 'disabled' : ''}`}
              onClick={handleMaxBattle}
              disabled={!canBattle}
            >
              ⚔️ Max Battle
            </button>
          </div>
        </div>
      </div>

      {battleResults && (
        <div className="battle-results-overlay" onClick={handleCloseBattleResults}>
          <div className="battle-results-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className={battleWon ? 'victory' : 'defeat'}>
              {battleWon ? '🏆 Victory!' : '💀 Defeat!'}
            </h2>
            <div className="battle-results-grid">
              {battleResults.map((result, index) => (
                <div key={index} className={`battle-result-row ${result.won ? 'won' : 'lost'}`}>
                  <span className="result-slot">Slot {index + 1}</span>
                  <span className="result-player">⚡ {Math.round(result.playerPower)}</span>
                  <span className="result-vs">vs</span>
                  <span className="result-enemy">⚡ {Math.round(result.enemyPower)}</span>
                  <span className="result-outcome">{result.won ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
            <div className="battle-results-summary">
              {battleWon ? (
                <p>You won {battleResults.filter(r => r.won).length}/5 battles! +5 coins</p>
              ) : (
                <p>You only won {battleResults.filter(r => r.won).length}/5 battles. Try again!</p>
              )}
            </div>
            <button className="battle-results-close-btn" onClick={handleCloseBattleResults}>
              Continue
            </button>
          </div>
        </div>
      )}
      {autoBattleResults && (
        <div className="battle-results-overlay" onClick={handleCloseAutoBattleResults}>
          <div className="battle-results-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{autoBattleResults.isMax ? '⚔️ Max Battle Complete!' : '⚔️ Auto Battle Complete!'}</h2>
            <div className="auto-battle-summary">
              {autoBattleResults.isMax ? (
                <>
                  <p className="max-battle-wins">🏆 {autoBattleResults.wins} Consecutive Wins!</p>
                  <p>Total Coins: +{autoBattleResults.totalCoins.toFixed(1)}</p>
                </>
              ) : (
                <>
                  <p>Wins: {autoBattleResults.wins}/10</p>
                  <p>Losses: {autoBattleResults.losses}/10</p>
                  <p>Total Coins: +{autoBattleResults.totalCoins.toFixed(1)}</p>
                </>
              )}
            </div>
            <button className="battle-results-close-btn" onClick={handleCloseAutoBattleResults}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropsHistory({
  drops,
  onClose,
  onClear,
}: {
  drops: LootItem[];
  onClose: () => void;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<LootItem | null>(null);

  const rarityOrder: Rarity[] = [
    Rarity.Legendary,
    Rarity.Epic,
    Rarity.Rare,
    Rarity.Uncommon,
    Rarity.Common,
  ];

  const filteredDrops = useMemo(() => {
    let result = [...drops];

    // Filter by rarity
    if (filter !== "all") {
      result = result.filter((item) => item.rarity === filter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    }

    // Sort by order (drops are already newest first, so reverse for oldest)
    if (sortOrder === "oldest") {
      result = result.reverse();
    }

    return result;
  }, [drops, filter, sortOrder, searchQuery]);

  const rarityCounts = drops.reduce((acc, item) => {
    acc[item.rarity] = (acc[item.rarity] || 0) + 1;
    return acc;
  }, {} as Record<Rarity, number>);

  return (
    <div className="drops-history-overlay" onClick={onClose}>
      <div className="drops-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drops-history-header">
          <h2>Drops History</h2>
          <div className="drops-history-header-actions">
            {drops.length > 0 && (
              <button className="clear-history-btn" onClick={onClear}>
                Clear All
              </button>
            )}
            <button className="drops-history-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="drops-history-filters">
          <div className="drops-history-search">
            <input
              type="text"
              placeholder="Search drops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="drops-history-search-input"
            />
          </div>

          <div className="drops-history-sort">
            <button
              className={`sort-btn ${sortOrder === "newest" ? "active" : ""}`}
              onClick={() => setSortOrder("newest")}
            >
              Newest
            </button>
            <button
              className={`sort-btn ${sortOrder === "oldest" ? "active" : ""}`}
              onClick={() => setSortOrder("oldest")}
            >
              Oldest
            </button>
          </div>
        </div>

        <div className="drops-history-tabs">
          <button
            className={`tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({drops.length})
          </button>
          {rarityOrder.map((rarity) => (
            <button
              key={rarity}
              className={`tab tab-${rarity} ${filter === rarity ? "active" : ""}`}
              onClick={() => setFilter(rarity)}
            >
              {RARITY_EMOJIS[rarity]} {rarityCounts[rarity] || 0}
            </button>
          ))}
        </div>

        <div className="drops-history-list">
          {filteredDrops.length === 0 ? (
            <p className="empty-drops">
              {drops.length === 0
                ? "No drops yet. Open some chests!"
                : "No drops match your filters."}
            </p>
          ) : (
            filteredDrops.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="drops-history-item"
                onClick={() => setSelectedItem(item)}
              >
                <div className="item-icon-wrapper" style={{ borderColor: RARITY_COLORS[item.rarity] }}>
                  <ItemIcon category={item.category} color={RARITY_COLORS[item.rarity]} size={24} />
                </div>
                <span className="drop-name" style={{ color: RARITY_COLORS[item.rarity] }}>
                  {item.name}
                </span>
                <span className="drop-category">{item.category}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function Inventory({
  items,
  onClose,
  onSellItem,
  onBulkSell,
  onMergeItems,
  hasAutoSell,
  autoSellRarities,
  onToggleAutoSellRarity,
}: {
  items: LootItem[];
  onClose: () => void;
  onSellItem: (itemId: string) => void;
  onBulkSell: (itemIds: string[]) => number;
  onMergeItems: (itemIds: string[]) => LootItem | null;
  hasAutoSell: boolean;
  autoSellRarities: Set<Rarity>;
  onToggleAutoSellRarity: (rarity: Rarity) => void;
}) {
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [selectedItem, setSelectedItem] = useState<LootItem | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<LootItem[]>([]);
  const [bulkSellMode, setBulkSellMode] = useState(false);
  const [selectedForSell, setSelectedForSell] = useState<Set<string>>(new Set());
  const [showAutoSellSettings, setShowAutoSellSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkSellConfirm, setShowBulkSellConfirm] = useState(false);
  const [showSellAllModal, setShowSellAllModal] = useState(false);
  const [sellAllRarities, setSellAllRarities] = useState<Set<Rarity>>(new Set());
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [mergeResult, setMergeResult] = useState<LootItem | null>(null);

  const rarityOrder: Rarity[] = [
    Rarity.Legendary,
    Rarity.Epic,
    Rarity.Rare,
    Rarity.Uncommon,
    Rarity.Common,
  ];

  const filteredItems = useMemo(() => {
    let result = filter === "all"
      ? [...items].sort(
          (a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
        )
      : items.filter((item) => item.rarity === filter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, filter, searchQuery, rarityOrder]);

  const rarityCounts = items.reduce((acc, item) => {
    acc[item.rarity] = (acc[item.rarity] || 0) + 1;
    return acc;
  }, {} as Record<Rarity, number>);

  const totalItems = items.length;
  const rarityPercentages = totalItems > 0 ? Object.entries(rarityCounts).reduce((acc, [rarity, count]) => {
    acc[rarity as Rarity] = (count / totalItems) * 100;
    return acc;
  }, {} as Record<Rarity, number>) : {} as Record<Rarity, number>;

  const handleItemClick = (item: LootItem) => {
    if (mergeMode) {
      // In merge mode, can only select 3 items of same rarity (non-legendary)
      if (item.rarity === Rarity.Legendary) return; // Can't merge legendaries

      const newSet = new Set(selectedForMerge);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else if (newSet.size < 3) {
        // Check if same rarity as already selected items
        const selectedItems = items.filter(i => newSet.has(i.id));
        if (selectedItems.length === 0 || selectedItems[0].rarity === item.rarity) {
          newSet.add(item.id);
        }
      }
      setSelectedForMerge(newSet);
    } else if (bulkSellMode) {
      const newSet = new Set(selectedForSell);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      setSelectedForSell(newSet);
    } else if (compareMode) {
      if (selectedForCompare.find(i => i.id === item.id)) {
        setSelectedForCompare(selectedForCompare.filter(i => i.id !== item.id));
      } else if (selectedForCompare.length < 2) {
        setSelectedForCompare([...selectedForCompare, item]);
      }
    } else {
      setSelectedItem(item);
    }
  };

  const handleMerge = () => {
    if (selectedForMerge.size === 3) {
      const result = onMergeItems(Array.from(selectedForMerge));
      if (result) {
        setMergeResult(result);
        setSelectedForMerge(new Set());
      }
    }
  };

  const canMerge = () => {
    if (selectedForMerge.size !== 3) return false;
    const selectedItems = items.filter(i => selectedForMerge.has(i.id));
    if (selectedItems.length !== 3) return false;
    const rarity = selectedItems[0].rarity;
    return selectedItems.every(i => i.rarity === rarity) && rarity !== Rarity.Legendary;
  };

  const getNextRarity = (rarity: Rarity): Rarity | null => {
    const order = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];
    const idx = order.indexOf(rarity);
    return idx < order.length - 1 ? order[idx + 1] : null;
  };

  const handleBulkSellClick = () => {
    if (selectedForSell.size > 0) {
      setShowBulkSellConfirm(true);
    }
  };

  const confirmBulkSell = () => {
    onBulkSell(Array.from(selectedForSell));
    setSelectedForSell(new Set());
    setBulkSellMode(false);
    setShowBulkSellConfirm(false);
  };

  const getSelectedSellValue = () => {
    return items
      .filter(item => selectedForSell.has(item.id))
      .reduce((total, item) => total + SELL_PRICES[item.rarity], 0);
  };

  const getSellAllValue = () => {
    return items
      .filter(item => sellAllRarities.has(item.rarity))
      .reduce((total, item) => total + SELL_PRICES[item.rarity], 0);
  };

  const getSellAllCount = () => {
    return items.filter(item => sellAllRarities.has(item.rarity)).length;
  };

  const handleSellAllConfirm = () => {
    const itemsToSell = items.filter(item => sellAllRarities.has(item.rarity)).map(i => i.id);
    if (itemsToSell.length > 0) {
      onBulkSell(itemsToSell);
    }
    setShowSellAllModal(false);
    setSellAllRarities(new Set());
  };

  const toggleSellAllRarity = (rarity: Rarity) => {
    const newSet = new Set(sellAllRarities);
    if (newSet.has(rarity)) {
      newSet.delete(rarity);
    } else {
      newSet.add(rarity);
    }
    setSellAllRarities(newSet);
  };

  return (
    <div className="inventory-overlay" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-header">
          <h2>Inventory</h2>
          <div className="inventory-header-actions">
            {hasAutoSell && (
              <button
                className={`auto-sell-settings-btn ${showAutoSellSettings ? 'active' : ''}`}
                onClick={() => setShowAutoSellSettings(!showAutoSellSettings)}
              >
                {showAutoSellSettings ? '✓ Auto Sell' : '🔄 Auto Sell'}
              </button>
            )}
            <button
              className="sell-all-btn"
              onClick={() => setShowSellAllModal(true)}
            >
              🗑️ Sell All
            </button>
            <button
              className={`bulk-sell-mode-btn ${bulkSellMode ? 'active' : ''}`}
              onClick={() => {
                setBulkSellMode(!bulkSellMode);
                setSelectedForSell(new Set());
                setCompareMode(false);
                setSelectedForCompare([]);
                setShowAutoSellSettings(false);
              }}
            >
              {bulkSellMode ? '✓ Bulk Sell' : '💰 Bulk Sell'}
            </button>
            <button
              className={`compare-mode-btn ${compareMode ? 'active' : ''}`}
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedForCompare([]);
                setBulkSellMode(false);
                setSelectedForSell(new Set());
                setShowAutoSellSettings(false);
                setMergeMode(false);
                setSelectedForMerge(new Set());
              }}
            >
              {compareMode ? '✓ Compare Mode' : '⚖️ Compare'}
            </button>
            <button
              className={`merge-mode-btn ${mergeMode ? 'active' : ''}`}
              onClick={() => {
                setMergeMode(!mergeMode);
                setSelectedForMerge(new Set());
                setCompareMode(false);
                setSelectedForCompare([]);
                setBulkSellMode(false);
                setSelectedForSell(new Set());
                setShowAutoSellSettings(false);
              }}
            >
              {mergeMode ? '✓ Merge Mode' : '🔀 Merge'}
            </button>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="inventory-search">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="inventory-search-input"
          />
        </div>

        <div className="inventory-tabs">
          <button
            className={`tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({items.length})
          </button>
          {rarityOrder.map((rarity) => (
            <button
              key={rarity}
              className={`tab tab-${rarity} ${filter === rarity ? "active" : ""}`}
              onClick={() => setFilter(rarity)}
            >
              {RARITY_EMOJIS[rarity]} {rarityCounts[rarity] || 0}
            </button>
          ))}
        </div>

        {showAutoSellSettings && (
          <div className="auto-sell-settings">
            <h3>Auto Sell Settings</h3>
            <p className="auto-sell-desc">Select rarities to automatically sell when unboxed:</p>
            <div className="auto-sell-options">
              {rarityOrder.map((rarity) => (
                <label key={rarity} className="auto-sell-option" style={{ borderColor: RARITY_COLORS[rarity] }}>
                  <input
                    type="checkbox"
                    checked={autoSellRarities.has(rarity)}
                    onChange={() => onToggleAutoSellRarity(rarity)}
                  />
                  <span style={{ color: RARITY_COLORS[rarity] }}>
                    {RARITY_EMOJIS[rarity]} {rarity}
                  </span>
                  <span className="auto-sell-price">+{SELL_PRICES[rarity]} coins</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {bulkSellMode && (
          <div className="bulk-sell-info">
            <span>Selected: {selectedForSell.size} items ({getSelectedSellValue()} coins)</span>
            {selectedForSell.size > 0 && (
              <button className="confirm-bulk-sell-btn" onClick={handleBulkSellClick}>
                Sell Selected
              </button>
            )}
          </div>
        )}

        {compareMode && selectedForCompare.length > 0 && (
          <div className="compare-info">
            Selected: {selectedForCompare.length}/2 items {selectedForCompare.length === 2 && '(Scroll down to compare)'}
          </div>
        )}

        {mergeMode && (
          <div className="merge-info">
            <span>
              Select 3 items of same rarity to merge into 1 higher rarity item
              {selectedForMerge.size > 0 && (
                <>
                  {' '}| Selected: {selectedForMerge.size}/3
                  {selectedForMerge.size === 3 && (() => {
                    const selectedItems = items.filter(i => selectedForMerge.has(i.id));
                    const nextRarity = getNextRarity(selectedItems[0]?.rarity);
                    return nextRarity ? ` → 1 ${nextRarity}` : '';
                  })()}
                </>
              )}
            </span>
            {canMerge() && (
              <button className="confirm-merge-btn" onClick={handleMerge}>
                Merge Items
              </button>
            )}
          </div>
        )}

        <div className="inventory-list">
          {filteredItems.length === 0 ? (
            <p className="empty-inventory">
              {filter === "all"
                ? "No items yet. Open some chests!"
                : `No ${filter} items yet.`}
            </p>
          ) : (
            filteredItems.map((item) => {
              const isSelectedCompare = selectedForCompare.find(i => i.id === item.id);
              const isSelectedSell = selectedForSell.has(item.id);
              const isSelectedMerge = selectedForMerge.has(item.id);
              const isMergeDisabled = mergeMode && item.rarity === Rarity.Legendary;
              return (
                <div key={item.id} className={`inventory-item-wrapper ${isSelectedCompare ? 'selected-for-compare' : ''} ${isSelectedSell ? 'selected-for-sell' : ''} ${isSelectedMerge ? 'selected-for-merge' : ''} ${isMergeDisabled ? 'merge-disabled' : ''}`}>
                  <LootItemCard
                    item={item}
                    compact
                    onView={() => handleItemClick(item)}
                  />
                </div>
              );
            })
          )}
        </div>

        {compareMode && selectedForCompare.length === 2 && (
          <div className="comparison-view">
            <h3>Comparison</h3>
            <div className="comparison-grid">
              {selectedForCompare.map((item) => (
                <LootItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedItem && !compareMode && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSell={() => {
            onSellItem(selectedItem.id);
            setSelectedItem(null);
          }}
        />
      )}

      {showBulkSellConfirm && (
        <div className="confirm-modal-overlay" onClick={() => setShowBulkSellConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Sell</h3>
            <p>Sell {selectedForSell.size} items for {getSelectedSellValue()} coins?</p>
            <div className="confirm-modal-buttons">
              <button className="confirm-cancel-btn" onClick={() => setShowBulkSellConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-sell-btn" onClick={confirmBulkSell}>
                Sell
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellAllModal && (
        <div className="confirm-modal-overlay" onClick={() => { setShowSellAllModal(false); setSellAllRarities(new Set()); }}>
          <div className="confirm-modal sell-all-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sell All by Rarity</h3>
            <p>Select rarities to sell:</p>
            <div className="sell-all-rarity-options">
              {rarityOrder.map((rarity) => {
                const count = rarityCounts[rarity] || 0;
                const value = count * SELL_PRICES[rarity];
                return (
                  <label key={rarity} className="sell-all-rarity-option" style={{ borderColor: RARITY_COLORS[rarity] }}>
                    <input
                      type="checkbox"
                      checked={sellAllRarities.has(rarity)}
                      onChange={() => toggleSellAllRarity(rarity)}
                      disabled={count === 0}
                    />
                    <span style={{ color: count === 0 ? '#666' : RARITY_COLORS[rarity] }}>
                      {RARITY_EMOJIS[rarity]} {rarity}
                    </span>
                    <span className="sell-all-count">{count} items</span>
                    <span className="sell-all-value">{value}c</span>
                  </label>
                );
              })}
            </div>
            <div className="sell-all-summary">
              Total: {getSellAllCount()} items for {getSellAllValue()} coins
            </div>
            <div className="confirm-modal-buttons">
              <button className="confirm-cancel-btn" onClick={() => { setShowSellAllModal(false); setSellAllRarities(new Set()); }}>
                Cancel
              </button>
              <button
                className="confirm-sell-btn"
                onClick={handleSellAllConfirm}
                disabled={getSellAllCount() === 0}
              >
                Sell All
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeResult && (
        <div className="merge-result-overlay" onClick={() => setMergeResult(null)}>
          <div className="merge-result-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Merge Successful!</h3>
            <p>You created:</p>
            <LootItemCard item={mergeResult} />
            <button className="merge-result-close-btn" onClick={() => setMergeResult(null)}>
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function XPBar({ xp, level, coins, rebirthTokens, showSettings, onToggleSettings, coinGeneratorLevel, onManualSave, onExportSave, onImportSave, rebirthCount, stats, totalDogBonus, totalCatBonus, prestigeCount }: { xp: number; level: number; coins: number; rebirthTokens: number; showSettings: boolean; onToggleSettings: () => void; coinGeneratorLevel: number; onManualSave: () => void; onExportSave: () => void; onImportSave: (data: string) => boolean; rebirthCount: number; stats: { totalChestsOpened: number; totalCoinsEarned: number; legendariesFound: number }; totalDogBonus: number; totalCatBonus: number; prestigeCount: number }) {
  const xpForNextLevel = level * 100;
  const progress = (xp / xpForNextLevel) * 100;
  const [activeSettingsTab, setActiveSettingsTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const baseCoinsPerSecond = coinGeneratorLevel * 0.01;
  const rebirthBonus = rebirthCount * 0.10;
  const dogBonus = totalDogBonus / 100;
  const coinsPerSecond = baseCoinsPerSecond * (1 + rebirthBonus + dogBonus);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualSave = () => {
    onManualSave();
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleExport = () => {
    onExportSave();
    setSaveStatus("Exported!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      if (data) {
        const success = onImportSave(data);
        setSaveStatus(success ? "Imported!" : "Import failed!");
        setTimeout(() => setSaveStatus(""), 2000);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <div className="xp-bar-container">
      <div className="xp-bar-header">
        <span className="xp-level">Level {level}</span>
        <span className="xp-text">{xp} / {xpForNextLevel} XP</span>
        <button className="settings-gear-btn" onClick={onToggleSettings}>
          ⚙️
        </button>
      </div>
      {showSettings && (
        <div className="settings-dropdown">
          <div className="settings-buttons">
            <button
              className={`settings-tab-btn ${activeSettingsTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab(activeSettingsTab === 'controls' ? null : 'controls')}
              title="Controls"
            >
              ⌨️
            </button>
            <button
              className={`settings-tab-btn ${activeSettingsTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab(activeSettingsTab === 'stats' ? null : 'stats')}
              title="Stats"
            >
              📊
            </button>
            <button
              className="settings-tab-btn"
              onClick={handleManualSave}
              title="Manual Save"
            >
              💾
            </button>
            <button
              className="settings-tab-btn"
              onClick={handleExport}
              title="Export Save"
            >
              📤
            </button>
            <button
              className="settings-tab-btn"
              onClick={handleImportClick}
              title="Import Save"
            >
              📥
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
          {saveStatus && (
            <div className="save-status">{saveStatus}</div>
          )}
          {activeSettingsTab === 'controls' && (
            <div className="settings-section">
              <h3 className="settings-section-title">⌨️ Controls</h3>
              <div className="settings-controls">
                <div className="control-item">
                  <span className="control-key">Space</span>
                  <span className="control-description">Open chest</span>
                </div>
                <div className="control-item">
                  <span className="control-key">Esc</span>
                  <span className="control-description">Close menus</span>
                </div>
              </div>
            </div>
          )}
          {activeSettingsTab === 'stats' && (
            <div className="settings-section">
              <h3 className="settings-section-title">📊 Stats</h3>
              <div className="settings-stats">
                <div className="stat-item">
                  <span className="stat-label">Chests Opened</span>
                  <span className="stat-value">{stats.totalChestsOpened.toLocaleString()}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Coins Earned</span>
                  <span className="stat-value">{stats.totalCoinsEarned.toFixed(2)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Legendaries Found</span>
                  <span className="stat-value">{stats.legendariesFound.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="coins-display">
        <span className="coins-text">💰 {formatNumber(coins)} Coins</span>
        {coinsPerSecond > 0 && (
          <span className="coin-rate">+{formatNumber(coinsPerSecond)}/s</span>
        )}
      </div>
      {(rebirthCount > 0 || prestigeCount > 0 || totalDogBonus > 0 || totalCatBonus > 0) && (
        <div className="bonuses-display">
          {prestigeCount > 0 && (
            <span className="prestige-bonus-text">+{prestigeCount * 100}% Prestige</span>
          )}
          {rebirthCount > 0 && (
            <span className="rebirth-bonus-text">+{rebirthCount * 10}% Rebirth</span>
          )}
          {totalDogBonus > 0 && (
            <span className="dog-bonus-text">+{totalDogBonus}% Coins</span>
          )}
          {totalCatBonus > 0 && (
            <span className="cat-bonus-text">+{totalCatBonus}% Legendary</span>
          )}
        </div>
      )}
      <div className="rebirth-tokens-display">
        <span className="rebirth-tokens-text">🔄 {rebirthTokens} Rebirth Tokens</span>
        {prestigeCount > 0 && (
          <span className="prestige-count-text">⭐ {prestigeCount} Prestige</span>
        )}
      </div>
      <h1 className="title">Lootbox</h1>
    </div>
  );
}

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
  const battleStreakRef = useRef(0); // Real-time streak tracking for rapid battles
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
        // Migrate old pets: generate bonus if missing, default count to 1
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
      setBattleWave(save.battle?.wave || 1);
      setBattleSlots(save.battle?.slots || [null, null, null, null, null]);

      // Calculate offline earnings
      const earnings = calculateOfflineEarnings(save.lastSaved, save.upgrades.coinGeneratorLevel);
      if (earnings > 0.01) {
        setOfflineEarnings(earnings);
        setCoins((prev) => prev + earnings);

        // Auto-collect after 5 seconds
        setTimeout(() => {
          setOfflineEarnings(null);
        }, 5000);
      }
    } else {
      loadedLevelRef.current = 1;
    }
    // Use requestAnimationFrame to ensure React has finished all state updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        saveEnabledRef.current = true;
        setIsLoaded(true);
      });
    });
  }, []);

  // Auto-save when state changes (but not if cheat code was used)
  useEffect(() => {
    // Use ref as primary guard - it's synchronous and can't be affected by React timing
    if (!saveEnabledRef.current) return;
    if (!isLoaded) return;
    if (usedCheatCode) return;

    const save: GameSave = {
      version: SAVE_VERSION,
      lastSaved: Date.now(),
      player: { level, xp, coins },
      inventory,
      upgrades: {
        coinGeneratorLevel,
        luckUpgrade1: luckUpgrades.luckUpgrade1,
        luckUpgrade2: luckUpgrades.luckUpgrade2,
        luckUpgrade3: luckUpgrades.luckUpgrade3,
        hasAutoOpen,
        hasAutoSell,
        autoSellRarities: Array.from(autoSellRarities),
        hasPets,
        eggUpgrades,
      },
      rebirth: {
        tokens: rebirthTokens,
        count: rebirthCount,
      },
      prestige: {
        count: prestigeCount,
      },
      area: currentArea,
      eggs,
      pets,
      equippedPets,
      dropsHistory,
      stats,
      purchasedBoxes,
      battle: {
        wave: battleWave,
        slots: battleSlots,
      },
    };
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, isLoaded, purchasedBoxes, usedCheatCode, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots]);

  // Show level-up notification - only when level actually increases from gameplay
  const prevLevelRef = useRef<number>(level);
  useEffect(() => {
    if (!isLoaded) return;

    // Only show notification if level increased beyond what we loaded or last saw
    if (level > prevLevelRef.current && level > (loadedLevelRef.current || 1)) {
      setLevelUpNotification(level);
      setTimeout(() => setLevelUpNotification(null), 3000);
    }
    prevLevelRef.current = level;
  }, [level, isLoaded]);

  // Calculate total dog bonus for coin generation (only equipped pets)
  const totalDogBonus = useMemo(() => {
    return pets
      .filter(pet => pet.type === "dog" && equippedPets.includes(pet.id))
      .reduce((sum, pet) => sum + (pet.bonus || 0), 0);
  }, [pets, equippedPets]);

  // Calculate coin multiplier (used for selling, battles, and idle generation)
  const coinMultiplier = useMemo(() => {
    const rebirthBonus = rebirthCount * 0.10; // 10% per rebirth
    const prestigeBonus = prestigeCount * 1.0; // 100% per prestige (permanent)
    const dogBonus = totalDogBonus / 100; // Convert percentage to multiplier
    const bonusEventMultiplier = bonusEventActive ? 1.0 : 0; // 2x during bonus events
    return 1 + rebirthBonus + prestigeBonus + dogBonus + bonusEventMultiplier;
  }, [rebirthCount, prestigeCount, totalDogBonus, bonusEventActive]);

  // Generate daily challenges
  const generateDailyChallenges = useCallback(() => {
    const challengeTemplates = [
      { id: 'open_chests', description: 'Open 50 chests', target: 50, reward: 100 },
      { id: 'sell_items', description: 'Sell 20 items', target: 20, reward: 50 },
      { id: 'win_battles', description: 'Win 5 battles', target: 5, reward: 150 },
      { id: 'find_rares', description: 'Find 10 rare+ items', target: 10, reward: 75 },
      { id: 'earn_coins', description: 'Earn 500 coins', target: 500, reward: 200 },
    ];
    // Pick 3 random challenges
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
      setDailyChallenges(generateDailyChallenges());
      setLastChallengeReset(now);
    }
  }, [isLoaded, lastChallengeReset, generateDailyChallenges]);

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

  // Start bonus event (5 minutes of 2x rewards)
  const startBonusEvent = useCallback(() => {
    if (bonusEventActive) return;
    setBonusEventActive(true);
    setBonusEventEndTime(Date.now() + 5 * 60 * 1000); // 5 minutes
  }, [bonusEventActive]);

  // Update challenge progress
  const updateChallengeProgress = useCallback((challengeId: string, amount: number = 1) => {
    setDailyChallenges(prev => prev.map(c => {
      if (c.id !== challengeId || c.completed) return c;
      const newProgress = c.progress + amount;
      const completed = newProgress >= c.target;
      if (completed && !c.completed) {
        // Award coins when challenge completes
        setCoins(coins => coins + c.reward);
      }
      return { ...c, progress: Math.min(newProgress, c.target), completed };
    }));
  }, []);

  // Idle coin generation
  useEffect(() => {
    if (coinGeneratorLevel <= 0) return;

    const interval = setInterval(() => {
      const baseCoinsPerSecond = coinGeneratorLevel * 0.01;
      const coinsPerSecond = baseCoinsPerSecond * coinMultiplier;
      setCoins((prev) => prev + coinsPerSecond / 10); // Divide by 10 since we run 10 times per second
    }, 100);

    return () => clearInterval(interval);
  }, [coinGeneratorLevel, coinMultiplier]);

  // Auto-open chests with progress tracking
  useEffect(() => {
    if (!hasAutoOpen || !isLoaded) return;

    const AUTO_OPEN_INTERVAL = 5000; // 5 seconds
    const PROGRESS_UPDATE_INTERVAL = 50; // Update progress every 50ms
    let elapsed = 0;

    const progressInterval = setInterval(() => {
      // Only count progress if not currently opening and no modals are open
      if (!isOpening && !showInventory && !showShop && !showPets && !showDropsHistory && !showBattle) {
        elapsed += PROGRESS_UPDATE_INTERVAL;
        const progress = (elapsed / AUTO_OPEN_INTERVAL) * 100;
        setAutoOpenProgress(Math.min(progress, 100));

        if (elapsed >= AUTO_OPEN_INTERVAL) {
          openChest();
          elapsed = 0;
          setAutoOpenProgress(0);
        }
      }
    }, PROGRESS_UPDATE_INTERVAL);

    return () => {
      clearInterval(progressInterval);
      setAutoOpenProgress(0);
    };
  }, [hasAutoOpen, isLoaded, isOpening, showInventory, showShop, showPets, showDropsHistory, showBattle]);

  // Calculate total cat bonus for legendary drop chance (only equipped pets)
  const totalCatBonus = useMemo(() => {
    return pets
      .filter(pet => pet.type === "cat" && equippedPets.includes(pet.id))
      .reduce((sum, pet) => sum + (pet.bonus || 0), 0);
  }, [pets, equippedPets]);

  const getBoxRarityWeights = useCallback((): Record<Rarity, number> => {
    const baseWeights = calculateRarityWeights(luckUpgrades);
    let weights = { ...baseWeights };

    // Apply box upgrades on top of luck upgrades
    if (purchasedBoxes.includes('gold')) {
      // Gold box: +15% epic, +5% legendary, -20% common
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] - 20),
        [Rarity.Epic]: weights[Rarity.Epic] + 15,
        [Rarity.Legendary]: weights[Rarity.Legendary] + 5,
      };
    } else if (purchasedBoxes.includes('silver')) {
      // Silver box: +10% rare, +5% uncommon, -15% common
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] - 15),
        [Rarity.Uncommon]: weights[Rarity.Uncommon] + 5,
        [Rarity.Rare]: weights[Rarity.Rare] + 10,
      };
    } else if (purchasedBoxes.includes('bronze')) {
      // Bronze box: +8% uncommon, -8% common
      weights = {
        ...weights,
        [Rarity.Common]: Math.max(0, weights[Rarity.Common] - 8),
        [Rarity.Uncommon]: weights[Rarity.Uncommon] + 8,
      };
    }

    // Apply cat bonus to legendary drop chance (additive percentage)
    if (totalCatBonus > 0) {
      const legendaryBoost = totalCatBonus / 100 * weights[Rarity.Legendary];
      weights = {
        ...weights,
        [Rarity.Legendary]: weights[Rarity.Legendary] + legendaryBoost,
      };
    }

    return weights;
  }, [luckUpgrades, purchasedBoxes, totalCatBonus]);

  const openChest = (isManual: boolean = false) => {
    if (isOpening) return;

    setIsOpening(true);
    setChestState("opening");
    setLoot(null);

    setTimeout(() => {
      setChestState("open");

      // Critical hit chance on manual opens (15% chance)
      const isCritical = isManual && Math.random() < 0.15;
      if (isCritical) {
        setCriticalHit(true);
        setTimeout(() => setCriticalHit(false), 2000);
        // 10% chance to trigger a 5-minute 2x bonus event on critical
        if (Math.random() < 0.10 && !bonusEventActive) {
          startBonusEvent();
        }
      }

      const customWeights = getBoxRarityWeights();
      const newLoot = generateLoot(undefined, customWeights);
      setLoot(newLoot);

      // Check if item should be auto-sold
      const shouldAutoSell = hasAutoSell && autoSellRarities.has(newLoot.rarity);

      if (!shouldAutoSell) {
        setInventory((prev) => [...prev, newLoot]);
      }

      // Add to drops history
      setDropsHistory(prev => [newLoot, ...prev].slice(0, 1000));

      // Play sound effect based on rarity
      playChestOpenSound(newLoot.rarity);

      // Award XP based on rarity (2x on critical)
      const xpMultiplier = isCritical ? 2 : 1;
      const { xp: newXp, level: newLevel, coinReward: levelUpCoins } = addXp(xp, level, XP_REWARDS[newLoot.rarity] * xpMultiplier);
      setXp(newXp);
      setLevel(newLevel);

      // Award coins based on rarity + level up bonus + all multipliers (2x on critical)
      const autoSellBonus = shouldAutoSell ? SELL_PRICES[newLoot.rarity] : 0;
      const baseCoins = COIN_REWARDS[newLoot.rarity] + levelUpCoins + autoSellBonus;
      const criticalMultiplier = isCritical ? 2 : 1;
      const earnedCoins = baseCoins * coinMultiplier * criticalMultiplier;
      setCoins((prev) => prev + earnedCoins);

      // Update stats
      setStats((prev) => ({
        totalChestsOpened: prev.totalChestsOpened + 1,
        totalCoinsEarned: prev.totalCoinsEarned + earnedCoins,
        legendariesFound: prev.legendariesFound + (newLoot.rarity === Rarity.Legendary ? 1 : 0),
      }));

      // Update daily challenge progress
      updateChallengeProgress('open_chests', 1);
      updateChallengeProgress('earn_coins', earnedCoins);
      if ([Rarity.Rare, Rarity.Epic, Rarity.Legendary].includes(newLoot.rarity)) {
        updateChallengeProgress('find_rares', 1);
      }
      if (shouldAutoSell) {
        updateChallengeProgress('sell_items', 1);
      }

      // Check for egg drops based on egg upgrades
      // Each upgrade gives a 10% chance to get an egg of that rarity
      const eggChance = 0.1;
      const rarityToCheck: (keyof EggUpgrades)[] = ["common", "uncommon", "rare", "epic", "legendary"];
      for (const rarity of rarityToCheck) {
        if (eggUpgrades[rarity] && Math.random() < eggChance) {
          const newEgg = { rarity: rarity as Rarity, id: crypto.randomUUID() };
          setEggs((prev) => [...prev, newEgg]);
          setRecentEgg(rarity as Rarity);
          // Clear recent egg display after 2 seconds
          setTimeout(() => setRecentEgg(null), 2000);
          break; // Only get one egg per chest
        }
      }

      setTimeout(() => {
        setChestState("closed");
        setIsOpening(false);
      }, 2000);
    }, 500);
  };

  // Spacebar to open chest
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !showInventory && !showShop && !showSettings && !showBattle) {
        e.preventDefault();
        openChest(true); // Manual open - eligible for critical hit
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
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    const sellValue = SELL_PRICES[item.rarity] * coinMultiplier;
    setCoins(prev => prev + sellValue);
    setInventory(prev => prev.filter(i => i.id !== itemId));
    updateChallengeProgress('sell_items', 1);
    updateChallengeProgress('earn_coins', sellValue);
  }, [inventory, coinMultiplier, updateChallengeProgress]);

  const handleBulkSell = useCallback((itemIds: string[]) => {
    const itemsToSell = inventory.filter(i => itemIds.includes(i.id));
    const baseValue = itemsToSell.reduce((total, item) => total + SELL_PRICES[item.rarity], 0);
    const totalValue = baseValue * coinMultiplier;

    setCoins(prev => prev + totalValue);
    setInventory(prev => prev.filter(i => !itemIds.includes(i.id)));
    updateChallengeProgress('sell_items', itemsToSell.length);
    updateChallengeProgress('earn_coins', totalValue);

    return totalValue;
  }, [inventory, coinMultiplier, updateChallengeProgress]);

  // Merge 3 items of same rarity to get 1 of next rarity
  const handleMergeItems = useCallback((itemIds: string[]): LootItem | null => {
    if (itemIds.length !== 3) return null;

    const itemsToMerge = inventory.filter(i => itemIds.includes(i.id));
    if (itemsToMerge.length !== 3) return null;

    // All items must be same rarity
    const rarity = itemsToMerge[0].rarity;
    if (!itemsToMerge.every(i => i.rarity === rarity)) return null;

    // Can't merge legendaries (already max)
    if (rarity === Rarity.Legendary) return null;

    // Get next rarity
    const rarityOrder = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];
    const currentIndex = rarityOrder.indexOf(rarity);
    const nextRarity = rarityOrder[currentIndex + 1];

    // Generate new item of next rarity
    const newItem = generateLootWithGuaranteedRarity(nextRarity);
    if (!newItem) return null;

    // Remove merged items and add new one
    setInventory(prev => [...prev.filter(i => !itemIds.includes(i.id)), newItem]);
    setDropsHistory(prev => [newItem, ...prev].slice(0, 1000));

    return newItem;
  }, [inventory]);

  const playChestOpenSound = (rarity: Rarity) => {
    // Frequency based on rarity
    const frequencies: Record<Rarity, number> = {
      [Rarity.Common]: 200,
      [Rarity.Uncommon]: 300,
      [Rarity.Rare]: 400,
      [Rarity.Epic]: 500,
      [Rarity.Legendary]: 600,
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

    // Add extra "sparkle" for rare items
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
    const save: GameSave = {
      version: SAVE_VERSION,
      lastSaved: Date.now(),
      player: { level, xp, coins },
      inventory,
      upgrades: {
        coinGeneratorLevel,
        luckUpgrade1: luckUpgrades.luckUpgrade1,
        luckUpgrade2: luckUpgrades.luckUpgrade2,
        luckUpgrade3: luckUpgrades.luckUpgrade3,
        hasAutoOpen,
        hasAutoSell,
        autoSellRarities: Array.from(autoSellRarities),
        hasPets,
        eggUpgrades,
      },
      rebirth: {
        tokens: rebirthTokens,
        count: rebirthCount,
      },
      prestige: {
        count: prestigeCount,
      },
      area: currentArea,
      eggs,
      pets,
      equippedPets,
      dropsHistory,
      stats,
      purchasedBoxes,
      battle: {
        wave: battleWave,
        slots: battleSlots,
      },
    };
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, purchasedBoxes, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots]);

  const exportSave = useCallback(() => {
    const save: GameSave = {
      version: SAVE_VERSION,
      lastSaved: Date.now(),
      player: { level, xp, coins },
      inventory,
      upgrades: {
        coinGeneratorLevel,
        luckUpgrade1: luckUpgrades.luckUpgrade1,
        luckUpgrade2: luckUpgrades.luckUpgrade2,
        luckUpgrade3: luckUpgrades.luckUpgrade3,
        hasAutoOpen,
        hasAutoSell,
        autoSellRarities: Array.from(autoSellRarities),
        hasPets,
        eggUpgrades,
      },
      rebirth: {
        tokens: rebirthTokens,
        count: rebirthCount,
      },
      prestige: {
        count: prestigeCount,
      },
      area: currentArea,
      eggs,
      pets,
      equippedPets,
      dropsHistory,
      stats,
      purchasedBoxes,
      battle: {
        wave: battleWave,
        slots: battleSlots,
      },
    };
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lootbox-save-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, purchasedBoxes, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, prestigeCount, currentArea, eggUpgrades, eggs, pets, equippedPets, dropsHistory, battleWave, battleSlots]);

  const importSave = useCallback((data: string): boolean => {
    try {
      const save = JSON.parse(data) as GameSave;
      if (!save.version || !save.player) {
        return false;
      }

      // Load the save data
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
        // Migrate old pets: generate bonus if missing, default count to 1
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
      setBattleWave(save.battle?.wave || 1);
      setBattleSlots(save.battle?.slots || [null, null, null, null, null]);
      setBattleStreak(0);

      // Save to localStorage so it persists
      saveGame(save);
      return true;
    } catch (e) {
      console.error("Failed to import save:", e);
      return false;
    }
  }, []);

  const handleHatchEgg = useCallback((eggId: string) => {
    const egg = eggs.find(e => e.id === eggId);
    if (!egg) return;

    // Remove the egg
    setEggs(prev => prev.filter(e => e.id !== eggId));

    // 50/50 chance for dog or cat
    const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
    const petName = petType === "dog" ? "Dog" : "Cat";

    const bonus = generatePetBonus(petType, egg.rarity);

    // Check if a pet with the same type and rarity already exists
    setPets(prev => {
      const existingPetIndex = prev.findIndex(p => p.type === petType && p.rarity === egg.rarity);
      if (existingPetIndex !== -1) {
        // Stack: increment count and add bonus
        const updated = [...prev];
        updated[existingPetIndex] = {
          ...updated[existingPetIndex],
          bonus: updated[existingPetIndex].bonus + bonus,
          count: updated[existingPetIndex].count + 1,
        };
        return updated;
      } else {
        // Create new pet with count: 1
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
    });
  }, [eggs]);

  const handleHatchAll = useCallback(() => {
    if (eggs.length === 0) return;

    // Process all eggs
    const newPetsMap = new Map<string, Pet>(); // key: "type-rarity"

    eggs.forEach(egg => {
      const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
      const petName = petType === "dog" ? "Dog" : "Cat";
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

    // Clear all eggs
    setEggs([]);

    // Merge new pets with existing pets
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
  }, [eggs]);

  const getRebirthCost = useCallback(() => {
    return Math.floor(200 * Math.pow(1.25, rebirthCount));
  }, [rebirthCount]);

  const handleRebirth = useCallback(() => {
    const cost = getRebirthCost();
    if (coins >= cost) {
      // Reset progress but keep rebirth upgrades
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
      // Reset battle wave and slots
      setBattleWave(1);
      setBattleSlots([null, null, null, null, null]);
      // Award rebirth token
      setRebirthTokens(prev => prev + 1);
      setRebirthCount(prev => prev + 1);
    }
  }, [coins, getRebirthCost]);

  const handlePrestige = useCallback(() => {
    const cost = getPrestigeCost(prestigeCount);
    if (rebirthTokens >= cost) {
      // Reset rebirths and all upgrades
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
      setBattleSlots([null, null, null, null, null]);
      // Keep pets but reset equipped
      setEquippedPets([]);
      // Award prestige
      setPrestigeCount(prev => prev + 1);
    }
  }, [rebirthTokens, prestigeCount]);

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

    // Calculate total shield reduction (shields have negative power)
    let totalShieldReduction = 0;
    for (const slotId of battleSlots) {
      if (slotId) {
        const item = inventory.find(it => it.id === slotId);
        if (item && isShield(item)) {
          totalShieldReduction += Math.abs(getWeaponPower(item)); // Get positive value for reduction
        }
      }
    }
    // Apply full shield reduction to all enemies equally
    const shieldReductionPerEnemy = totalShieldReduction;

    for (let i = 0; i < 5; i++) {
      const slotId = battleSlots[i];
      const item = slotId ? inventory.find(it => it.id === slotId) : null;
      const rawPower = item ? getWeaponPower(item) : 0;
      const baseEnemyPower = generateEnemyPower(battleWave, i);
      // Apply shield reduction to enemy power
      const enemyPowerAfterShield = Math.max(0, baseEnemyPower - shieldReductionPerEnemy);

      if (item && isArmor(item)) {
        // Armor absorbs enemy damage - armor power reduces enemy power for this slot
        const armorPower = rawPower;
        const effectiveEnemyPower = Math.max(0, enemyPowerAfterShield - armorPower);
        // Win if armor fully absorbs the enemy attack
        results.push({
          playerPower: armorPower,
          enemyPower: enemyPowerAfterShield,
          won: armorPower >= enemyPowerAfterShield,
          isArmor: true,
        });
      } else if (item && isShield(item)) {
        // Shields don't fight directly - they already applied their reduction globally
        results.push({
          playerPower: rawPower,
          enemyPower: enemyPowerAfterShield,
          won: false, // Shields alone can't win a slot
        });
      } else {
        // Regular weapons - direct power comparison
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
      // Scale rewards with wave: base 5 + wave number
      let baseCoins = 5 + battleWave;

      // Early wave bonus to encourage new players (waves 1-3 get extra coins)
      if (battleWave <= 3) {
        const earlyWaveBonus = (4 - battleWave) * 3; // Wave 1: +9, Wave 2: +6, Wave 3: +3
        baseCoins += earlyWaveBonus;
      }

      // Streak bonus: +10% per consecutive win (max 100% at 10 streak)
      // Use ref for real-time tracking during rapid battles
      const newStreak = battleStreakRef.current + 1;
      battleStreakRef.current = newStreak;
      const streakBonus = Math.min(newStreak * 0.10, 1.0);

      // Calculate total coins (coinMultiplier includes rebirth + dog pet bonuses)
      const earnedCoins = baseCoins * coinMultiplier * (1 + streakBonus);
      setCoins(prev => prev + earnedCoins);
      setBattleWave(prev => prev + 1);
      setBattleStreak(newStreak);

      // Update daily challenges
      updateChallengeProgress('win_battles', 1);
      updateChallengeProgress('earn_coins', earnedCoins);

      // Streak milestone rewards: bonus item at 5, 10, 15, etc.
      if (newStreak > 0 && newStreak % 5 === 0) {
        // Better rarity for higher streaks
        let streakDropRarity: Rarity;
        if (newStreak >= 15) {
          streakDropRarity = Rarity.Legendary;
        } else if (newStreak >= 10) {
          streakDropRarity = Rarity.Epic;
        } else {
          streakDropRarity = Rarity.Rare;
        }
        const streakDrop = generateLootWithGuaranteedRarity(streakDropRarity);
        if (streakDrop) {
          setInventory(prev => [...prev, streakDrop]);
          setDropsHistory(prev => [streakDrop, ...prev].slice(0, 1000));
        }
      }

      // Chance to drop a guaranteed rare+ item (20% base, +2% per wave, max 50%)
      const dropChance = Math.min(0.20 + (battleWave * 0.02), 0.50);
      if (Math.random() < dropChance) {
        // Higher waves = better drops
        const rarityRoll = Math.random();
        let dropRarity: Rarity;
        if (battleWave >= 10 && rarityRoll < 0.10) {
          dropRarity = Rarity.Legendary;
        } else if (battleWave >= 5 && rarityRoll < 0.30) {
          dropRarity = Rarity.Epic;
        } else {
          dropRarity = Rarity.Rare;
        }

        const battleDrop = generateLootWithGuaranteedRarity(dropRarity);
        if (battleDrop) {
          setInventory(prev => [...prev, battleDrop]);
          setDropsHistory(prev => [battleDrop, ...prev].slice(0, 1000));
          setLastBattleDrop(battleDrop);
          // Clear the drop notification after 3 seconds
          setTimeout(() => setLastBattleDrop(null), 3000);
        }
      }

      return { won, results, streak: newStreak, coinsEarned: earnedCoins };
    } else {
      // Lost - reset streak
      battleStreakRef.current = 0;
      setBattleStreak(0);
    }

    return { won, results, streak: 0 };
  }, [battleSlots, inventory, battleWave, coinMultiplier, updateChallengeProgress]);

  const getChestEmoji = () => {
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
      <XPBar xp={xp} level={level} coins={coins} rebirthTokens={rebirthTokens} showSettings={showSettings} onToggleSettings={() => setShowSettings(!showSettings)} coinGeneratorLevel={coinGeneratorLevel} onManualSave={manualSave} onExportSave={exportSave} onImportSave={importSave} rebirthCount={rebirthCount} stats={stats} totalDogBonus={totalDogBonus} totalCatBonus={totalCatBonus} prestigeCount={prestigeCount} />

      {hasAutoOpen && (
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
          className={`rebirth-btn ${coins >= getRebirthCost() ? '' : 'disabled'}`}
          onClick={handleRebirth}
          disabled={coins < getRebirthCost()}
        >
          <span className="rebirth-icon">🔄</span>
          <span className="rebirth-text">Rebirth</span>
          <span className="rebirth-cost">💰 {formatNumber(getRebirthCost())}</span>
        </button>

        <button
          className={`prestige-btn ${rebirthTokens >= getPrestigeCost(prestigeCount) ? '' : 'disabled'}`}
          onClick={handlePrestige}
          disabled={rebirthTokens < getPrestigeCost(prestigeCount)}
        >
          <span className="prestige-icon">⭐</span>
          <span className="prestige-text">Prestige</span>
          <span className="prestige-cost">🔄 {getPrestigeCost(prestigeCount)}</span>
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
        📜 Drops ({dropsHistory.length})
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
        🎒 Inventory ({inventory.length})
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
          items={inventory}
          onClose={() => setShowInventory(false)}
          onSellItem={handleSellItem}
          onBulkSell={handleBulkSell}
          onMergeItems={handleMergeItems}
          hasAutoSell={hasAutoSell}
          autoSellRarities={autoSellRarities}
          onToggleAutoSellRarity={(rarity) => {
            setAutoSellRarities(prev => {
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
          coins={coins}
          onPurchase={(cost, itemId) => {
            setCoins((prev) => prev - cost);
            // Add the purchased box, replacing any lower tier
            setPurchasedBoxes((prev) => {
              const filtered = prev.filter(box => box !== 'bronze' && box !== 'silver' && box !== 'gold');
              return [...filtered, itemId];
            });
          }}
          purchasedBoxes={purchasedBoxes}
          coinGeneratorLevel={coinGeneratorLevel}
          onUpgradeCoinGenerator={() => {
            const cost = getIdleUpgradeCost(coinGeneratorLevel);
            if (coins >= cost) {
              setCoins((prev) => prev - cost);
              setCoinGeneratorLevel((prev) => prev + 1);
            }
          }}
          luckUpgrades={luckUpgrades}
          onUpgradeLuck={(upgradeId) => {
            const costs = {
              1: getLuckUpgradeCost(4, luckUpgrades.luckUpgrade1),
              2: getLuckUpgradeCost(6, luckUpgrades.luckUpgrade2),
              3: getLuckUpgradeCost(10, luckUpgrades.luckUpgrade3),
            };
            const cost = costs[upgradeId];
            if (coins >= cost) {
              setCoins((prev) => prev - cost);
              setLuckUpgrades((prev) => ({
                ...prev,
                [`luckUpgrade${upgradeId}`]: prev[`luckUpgrade${upgradeId}` as keyof LuckUpgrades] + 1,
              }));
            }
          }}
          hasAutoOpen={hasAutoOpen}
          onBuyAutoOpen={() => {
            if (coins >= 50) {
              setCoins((prev) => prev - 50);
              setHasAutoOpen(true);
            }
          }}
          hasAutoSell={hasAutoSell}
          onBuyAutoSell={() => {
            if (coins >= 25) {
              setCoins((prev) => prev - 25);
              setHasAutoSell(true);
            }
          }}
          hasPets={hasPets}
          onBuyPets={() => {
            if (rebirthTokens >= 3) {
              setRebirthTokens((prev) => prev - 3);
              setHasPets(true);
            }
          }}
          rebirthTokens={rebirthTokens}
          eggUpgrades={eggUpgrades}
          onBuyEggUpgrade={(rarity) => {
            const costs: Record<keyof EggUpgrades, number> = {
              common: 25,
              uncommon: 50,
              rare: 75,
              epic: 100,
              legendary: 250,
            };
            const cost = costs[rarity];
            if (coins >= cost && !eggUpgrades[rarity]) {
              setCoins((prev) => prev - cost);
              setEggUpgrades((prev) => ({ ...prev, [rarity]: true }));
            }
          }}
        />
      )}

      {showPets && (
        <PetsMenu
          onClose={() => setShowPets(false)}
          eggs={eggs}
          pets={pets}
          equippedPets={equippedPets}
          onHatchEgg={handleHatchEgg}
          onHatchAll={handleHatchAll}
          onEquipPet={(petId) => {
            if (equippedPets.length < 6 && !equippedPets.includes(petId)) {
              setEquippedPets([...equippedPets, petId]);
            }
          }}
          onUnequipPet={(petId) => {
            setEquippedPets(equippedPets.filter(id => id !== petId));
          }}
        />
      )}

      {showBattle && (
        <BattleMenu
          onClose={() => setShowBattle(false)}
          inventory={inventory}
          battleSlots={battleSlots}
          onUpdateSlots={setBattleSlots}
          wave={battleWave}
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
          drops={dropsHistory}
          onClose={() => setShowDropsHistory(false)}
          onClear={() => setDropsHistory([])}
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
