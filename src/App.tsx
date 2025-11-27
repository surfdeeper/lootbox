import { useState, useEffect } from "react";
import { generateLoot } from "./generator";
import { LootItem, RARITY_EMOJIS, RARITY_COLORS, Rarity } from "./types";

function LootItemCard({ item, compact = false, onView }: { item: LootItem; compact?: boolean; onView?: () => void }) {
  const emoji = RARITY_EMOJIS[item.rarity];
  const color = RARITY_COLORS[item.rarity];

  if (compact) {
    return (
      <div className={`loot-item-compact rarity-${item.rarity}`}>
        <span className="rarity-emoji">{emoji}</span>
        <span className="loot-name" style={{ color }}>
          {item.name}
        </span>
        <span className="loot-category">{item.category}</span>
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
        <span className="rarity-emoji">{emoji}</span>
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

function ItemDetailModal({ item, onClose }: { item: LootItem; onClose: () => void }) {
  const emoji = RARITY_EMOJIS[item.rarity];
  const color = RARITY_COLORS[item.rarity];

  return (
    <div className="item-detail-overlay" onClick={onClose}>
      <div className="item-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
        <div className={`item-detail-content rarity-${item.rarity}`}>
          <div className="item-detail-header">
            <span className="rarity-emoji large">{emoji}</span>
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
        </div>
      </div>
    </div>
  );
}

function formatStatName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim();
}

type RarityFilter = "all" | Rarity;

function Inventory({
  items,
  onClose,
}: {
  items: LootItem[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [selectedItem, setSelectedItem] = useState<LootItem | null>(null);

  const rarityOrder: Rarity[] = [
    Rarity.Legendary,
    Rarity.Epic,
    Rarity.Rare,
    Rarity.Uncommon,
    Rarity.Common,
  ];

  const filteredItems =
    filter === "all"
      ? [...items].sort(
          (a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
        )
      : items.filter((item) => item.rarity === filter);

  const rarityCounts = items.reduce((acc, item) => {
    acc[item.rarity] = (acc[item.rarity] || 0) + 1;
    return acc;
  }, {} as Record<Rarity, number>);

  return (
    <div className="inventory-overlay" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-header">
          <h2>Inventory</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
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

        <div className="inventory-list">
          {filteredItems.length === 0 ? (
            <p className="empty-inventory">
              {filter === "all"
                ? "No items yet. Open some chests!"
                : `No ${filter} items yet.`}
            </p>
          ) : (
            filteredItems.map((item) => (
              <LootItemCard
                key={item.id}
                item={item}
                compact
                onView={() => setSelectedItem(item)}
              />
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

export default function App() {
  const [loot, setLoot] = useState<LootItem | null>(null);
  const [inventory, setInventory] = useState<LootItem[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [chestState, setChestState] = useState<"closed" | "opening" | "open">("closed");
  const [showInventory, setShowInventory] = useState(false);

  const openChest = () => {
    if (isOpening) return;

    setIsOpening(true);
    setChestState("opening");
    setLoot(null);

    setTimeout(() => {
      setChestState("open");
      const newLoot = generateLoot();
      setLoot(newLoot);
      setInventory((prev) => [...prev, newLoot]);

      setTimeout(() => {
        setChestState("closed");
        setIsOpening(false);
      }, 2000);
    }, 500);
  };

  // Spacebar to open chest
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !showInventory) {
        e.preventDefault();
        openChest();
      }
      if (e.code === "Escape" && showInventory) {
        setShowInventory(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpening, showInventory]);

  const getChestEmoji = () => {
    if (chestState === "open") return "📭";
    return "📦";
  };

  return (
    <div className="app">
      <h1 className="title">Lootbox</h1>

      <button className="inventory-btn" onClick={() => setShowInventory(true)}>
        🎒 Inventory ({inventory.length})
      </button>

      <div className="chest-container" onClick={openChest}>
        <div className={`chest ${chestState}`}>{getChestEmoji()}</div>
        {chestState === "closed" && !isOpening && (
          <p className="hint">Click or press Space to open!</p>
        )}
      </div>

      <div className="loot-display">{loot && <LootItemCard item={loot} />}</div>

      {showInventory && (
        <Inventory items={inventory} onClose={() => setShowInventory(false)} />
      )}
    </div>
  );
}
