# Plan: End-to-End Tests for User Flows

## Goal
Test complete user interactions from start to finish.

## Options
- Vitest + React Testing Library (lighter weight, faster)
- Playwright or Cypress (real browser, visual testing)

## Test File
`src/App.test.tsx` or `e2e/app.spec.ts`

## Test Cases

### Chest Opening Flow
1. Initial state: chest is closed, XP is 0, level is 1, inventory empty
2. Click chest → chest animates (has "opening" class)
3. After animation → loot item appears
4. Loot item has valid name, rarity, stats
5. Inventory count increases by 1
6. XP increases based on rarity

### XP and Leveling Flow
1. Start at level 1, 0 XP
2. Open chests until XP reaches 100
3. Verify level changes to 2
4. Verify XP bar resets and shows new threshold (200)

### Inventory Flow
1. Open several chests to get items
2. Click inventory button → modal opens
3. Verify all items are listed
4. Click rarity filter → only matching items shown
5. Click item → detail modal opens
6. Press Escape → modal closes

### Keyboard Controls
1. Press Space → chest opens
2. Press Escape while inventory open → inventory closes

## Example Test
```tsx
describe('Chest Opening', () => {
  it('opens chest and shows loot on click', async () => {
    render(<App />);

    const chest = screen.getByText('📦').parentElement;
    fireEvent.click(chest);

    // Wait for animation and loot to appear
    await waitFor(() => {
      expect(screen.getByClassName('loot-item')).toBeInTheDocument();
    });

    // Inventory should update
    expect(screen.getByText(/Inventory \(1\)/)).toBeInTheDocument();
  });
});
```
