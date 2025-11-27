import { generateLoot, generateLootBatch, generateLootWithGuaranteedRarity } from "./generator.js";
import { WEAPON_LOOT_TABLE } from "./loot-tables.js";
import { Rarity, RARITY_COLORS, LootItem } from "./types.js";

export { generateLoot, generateLootBatch, generateLootWithGuaranteedRarity } from "./generator.js";
export * from "./types.js";
export * from "./loot-tables.js";

function formatLootItem(item: LootItem): string {
  const color = RARITY_COLORS[item.rarity];
  const statsStr = Object.entries(item.stats)
    .map(([key, value]) => `    ${key}: ${value}`)
    .join("\n");

  return `
[${item.rarity.toUpperCase()}] ${item.name}
  Category: ${item.category}
  ${item.description}
  Stats:
${statsStr}
`;
}

// Demo when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("=== LOOTBOX - Sci-Fi Loot Generator ===\n");

  console.log("--- Single Random Drop ---");
  const singleDrop = generateLoot();
  console.log(formatLootItem(singleDrop));

  console.log("\n--- Batch Drop (5 items) ---");
  const batch = generateLootBatch(5);
  batch.forEach((item) => console.log(formatLootItem(item)));

  console.log("\n--- Guaranteed Legendary Weapon ---");
  const legendary = generateLootWithGuaranteedRarity(Rarity.Legendary, WEAPON_LOOT_TABLE);
  if (legendary) {
    console.log(formatLootItem(legendary));
  } else {
    console.log("No legendary weapons available in loot table");
  }

  console.log("\n--- Rarity Distribution Test (100 drops) ---");
  const testBatch = generateLootBatch(100);
  const distribution: Record<string, number> = {};
  testBatch.forEach((item) => {
    distribution[item.rarity] = (distribution[item.rarity] || 0) + 1;
  });
  console.log("Rarity counts:");
  Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rarity, count]) => {
      console.log(`  ${rarity}: ${count}%`);
    });
}
