import { LootItem, ItemCategory, Rarity } from "../types";

// Calculate weapon power from stats (shields return negative power, armor returns positive defensive power)
export function getWeaponPower(item: LootItem): number {
  // Rarity multiplier
  const rarityMultiplier: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Uncommon]: 1.5,
    [Rarity.Rare]: 2.5,
    [Rarity.Epic]: 4,
    [Rarity.Legendary]: 7,
  };

  // Shields give negative power (reduces all enemy power globally)
  if (item.category === ItemCategory.Shield) {
    const shieldStats = item.stats as { capacity?: number; rechargeRate?: number; rechargeDelay?: number };
    let shieldPower = 0;
    if (shieldStats.capacity) shieldPower += shieldStats.capacity * 3;
    if (shieldStats.rechargeRate) shieldPower += shieldStats.rechargeRate * 2;
    return -(shieldPower * rarityMultiplier[item.rarity]);
  }

  // Armor gives defensive power (absorbs enemy damage in its slot)
  if (item.category === ItemCategory.Armor) {
    const armorStats = item.stats as { defense?: number; mobility?: number };
    let armorPower = 0;
    if (armorStats.defense) armorPower += armorStats.defense * 4;
    if (armorStats.mobility) armorPower += armorStats.mobility * 1;
    return armorPower * rarityMultiplier[item.rarity];
  }

  // Regular weapons
  const stats = item.stats as { damage?: number; fireRate?: number; accuracy?: number; magazineSize?: number };
  let power = 0;
  if (stats.damage) power += stats.damage * 2;
  if (stats.fireRate) power += stats.fireRate;
  if (stats.accuracy) power += stats.accuracy * 0.5;
  if (stats.magazineSize) power += stats.magazineSize * 0.3;

  return power * rarityMultiplier[item.rarity];
}

// Check if item is a shield
export function isShield(item: LootItem): boolean {
  return item.category === ItemCategory.Shield;
}

// Check if item is armor
export function isArmor(item: LootItem): boolean {
  return item.category === ItemCategory.Armor;
}

// Generate enemy weapon power based on wave
export function generateEnemyPower(wave: number, slotIndex: number): number {
  // Wave 1 is easier to help new players learn the system
  if (wave === 1) {
    const basePower = 25; // Much lower base for first battle
    const variance = (Math.random() - 0.5) * (basePower * 0.4); // Less variance
    const slotBonus = slotIndex * 3; // Smaller slot bonus
    return Math.max(15, Math.round(basePower + variance + slotBonus));
  }

  // Start at 50 base power, increasing by 20 per wave
  const basePower = 50 + (wave - 1) * 20;
  // Add random variance of ±30% of base power for each enemy
  const variance = (Math.random() - 0.5) * (basePower * 0.6);
  // Add slight bonus for later slots (enemies get slightly harder within a wave)
  const slotBonus = slotIndex * 8;
  return Math.max(30, Math.round(basePower + variance + slotBonus));
}
