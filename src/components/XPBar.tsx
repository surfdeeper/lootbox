import { useState, useRef } from "react";
import { formatNumber } from "../utils/format";

interface XPBarProps {
  xp: number;
  level: number;
  coins: number;
  rebirthTokens: number;
  showSettings: boolean;
  onToggleSettings: () => void;
  coinGeneratorLevel: number;
  onManualSave: () => void;
  onExportSave: () => void;
  onImportSave: (data: string) => boolean;
  rebirthCount: number;
  stats: { totalChestsOpened: number; totalCoinsEarned: number; legendariesFound: number };
  totalDogBonus: number;
  totalCatBonus: number;
  prestigeCount: number;
  currentArea: number;
  // Galaxy state
  galaxyRebirthTokens: number;
  galaxyRebirthCount: number;
  galaxyPrestigeCount: number;
  totalGalaxyDogBonus: number;
}

export function XPBar({
  xp,
  level,
  coins,
  rebirthTokens,
  showSettings,
  onToggleSettings,
  coinGeneratorLevel,
  onManualSave,
  onExportSave,
  onImportSave,
  rebirthCount,
  stats,
  totalDogBonus,
  totalCatBonus,
  prestigeCount,
  currentArea,
  galaxyRebirthTokens,
  galaxyRebirthCount,
  galaxyPrestigeCount,
  totalGalaxyDogBonus,
}: XPBarProps) {
  const xpForNextLevel = level * 100;
  const progress = (xp / xpForNextLevel) * 100;
  const [activeSettingsTab, setActiveSettingsTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const baseCoinsPerSecond = coinGeneratorLevel * 0.01;
  // Use galaxy bonuses in area 2
  const effectiveRebirthBonus = currentArea === 2 ? galaxyRebirthCount * 0.10 : rebirthCount * 0.10;
  const effectivePrestigeBonus = currentArea === 2 ? galaxyPrestigeCount * 1.0 : prestigeCount * 1.0;
  const effectiveDogBonus = currentArea === 2 ? totalGalaxyDogBonus / 100 : totalDogBonus / 100;
  const coinsPerSecond = baseCoinsPerSecond * (1 + effectiveRebirthBonus + effectivePrestigeBonus + effectiveDogBonus);
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
        <span className="coins-text">{currentArea === 2 ? '🪐' : '💰'} {formatNumber(coins)} {currentArea === 2 ? 'Space Coins' : 'Coins'}</span>
        {coinsPerSecond > 0 && (
          <span className="coin-rate">+{formatNumber(coinsPerSecond)}/s</span>
        )}
      </div>
      {currentArea === 1 ? (
        // Area 1: Show normal bonuses
        (rebirthCount > 0 || prestigeCount > 0 || totalDogBonus > 0 || totalCatBonus > 0) && (
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
        )
      ) : (
        // Area 2: Show galaxy bonuses only
        (galaxyRebirthCount > 0 || galaxyPrestigeCount > 0 || totalGalaxyDogBonus > 0) && (
          <div className="bonuses-display">
            {galaxyPrestigeCount > 0 && (
              <span className="prestige-bonus-text">+{galaxyPrestigeCount * 100}% Galaxy Prestige</span>
            )}
            {galaxyRebirthCount > 0 && (
              <span className="rebirth-bonus-text">+{galaxyRebirthCount * 10}% Galaxy Rebirth</span>
            )}
            {totalGalaxyDogBonus > 0 && (
              <span className="dog-bonus-text">+{totalGalaxyDogBonus}% Galaxy Coins</span>
            )}
          </div>
        )
      )}
      <div className="rebirth-tokens-display">
        {currentArea === 1 ? (
          <>
            <span className="rebirth-tokens-text">🔄 {rebirthTokens} Rebirth Tokens</span>
            {prestigeCount > 0 && (
              <span className="prestige-count-text">⭐ {prestigeCount} Prestige</span>
            )}
          </>
        ) : (
          <>
            <span className="rebirth-tokens-text">🌌 {galaxyRebirthTokens} Galaxy Rebirth Tokens</span>
            {galaxyPrestigeCount > 0 && (
              <span className="prestige-count-text">🌟 {galaxyPrestigeCount} Galaxy Prestige</span>
            )}
          </>
        )}
      </div>
      <h1 className="title">Lootbox</h1>
    </div>
  );
}
