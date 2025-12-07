import { Rarity } from "../types";

export interface Pet {
  id: string;
  name: string;
  type: "dog" | "cat";
  rarity: Rarity;
  bonus: number; // Dogs: +X% coin gen, Cats: +X% legendary drop
  count: number; // Number of stacked pets
}

export interface EggUpgrades {
  common: boolean;
  uncommon: boolean;
  rare: boolean;
  epic: boolean;
  legendary: boolean;
}

// Calculate pet bonus range based on rarity
// Dogs: 5-230% coin generation (scaled by rarity)
// Cats: 5-55% legendary drop chance (scaled by rarity)
export function getPetBonusRange(type: "dog" | "cat", rarity: Rarity): { min: number; max: number } {
  const rarityMultipliers: Record<Rarity, number> = {
    [Rarity.Common]: 0.1,
    [Rarity.Uncommon]: 0.25,
    [Rarity.Rare]: 0.5,
    [Rarity.Epic]: 0.75,
    [Rarity.Legendary]: 1.0,
  };
  const mult = rarityMultipliers[rarity];

  if (type === "dog") {
    // Dogs: 5-230% coin generation
    return { min: 5 + mult * 25, max: 30 + mult * 200 };
  } else {
    // Cats: 5-55% legendary drop chance
    return { min: 5 + mult * 5, max: 10 + mult * 45 };
  }
}

export function generatePetBonus(type: "dog" | "cat", rarity: Rarity): number {
  const { min, max } = getPetBonusRange(type, rarity);
  return Math.round(min + Math.random() * (max - min));
}
