import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { generateLoot } from "./generator";
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
}

function PetsMenu({
  onClose,
  eggs,
  pets,
  onHatchEgg
}: {
  onClose: () => void;
  eggs: { rarity: Rarity; id: string }[];
  pets: Pet[];
  onHatchEgg: (eggId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<PetsTab>("pets");
  const [selectedEgg, setSelectedEgg] = useState<{ rarity: Rarity; id: string } | null>(null);

  const renderPetsContent = () => (
    <div className="pets-grid">
      {pets.length === 0 ? (
        <p className="no-pets-message">No pets yet. Hatch some eggs!</p>
      ) : (
        pets.map((pet) => (
          <div key={pet.id} className="pet-slot has-pet" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
            <div className="pet-slot-content" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
              <span className="pet-emoji">{pet.type === "dog" ? "🐕" : "🐈"}</span>
            </div>
            <span className="pet-name" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.name}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderEquipPetsContent = () => (
    <div className="equip-pets-content">
      <div className="equip-slots-grid">
        {[1, 2, 3, 4, 5, 6].map((slot) => (
          <div key={slot} className="equip-slot">
            <div className="equip-slot-content">
              <span className="equip-slot-empty">?</span>
            </div>
            <span className="equip-slot-label">Slot {slot}</span>
            <button className="equip-slot-btn">Equip</button>
          </div>
        ))}
      </div>
    </div>
  );

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

function Inventory({
  items,
  onClose,
  onSellItem,
  onBulkSell,
  hasAutoSell,
  autoSellRarities,
  onToggleAutoSellRarity,
}: {
  items: LootItem[];
  onClose: () => void;
  onSellItem: (itemId: string) => void;
  onBulkSell: (itemIds: string[]) => number;
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
    if (bulkSellMode) {
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
              }}
            >
              {compareMode ? '✓ Compare Mode' : '⚖️ Compare'}
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
              return (
                <div key={item.id} className={`inventory-item-wrapper ${isSelectedCompare ? 'selected-for-compare' : ''} ${isSelectedSell ? 'selected-for-sell' : ''}`}>
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
    </div>
  );
}

function XPBar({ xp, level, coins, rebirthTokens, showSettings, onToggleSettings, coinGeneratorLevel, onManualSave, rebirthCount }: { xp: number; level: number; coins: number; rebirthTokens: number; showSettings: boolean; onToggleSettings: () => void; coinGeneratorLevel: number; onManualSave: () => void; rebirthCount: number }) {
  const xpForNextLevel = level * 100;
  const progress = (xp / xpForNextLevel) * 100;
  const [activeSettingsTab, setActiveSettingsTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const coinsPerSecond = coinGeneratorLevel * 0.01;

  const handleManualSave = () => {
    onManualSave();
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
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
            >
              ⌨️
            </button>
            <button 
              className="settings-tab-btn"
              onClick={handleManualSave}
              title="Manual Save"
            >
              💾
            </button>
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
        </div>
      )}
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="coins-display">
        <span className="coins-text">💰 {coins.toFixed(2)} Coins</span>
        {coinsPerSecond > 0 && (
          <span className="coin-rate">+{coinsPerSecond.toFixed(2)}/s</span>
        )}
      </div>
      {rebirthCount > 0 && (
        <div className="rebirth-bonus-display">
          <span className="rebirth-bonus-text">+{rebirthCount * 10}% Coin Bonus</span>
        </div>
      )}
      <div className="rebirth-tokens-display">
        <span className="rebirth-tokens-text">🔄 {rebirthTokens} Rebirth Tokens</span>
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
  const [recentEgg, setRecentEgg] = useState<Rarity | null>(null);
  const [levelUpNotification, setLevelUpNotification] = useState<number | null>(null);
  const [recentDrops, setRecentDrops] = useState<LootItem[]>([]);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [usedCheatCode, setUsedCheatCode] = useState(false);
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
      setPets((save.pets || []).map(p => ({ ...p, rarity: p.rarity as Rarity, type: p.type as "dog" | "cat" })));
      setRebirthTokens(save.rebirth?.tokens || 0);
      setRebirthCount(save.rebirth?.count || 0);

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
      eggs,
      pets,
      stats,
      purchasedBoxes,
    };
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, isLoaded, purchasedBoxes, usedCheatCode, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, eggUpgrades, eggs, pets]);

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

  // Idle coin generation
  useEffect(() => {
    if (coinGeneratorLevel <= 0) return;

    const interval = setInterval(() => {
      const baseCoinsPerSecond = coinGeneratorLevel * 0.01;
      const rebirthBonus = rebirthCount * 0.10; // 10% per rebirth
      const coinsPerSecond = baseCoinsPerSecond * (1 + rebirthBonus);
      setCoins((prev) => prev + coinsPerSecond / 10); // Divide by 10 since we run 10 times per second
    }, 100);

    return () => clearInterval(interval);
  }, [coinGeneratorLevel, rebirthCount]);

  // Auto-open chests
  useEffect(() => {
    if (!hasAutoOpen || !isLoaded) return;

    const interval = setInterval(() => {
      // Only auto-open if not currently opening and no modals are open
      if (!isOpening && !showInventory && !showShop) {
        openChest();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasAutoOpen, isLoaded, isOpening, showInventory, showShop]);

  const getBoxRarityWeights = useCallback((): Record<Rarity, number> => {
    const baseWeights = calculateRarityWeights(luckUpgrades);
    
    // Apply box upgrades on top of luck upgrades
    if (purchasedBoxes.includes('gold')) {
      // Gold box: +15% epic, +5% legendary, -20% common
      return {
        ...baseWeights,
        [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 20),
        [Rarity.Epic]: baseWeights[Rarity.Epic] + 15,
        [Rarity.Legendary]: baseWeights[Rarity.Legendary] + 5,
      };
    } else if (purchasedBoxes.includes('silver')) {
      // Silver box: +10% rare, +5% uncommon, -15% common
      return {
        ...baseWeights,
        [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 15),
        [Rarity.Uncommon]: baseWeights[Rarity.Uncommon] + 5,
        [Rarity.Rare]: baseWeights[Rarity.Rare] + 10,
      };
    } else if (purchasedBoxes.includes('bronze')) {
      // Bronze box: +8% uncommon, -8% common
      return {
        ...baseWeights,
        [Rarity.Common]: Math.max(0, baseWeights[Rarity.Common] - 8),
        [Rarity.Uncommon]: baseWeights[Rarity.Uncommon] + 8,
      };
    }
    
    return baseWeights;
  }, [luckUpgrades, purchasedBoxes]);

  const openChest = () => {
    if (isOpening) return;

    setIsOpening(true);
    setChestState("opening");
    setLoot(null);

    setTimeout(() => {
      setChestState("open");
      const customWeights = getBoxRarityWeights();
      const newLoot = generateLoot(undefined, customWeights);
      setLoot(newLoot);

      // Check if item should be auto-sold
      const shouldAutoSell = hasAutoSell && autoSellRarities.has(newLoot.rarity);

      if (!shouldAutoSell) {
        setInventory((prev) => [...prev, newLoot]);
      }

      // Add to recent drops (keep last 5)
      setRecentDrops(prev => [newLoot, ...prev].slice(0, 5));

      // Play sound effect based on rarity
      playChestOpenSound(newLoot.rarity);

      // Award XP based on rarity
      const { xp: newXp, level: newLevel, coinReward: levelUpCoins } = addXp(xp, level, XP_REWARDS[newLoot.rarity]);
      setXp(newXp);
      setLevel(newLevel);

      // Award coins based on rarity + level up bonus + rebirth bonus
      const autoSellBonus = shouldAutoSell ? SELL_PRICES[newLoot.rarity] : 0;
      const baseCoins = COIN_REWARDS[newLoot.rarity] + levelUpCoins + autoSellBonus;
      const rebirthBonus = rebirthCount * 0.10; // 10% per rebirth
      const earnedCoins = baseCoins * (1 + rebirthBonus);
      setCoins((prev) => prev + earnedCoins);

      // Update stats
      setStats((prev) => ({
        totalChestsOpened: prev.totalChestsOpened + 1,
        totalCoinsEarned: prev.totalCoinsEarned + earnedCoins,
        legendariesFound: prev.legendariesFound + (newLoot.rarity === Rarity.Legendary ? 1 : 0),
      }));

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
      if (e.code === "Space" && !showInventory && !showShop && !showSettings) {
        e.preventDefault();
        openChest();
      }
      if (e.code === "Escape") {
        if (showInventory) setShowInventory(false);
        if (showShop) setShowShop(false);
        if (showSettings) setShowSettings(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpening, showInventory, showShop, showSettings]);

  const handleSellItem = useCallback((itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    setCoins(prev => prev + SELL_PRICES[item.rarity]);
    setInventory(prev => prev.filter(i => i.id !== itemId));
  }, [inventory]);

  const handleBulkSell = useCallback((itemIds: string[]) => {
    const itemsToSell = inventory.filter(i => itemIds.includes(i.id));
    const totalValue = itemsToSell.reduce((total, item) => total + SELL_PRICES[item.rarity], 0);

    setCoins(prev => prev + totalValue);
    setInventory(prev => prev.filter(i => !itemIds.includes(i.id)));

    return totalValue;
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
      eggs,
      pets,
      stats,
      purchasedBoxes,
    };
    saveGame(save);
  }, [level, xp, coins, inventory, coinGeneratorLevel, luckUpgrades, stats, purchasedBoxes, hasAutoOpen, hasAutoSell, autoSellRarities, hasPets, rebirthTokens, rebirthCount, eggUpgrades, eggs, pets]);

  const handleHatchEgg = useCallback((eggId: string) => {
    const egg = eggs.find(e => e.id === eggId);
    if (!egg) return;

    // Remove the egg
    setEggs(prev => prev.filter(e => e.id !== eggId));

    // 50/50 chance for dog or cat
    const petType: "dog" | "cat" = Math.random() < 0.5 ? "dog" : "cat";
    const petName = petType === "dog" ? "Dog" : "Cat";

    const newPet: Pet = {
      id: crypto.randomUUID(),
      name: petName,
      type: petType,
      rarity: egg.rarity,
    };

    setPets(prev => [...prev, newPet]);
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
      setRecentDrops([]);
      setEggUpgrades({ common: false, uncommon: false, rare: false, epic: false, legendary: false });
      // Award rebirth token
      setRebirthTokens(prev => prev + 1);
      setRebirthCount(prev => prev + 1);
    }
  }, [coins, getRebirthCost]);

  const getChestEmoji = () => {
    if (chestState === "open") return "📭";
    if (purchasedBoxes.includes('gold')) return "🥇";
    if (purchasedBoxes.includes('silver')) return "🥈";
    if (purchasedBoxes.includes('bronze')) return "🥉";
    return "📦";
  };

  const handleCodeSubmit = () => {
    if (codeValue === "1337") {
      setCoins((prev) => prev + 1000);
      setRebirthTokens((prev) => prev + 10);
      setUsedCheatCode(true);
      setCodeValue("");
      setShowCodeInput(false);
    }
  };

  return (
    <div className="app">
      <div className="version-tracker">vs: 1.00</div>
      <XPBar xp={xp} level={level} coins={coins} rebirthTokens={rebirthTokens} showSettings={showSettings} onToggleSettings={() => setShowSettings(!showSettings)} coinGeneratorLevel={coinGeneratorLevel} onManualSave={manualSave} rebirthCount={rebirthCount} />

      <button
        className={`rebirth-btn ${coins >= getRebirthCost() ? '' : 'disabled'}`}
        onClick={handleRebirth}
        disabled={coins < getRebirthCost()}
      >
        <span className="rebirth-icon">🔄</span>
        <span className="rebirth-text">Rebirth</span>
        <span className="rebirth-cost">💰 {getRebirthCost()}</span>
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

      {recentDrops.length > 0 && (
        <div className="recent-drops">
          <h3>Recent Drops</h3>
          <div className="recent-drops-list">
            {recentDrops.map((item, index) => (
              <div key={`${item.id}-${index}`} className="recent-drop-item" style={{ borderColor: RARITY_COLORS[item.rarity] }}>
                <ItemIcon category={item.category} color={RARITY_COLORS[item.rarity]} size={20} />
                <span className="recent-drop-name" style={{ color: RARITY_COLORS[item.rarity] }}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="shop-btn" onClick={() => setShowShop(true)}>
        🛒 Shop
      </button>

      <button className="inventory-btn" onClick={() => setShowInventory(true)}>
        🎒 Inventory ({inventory.length})
      </button>

      <div className="chest-container" onClick={openChest}>
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
        <PetsMenu onClose={() => setShowPets(false)} eggs={eggs} pets={pets} onHatchEgg={handleHatchEgg} />
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
