# Plan: Integration Tests for React Components

## Goal
Test React components render correctly with React Testing Library.

## Test Files
- `src/components/XPBar.test.tsx`
- `src/components/LootItemCard.test.tsx`
- `src/components/Inventory.test.tsx`

## Prerequisite
Extract components to separate files in `src/components/` for cleaner testing.

## Test Cases

### `XPBar`
- Displays correct level number
- Shows correct XP / max XP text
- Progress bar width matches XP percentage
- Updates when props change

### `LootItemCard`
- Renders item name with correct color for rarity
- Shows rarity emoji
- Displays all stats
- Compact mode shows condensed view
- View button triggers onView callback

### `LootItemCard` (detailed view)
- Shows description
- Shows category
- Stat bars render with correct widths

### `Inventory`
- Shows correct total item count
- Filter tabs show correct counts per rarity
- Clicking filter shows only items of that rarity
- Empty state shows when no items
- Clicking item opens detail modal

## Example Test
```tsx
describe('XPBar', () => {
  it('displays the correct level', () => {
    render(<XPBar xp={50} level={3} />);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('shows correct XP progress', () => {
    render(<XPBar xp={150} level={2} />);
    expect(screen.getByText('150 / 200 XP')).toBeInTheDocument();
  });

  it('sets correct progress bar width', () => {
    render(<XPBar xp={50} level={1} />);
    const bar = screen.getByTestId('xp-bar-fill');
    expect(bar).toHaveStyle({ width: '50%' });
  });
});
```
