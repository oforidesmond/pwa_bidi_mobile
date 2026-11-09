import type { SignalCategory } from '@/theme/bidi-theme';
import type { TokenStatus } from '@/types';

/** Normalize API status to uppercase (empty → ''). */
export function normalizeTokenStatus(status?: string | null): TokenStatus | string {
  return (status || '').toUpperCase();
}

export function isTerminalFulfillment(status?: string | null): boolean {
  const s = normalizeTokenStatus(status);
  return (
    s === 'REDEEMED' ||
    s === 'USED' ||
    s === 'REJECTED' ||
    s === 'REVERSED' ||
    s === 'EXPIRED'
  );
}

export function isActiveToken(status?: string | null): boolean {
  const s = normalizeTokenStatus(status);
  return s === 'ISSUED' || s === 'RESERVED' || s === '';
}

export function tokenStatusLabel(status?: string | null): string {
  switch (normalizeTokenStatus(status)) {
    case 'ISSUED':
    case '':
      return 'Unused';
    case 'RESERVED':
      return 'Reserved';
    case 'REDEEMED':
    case 'USED':
      return 'Redeemed';
    case 'REJECTED':
      return 'Rejected';
    case 'REVERSED':
      return 'Reversed';
    case 'EXPIRED':
      return 'Expired';
    default:
      return normalizeTokenStatus(status) || 'Unknown';
  }
}

export function tokenStatusPill(status?: string | null): string {
  switch (normalizeTokenStatus(status)) {
    case 'ISSUED':
    case '':
      return 'UNUSED';
    case 'RESERVED':
      return 'RESERVED';
    case 'REDEEMED':
    case 'USED':
      return 'REDEEMED';
    case 'REJECTED':
      return 'REJECTED';
    case 'REVERSED':
      return 'REVERSED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return normalizeTokenStatus(status) || 'UNKNOWN';
  }
}

export function tokenStatusCategory(status?: string | null): SignalCategory {
  switch (normalizeTokenStatus(status)) {
    case 'REDEEMED':
    case 'USED':
      return 'redemption';
    case 'REJECTED':
    case 'REVERSED':
      return 'topup';
    case 'RESERVED':
      return 'fuelSale';
    default:
      return 'purchase';
  }
}

export function isRefundedTokenStatus(status?: string | null): boolean {
  const s = normalizeTokenStatus(status);
  return s === 'REJECTED' || s === 'REVERSED';
}
