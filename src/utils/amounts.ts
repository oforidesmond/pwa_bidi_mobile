import { parseBalance } from '@/utils/funding';

/** Client guidance for buy/fund amounts. Server may still enforce its own max. */
export const AMOUNT_MIN_GHS = 5;

export function isAmountInGuidanceRange(value: number): boolean {
  return Number.isFinite(value) && value >= AMOUNT_MIN_GHS;
}

export function amountGuidanceHint(): string {
  return `Enter an amount of at least GHS ${AMOUNT_MIN_GHS}`;
}

/** How much more is needed to cover `buyAmount` from spendable balance (0 if enough). */
export function walletShortfall(
  buyAmount: number,
  availableBalance: string | number | null | undefined,
): number {
  if (!Number.isFinite(buyAmount) || buyAmount <= 0) return 0;
  const available = parseBalance(availableBalance);
  const raw = buyAmount - available;
  if (raw <= 0) return 0;
  return Math.round(raw * 100) / 100;
}

/**
 * Suggested MoMo top-up for a shortfall: at least the product min, to 2 decimal places.
 */
export function suggestedTopUpAmount(shortfall: number): number {
  if (!Number.isFinite(shortfall) || shortfall <= 0) return AMOUNT_MIN_GHS;
  const clamped = Math.max(shortfall, AMOUNT_MIN_GHS);
  return Math.round(clamped * 100) / 100;
}

/** Format a GHS amount for input (no trailing `.00`). */
export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Heuristic for buy-token (and similar) insufficient-balance API messages. */
export function isInsufficientBalanceMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('insufficient') ||
    lower.includes('not enough') ||
    lower.includes('available balance') ||
    (lower.includes('balance') && lower.includes('low'))
  );
}
