# Plan: Unit Tests for XP System

## Goal
Test the XP and leveling logic in `App.tsx`.

## Prerequisite
Extract `addXp` function to a separate utility file (`src/xp.ts`) for easier testing.

## Test File
`src/xp.test.ts`

## Test Cases

### `addXp()`
- Adding XP below threshold keeps same level
- Adding XP to exactly reach threshold triggers level-up
- XP rolls over correctly after level-up
- Multiple level-ups work in single call (e.g., gaining 250 XP at level 1)
- Level thresholds scale correctly (level 1 = 100, level 2 = 200, etc.)

## Example Tests
```ts
describe('addXp', () => {
  it('adds XP without leveling up', () => {
    const result = addXp(0, 1, 50);
    expect(result).toEqual({ xp: 50, level: 1 });
  });

  it('levels up when XP reaches threshold', () => {
    const result = addXp(99, 1, 1);
    expect(result).toEqual({ xp: 0, level: 2 });
  });

  it('rolls over excess XP after level-up', () => {
    const result = addXp(90, 1, 25);
    expect(result).toEqual({ xp: 15, level: 2 });
  });

  it('handles multiple level-ups', () => {
    const result = addXp(0, 1, 350);
    // Level 1: 100 XP needed, Level 2: 200 XP needed = 300 total
    // 350 - 300 = 50 XP remaining at level 3
    expect(result).toEqual({ xp: 50, level: 3 });
  });

  it('uses correct threshold for each level', () => {
    const result = addXp(0, 2, 200);
    expect(result).toEqual({ xp: 0, level: 3 });
  });
});
```
