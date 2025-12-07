import { formatNumber } from "../utils/format";

interface PrestigeShopProps {
  onClose: () => void;
  prestigeCount: number;
  permanentCoinGen: number;
  onBuyPermanentCoinGen: () => void;
  currentArea: number;
}

export function PrestigeShop({
  onClose,
  prestigeCount,
  permanentCoinGen,
  onBuyPermanentCoinGen,
  currentArea,
}: PrestigeShopProps) {
  const prestigeCoinGenCost = 1; // 1 prestige token
  const permanentCoinsPerSec = permanentCoinGen * 5;

  return (
    <div className="shop-overlay">
      <div className="shop-modal prestige-shop-modal">
        <div className="shop-header">
          <span className="shop-coins">{currentArea === 2 ? "🌟" : "⭐"} {prestigeCount} {currentArea === 2 ? "Galaxy Prestige" : "Prestige"}</span>
          <button className="shop-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shop-content">
          <h2 className="shop-section-title">
            {currentArea === 2 ? "🌟" : "⭐"} Prestige Upgrades
          </h2>
          <div className="shop-items-grid">
            <div className="shop-item-card">
              <span className="shop-item-emoji">{currentArea === 2 ? "🌟" : "⭐"}</span>
              <h3 className="shop-item-name">Permanent Coin Generator</h3>
              <p className="shop-item-description">
                Generates {currentArea === 2 ? "space coins" : "coins"} automatically forever.
                <br />
                <span className="upgrade-stats">
                  Level: {permanentCoinGen} | +{formatNumber(permanentCoinsPerSec)}/sec (permanent)
                </span>
              </p>
              <button
                className={`shop-buy-btn prestige-currency ${prestigeCount < prestigeCoinGenCost ? "disabled" : ""}`}
                onClick={() => prestigeCount >= prestigeCoinGenCost && onBuyPermanentCoinGen()}
                disabled={prestigeCount < prestigeCoinGenCost}
              >
                {prestigeCount < prestigeCoinGenCost ? `Need ${prestigeCoinGenCost} Prestige` : `${currentArea === 2 ? "🌟" : "⭐"} ${prestigeCoinGenCost} Prestige`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
