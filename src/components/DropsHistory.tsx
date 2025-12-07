import { useState, useMemo } from "react";
import { LootItem, Rarity, RARITY_EMOJIS, RARITY_COLORS } from "../types";
import { ItemIcon } from "./ItemIcon";
import { ItemDetailModal } from "./ItemDetailModal";

type RarityFilter = "all" | Rarity;
type SortOrder = "newest" | "oldest";

interface DropsHistoryProps {
  drops: LootItem[];
  onClose: () => void;
  onClear: () => void;
}

export function DropsHistory({
  drops,
  onClose,
  onClear,
}: DropsHistoryProps) {
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
