import { LootItem, RARITY_COLORS, SELL_PRICES } from "../types";
import { formatStatName } from "../utils/format";
import { ItemIcon } from "./ItemIcon";

interface ItemDetailModalProps {
  item: LootItem;
  onClose: () => void;
  onSell?: () => void;
}

export function ItemDetailModal({ item, onClose, onSell }: ItemDetailModalProps) {
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
