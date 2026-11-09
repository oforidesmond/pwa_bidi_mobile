import type { FundingProvider } from '@/types';

export type FundingProviderOption = {
  value: FundingProvider;
  label: string;
  shortLabel: string;
};

/** Labels for pending UI / badges (detection drives provider, not chip picker). */
export const FUNDING_PROVIDERS: FundingProviderOption[] = [
  { value: 'MTN_MOMO', label: 'MTN MoMo', shortLabel: 'MTN' },
  { value: 'VODAFONE_CASH', label: 'Telecel Cash', shortLabel: 'Telecel' },
  { value: 'AIRTELTIGO_MONEY', label: 'AT Money', shortLabel: 'AT' },
];

/** Storage key prefix; append `:${userId}`. */
export const PENDING_FUNDING_STORAGE_PREFIX = 'pending_wallet_funding';

/** How long to show "Awaiting approval" before "Still waiting" (MoMo prompts die fast). */
export const PENDING_FUNDING_TTL_MS = 5 * 60 * 1000;

/** Faster poll while the handset prompt is most likely still open (Paystack ~180s). */
export const FUNDING_POLL_FAST_MS = 5_000;
export const FUNDING_POLL_FAST_WINDOW_MS = 180_000;
export const FUNDING_POLL_SLOW_MS = 12_000;

export function fundingProviderLabel(provider: FundingProvider | string | undefined): string {
  const match = FUNDING_PROVIDERS.find((p) => p.value === provider);
  return match?.label ?? provider ?? 'Mobile Money';
}

export function pendingFundingStorageKey(userId: string): string {
  return `${PENDING_FUNDING_STORAGE_PREFIX}:${userId}`;
}

/** Mask MSISDN for UI, e.g. 0241234567 → 024***4567 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  const start = digits.slice(0, 3);
  const end = digits.slice(-4);
  return `${start}***${end}`;
}
