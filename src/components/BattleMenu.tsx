import { useState } from "react";
import { LootItem, ItemCategory, RARITY_COLORS } from "../types";
import { getWeaponPower, isShield, isArmor } from "../game/battle";
import { ItemIcon } from "./ItemIcon";

interface BattleMenuProps {
  onClose: () => void;
  inventory: LootItem[];
  battleSlots: (string | null)[];
  onUpdateSlots: (slots: (string | null)[]) => void;
  wave: number;
  streak: number;
  rebirthCount: number;
  onBattle: () => { won: boolean; results: { playerPower: number; enemyPower: number; won: boolean }[]; streak?: number; coinsEarned?: number };
}

export function BattleMenu({
  onClose,
  inventory,
  battleSlots,
  onUpdateSlots,
  wave,
  streak,
  rebirthCount,
  onBattle,
}: BattleMenuProps) {
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
