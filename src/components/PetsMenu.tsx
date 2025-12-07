import { useState } from "react";
import { Rarity, RARITY_COLORS } from "../types";
import { Pet } from "../game/pets";

type PetsTab = "pets" | "equip-pets" | "open-pets";

interface PetsMenuProps {
  onClose: () => void;
  eggs: { rarity: Rarity; id: string }[];
  pets: Pet[];
  equippedPets: string[];
  onHatchEgg: (eggId: string) => void;
  onHatchAll: () => void;
  onEquipPet: (petId: string) => void;
  onUnequipPet: (petId: string) => void;
  isGalaxy?: boolean;
}

export function PetsMenu({
  onClose,
  eggs,
  pets,
  equippedPets,
  onHatchEgg,
  onHatchAll,
  onEquipPet,
  onUnequipPet,
  isGalaxy = false,
}: PetsMenuProps) {
  const [activeTab, setActiveTab] = useState<PetsTab>("pets");
  const [selectedEgg, setSelectedEgg] = useState<{ rarity: Rarity; id: string } | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);

  const getPetEmoji = (type: "dog" | "cat") => {
    // Use different emojis for galaxy pets
    if (isGalaxy) {
      return type === "dog" ? "🐕‍🦺" : "🐈‍⬛";
    }
    return type === "dog" ? "🐕" : "🐈";
  };

  const renderPetsContent = () => (
    <div className="pets-grid">
      {pets.length === 0 ? (
        <p className="no-pets-message">{isGalaxy ? 'No galaxy pets yet. Hatch some galaxy eggs!' : 'No pets yet. Hatch some eggs!'}</p>
      ) : (
        pets.map((pet) => (
          <div key={pet.id} className="pet-slot has-pet" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
            <div className="pet-slot-content" style={{ borderColor: RARITY_COLORS[pet.rarity] }}>
              <span className="pet-emoji">{getPetEmoji(pet.type)}</span>
              {pet.count > 1 && (
                <span className="pet-count" style={{ backgroundColor: RARITY_COLORS[pet.rarity] }}>
                  x{pet.count}
                </span>
              )}
            </div>
            <span className="pet-name" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.name}</span>
            <span className="pet-bonus" style={{ color: RARITY_COLORS[pet.rarity] }}>
              +{pet.bonus || 0}% {pet.type === "dog" ? (isGalaxy ? 'Galaxy Coins' : 'Coins') : 'Legendary'}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const renderEquipPetsContent = () => {
    // Get unequipped pets for the selection modal
    const unequippedPets = pets.filter(pet => !equippedPets.includes(pet.id));

    return (
      <div className="equip-pets-content">
        <div className="equip-slots-grid">
          {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
            const equippedPetId = equippedPets[slotIndex];
            const equippedPet = equippedPetId ? pets.find(p => p.id === equippedPetId) : null;

            return (
              <div key={slotIndex} className={`equip-slot ${equippedPet ? 'has-pet' : ''}`} style={equippedPet ? { borderColor: RARITY_COLORS[equippedPet.rarity] } : undefined}>
                <div className="equip-slot-content" style={equippedPet ? { borderColor: RARITY_COLORS[equippedPet.rarity] } : undefined}>
                  {equippedPet ? (
                    <span className="pet-emoji">{getPetEmoji(equippedPet.type)}</span>
                  ) : (
                    <span className="equip-slot-empty">?</span>
                  )}
                </div>
                {equippedPet ? (
                  <>
                    <span className="pet-name" style={{ color: RARITY_COLORS[equippedPet.rarity] }}>{equippedPet.name}</span>
                    <span className="pet-bonus" style={{ color: RARITY_COLORS[equippedPet.rarity] }}>
                      +{equippedPet.bonus || 0}% {equippedPet.type === "dog" ? (isGalaxy ? 'Galaxy Coins' : 'Coins') : 'Legendary'}
                    </span>
                    <button className="equip-slot-btn unequip" onClick={() => onUnequipPet(equippedPetId)}>Unequip</button>
                  </>
                ) : (
                  <>
                    <span className="equip-slot-label">Slot {slotIndex + 1}</span>
                    <button
                      className="equip-slot-btn"
                      onClick={() => setSelectingSlot(slotIndex)}
                      disabled={unequippedPets.length === 0}
                    >
                      Equip
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {selectingSlot !== null && (
          <div className="pet-select-overlay" onClick={() => setSelectingSlot(null)}>
            <div className="pet-select-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Select a Pet to Equip</h3>
              <div className="pet-select-grid">
                {unequippedPets.length === 0 ? (
                  <p className="no-pets-message">No unequipped pets available.</p>
                ) : (
                  unequippedPets.map((pet) => (
                    <div
                      key={pet.id}
                      className="pet-select-item"
                      style={{ borderColor: RARITY_COLORS[pet.rarity] }}
                      onClick={() => {
                        onEquipPet(pet.id);
                        setSelectingSlot(null);
                      }}
                    >
                      <span className="pet-emoji">{getPetEmoji(pet.type)}</span>
                      <span className="pet-name" style={{ color: RARITY_COLORS[pet.rarity] }}>{pet.name}</span>
                      <span className="pet-bonus" style={{ color: RARITY_COLORS[pet.rarity] }}>
                        +{pet.bonus || 0}% {pet.type === "dog" ? (isGalaxy ? 'Galaxy Coins' : 'Coins') : 'Legendary'}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button className="pet-select-close" onClick={() => setSelectingSlot(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
                      <span className="egg-slot-emoji">{isGalaxy ? '🪐' : '🥚'}</span>
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
        {eggs.length > 0 && (
          <button className="hatch-all-btn" onClick={onHatchAll}>
            {isGalaxy ? '🪐' : '🥚'} Hatch All ({eggs.length})
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="pets-overlay" onClick={onClose}>
      <div className="pets-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pets-header">
          <h2>{isGalaxy ? '🌌 Galaxy Pets' : 'Pets'}</h2>
          <button className="pets-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="pets-tabs">
          <button
            className={`pets-tab ${activeTab === "pets" ? "active" : ""}`}
            onClick={() => setActiveTab("pets")}
          >
            {isGalaxy ? 'Galaxy Pets' : 'Pets'}
          </button>
          <button
            className={`pets-tab ${activeTab === "equip-pets" ? "active" : ""}`}
            onClick={() => setActiveTab("equip-pets")}
          >
            {isGalaxy ? 'Equip Galaxy' : 'Equip Pets'}
          </button>
          <button
            className={`pets-tab ${activeTab === "open-pets" ? "active" : ""}`}
            onClick={() => setActiveTab("open-pets")}
          >
            {isGalaxy ? 'Galaxy Eggs' : 'Open Pets'}
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
              <span className="hatch-egg-emoji">{isGalaxy ? '🪐' : '🥚'}</span>
              <span className="hatch-egg-rarity" style={{ color: RARITY_COLORS[selectedEgg.rarity] }}>
                {isGalaxy ? 'GALAXY ' : ''}{selectedEgg.rarity.toUpperCase()}
              </span>
            </div>
            <p className="hatch-prompt">Would you like to hatch this {isGalaxy ? 'galaxy ' : ''}egg?</p>
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
