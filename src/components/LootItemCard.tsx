import { LootItem, RARITY_COLORS, SELL_PRICES } from "../types";
import { formatStatName } from "../utils/format";
import { ItemIcon } from "./ItemIcon";

interface LootItemCardProps {
  item: LootItem;
  compact?: boolean;
  onView?: () => void;
}

export function LootItemCard({ item, compact = false, onView }: LootItemCardProps) {
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
