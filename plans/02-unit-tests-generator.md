# Plan: Unit Tests for Generator

## Goal
Test the loot generation logic in `generator.ts`.

## Test File
`src/generator.test.ts`

## Test Cases

### `generateLoot()`
- Returns object with all required LootItem fields (id, name, description, category, rarity, stats)
- Generated ID is unique across multiple calls
- Name includes rarity prefix
- Rarity is one of the valid Rarity enum values

### `generateStats()`
- Returns stats within expected ranges
- Higher rarity items have higher stat values (due to multipliers)
- All stat keys from statRanges are present in output

### `weightedRandomSelect()`
- Returns items from the provided array
- Statistical test: over 1000 runs, distribution roughly matches weights (within tolerance)

### `generateLootBatch()`
- Returns array of specified length
- Each item is a valid LootItem

### `generateLootWithGuaranteedRarity()`
- Returns item with the specified rarity
- Returns null if no items support that rarity

## Example Test
```ts
describe('generateLoot', () => {
  it('returns a valid LootItem with all required fields', () => {
    const item = generateLoot();

    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('category');
    expect(item).toHaveProperty('rarity');
    expect(item).toHaveProperty('stats');
    expect(Object.values(Rarity)).toContain(item.rarity);
  });
});
```
