import { useState } from "react";
import { LuckUpgrades, getLuckUpgradeCost, getIdleUpgradeCost } from "../utils/calculations";
import { EggUpgrades } from "../game/pets";
import { formatNumber } from "../utils/format";

type ShopSection = "idle" | "luck" | "consumables" | "boxes" | "specials";

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

interface ShopProps {
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
}

export function Shop({
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
}: ShopProps) {
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
          {coins < coinGenCost ? `Need ${formatNumber(coinGenCost - coins)} more` : `💰 ${formatNumber(coinGenCost)} Coins`}
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
          {hasAutoOpen ? "✓ Owned" : coins < autoOpenCost ? `Need ${formatNumber(autoOpenCost - coins)} more` : `💰 ${formatNumber(autoOpenCost)} Coins`}
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
          {luckUpgrades.luckUpgrade1 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck1Cost ? `Need ${formatNumber(luck1Cost - coins)} more` : `💰 ${formatNumber(luck1Cost)} Coins`}
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
          {luckUpgrades.luckUpgrade2 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck2Cost ? `Need ${formatNumber(luck2Cost - coins)} more` : `💰 ${formatNumber(luck2Cost)} Coins`}
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
          {luckUpgrades.luckUpgrade3 >= MAX_LUCK_LEVEL ? "MAX" : coins < luck3Cost ? `Need ${formatNumber(luck3Cost - coins)} more` : `💰 ${formatNumber(luck3Cost)} Coins`}
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
                     ? `Need ${formatNumber(box.cost - coins)} more`
                     : `💰 ${formatNumber(box.cost)} Coins`}
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
          {hasAutoSell ? "✓ Owned" : coins < autoSellCost ? `Need ${formatNumber(autoSellCost - coins)} more` : `💰 ${formatNumber(autoSellCost)} Coins`}
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
            {eggUpgrades[rarity] ? "✓ Owned" : coins < cost ? `Need ${formatNumber(cost - coins)} more` : `💰 ${formatNumber(cost)} Coins`}
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
          <span className="shop-coins">💰 {formatNumber(coins)} Coins</span>
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
