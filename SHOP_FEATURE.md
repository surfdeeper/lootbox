# Shop Feature

## Overview

Added a shop button and fullscreen shop menu to the lootbox application.

## Components Added

### Shop Button
- Located in the bottom left corner
- Displays cart emoji: 🛒 Shop
- Orange border styling to differentiate from the blue inventory button
- Hover effect with scale and background color change

### Shop Modal
A fullscreen overlay containing:

#### Close Button
- Circular X button in the top right corner
- Turns red on hover
- Also closes with Escape key

#### Section Tabs (5 sections)
| Section | Emoji | Description |
|---------|-------|-------------|
| Weapons | ⚔️ | Weapon items |
| Armor | 🛡️ | Armor items |
| Consumables | 🧪 | Consumable items |
| Materials | 💎 | Crafting materials |
| Specials | ✨ | Special items |

- Tabs display at the top of the screen
- Active tab has orange glow effect
- Clicking tabs switches the displayed section

## Files Modified

- `src/App.tsx` - Added Shop component, state management, and button
- `src/styles.css` - Added shop-related CSS styles

## Keyboard Shortcuts

- `Escape` - Close the shop menu (when open)
- Spacebar is disabled while shop is open to prevent chest opening
