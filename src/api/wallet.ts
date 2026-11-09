import type {
  FundingProvider,
  LedgerEntry,
  LedgerListResponse,
  WalletBalance,
  WalletFunding,
} from '@/types';
import { createIdempotencyKey } from './idempotency';
import api from './index';

export const getWalletBalance = async (): Promise<WalletBalance> => {
  const response = await api.get('/wallet/balance');
  return response.data;
};

/**
 * Initiate MoMo collection. Success = prompt started (status PENDING), not balance credited.
 * `phone` is local `0XXXXXXXXX` — backend forwards to Korba `customer_number`.
 * Always send Idempotency-Key; reuse the same key when retrying the same logical top-up.
 */
export const startWalletFunding = async (
  data: { amount: number; provider: FundingProvider; phone: string },
  idempotencyKey = createIdempotencyKey(),
): Promise<WalletFunding> => {
  const response = await api.post(
    '/wallet/funding',
    { amount: data.amount, provider: data.provider, phone: data.phone },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return response.data;
};

/** Poll funding row until terminal status (webhook updates backend). */
export const getWalletFunding = async (fundingId: string): Promise<WalletFunding> => {
  const response = await api.get(`/wallet/funding/${fundingId}`);
  return response.data;
};

/**
 * Forward a Paystack SMS code. Not the MoMo PIN.
 * Pass a new Idempotency-Key for every attempt — reusing a key with a different code is 422.
 */
export const submitWalletFundingOtp = async (
  fundingId: string,
  otp: string,
  idempotencyKey = createIdempotencyKey(),
): Promise<WalletFunding> => {
  const response = await api.post(
    `/wallet/funding/${fundingId}/otp`,
    { otp },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return response.data;
};

export const getWalletLedger = async (
  walletId: string,
  params?: Record<string, string | number | undefined>,
): Promise<LedgerListResponse> => {
  const response = await api.get(`/wallet/driver/${walletId}/ledger`, { params });
  return response.data;
};

/** Full ledger row (same shape as list items, including full metadata). */
export const getWalletLedgerEntry = async (
  walletId: string,
  entryId: string,
): Promise<LedgerEntry> => {
  const response = await api.get(`/wallet/driver/${walletId}/ledger/${entryId}`);
  return response.data;
};

export function formatMoney(value: string | number | null | undefined, currency = 'GHS'): string {
  if (value == null || value === '') return `${currency} —`;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return `${currency} ${value}`;
  return `${currency} ${n.toFixed(2)}`;
}
