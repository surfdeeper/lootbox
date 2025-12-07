import { MAX_SAFE_COINS } from "../constants/gameBalance";

/**
 * Safely adds coins, preventing overflow beyond MAX_SAFE_INTEGER.
 * Returns the new coin value capped at the maximum safe value.
 */
export function safeAddCoins(currentCoins: number, amount: number): number {
  const newValue = currentCoins + amount;

  // Check for overflow
  if (newValue > MAX_SAFE_COINS) {
    console.warn(`Coin overflow prevented: ${currentCoins} + ${amount} would exceed MAX_SAFE_INTEGER`);
    return MAX_SAFE_COINS;
  }

  // Also check for NaN or Infinity
  if (!Number.isFinite(newValue)) {
    console.error(`Invalid coin calculation: ${currentCoins} + ${amount} = ${newValue}`);
    return currentCoins;
  }

  return newValue;
}

/**
 * Safely subtracts coins, preventing negative values.
 * Returns the new coin value, minimum 0.
 */
export function safeSubtractCoins(currentCoins: number, amount: number): number {
  const newValue = currentCoins - amount;

  if (newValue < 0) {
    return 0;
  }

  if (!Number.isFinite(newValue)) {
    console.error(`Invalid coin calculation: ${currentCoins} - ${amount} = ${newValue}`);
    return currentCoins;
  }

  return newValue;
}
