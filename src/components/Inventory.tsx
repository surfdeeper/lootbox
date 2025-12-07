import { useState, useMemo } from "react";
import { LootItem, Rarity, RARITY_EMOJIS, RARITY_COLORS, SELL_PRICES } from "../types";
import { LootItemCard } from "./LootItemCard";
import { ItemDetailModal } from "./ItemDetailModal";

type RarityFilter = "all" | Rarity;

interface InventoryProps {
  items: LootItem[];
  onClose: () => void;
  onSellItem: (itemId: string) => void;
  onBulkSell: (itemIds: string[]) => number;
  onMergeItems: (itemIds: string[]) => LootItem | null;
  hasAutoSell: boolean;
  autoSellRarities: Set<Rarity>;
  onToggleAutoSellRarity: (rarity: Rarity) => void;
}

export function Inventory({
  items,
  onClose,
  onSellItem,
  onBulkSell,
  onMergeItems,
  hasAutoSell,
  autoSellRarities,
  onToggleAutoSellRarity,
}: InventoryProps) {
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
