import type { FundingNextAction, FundingProvider, FundingStatus, WalletFunding } from '@/types';
import {
  FUNDING_POLL_FAST_MS,
  FUNDING_POLL_FAST_WINDOW_MS,
  FUNDING_POLL_SLOW_MS,
  PENDING_FUNDING_TTL_MS,
} from '@/constants/funding';

export type PendingFunding = {
  fundingId: string;
  amount: number;
  provider: FundingProvider;
  /** Local `0XXXXXXXXX` that received the MoMo prompt. */
  phone: string;
  baselineAvailable: number;
  submittedAt: number;
  nextAction?: FundingNextAction | string | null;
  displayText?: string | null;
};

export const OTP_SHEET_FALLBACK_TITLE = 'Please enter the OTP sent to your phone';

export const APPROVE_ON_PHONE_COPY =
  'Approve the prompt on your phone and enter your MoMo PIN.';

export const CONFIRMING_PAYMENT_COPY = 'Confirming payment…';

/** Shown under the SMS field so it is not confused with the handset PIN. */
export const OTP_NOT_PIN_HINT = 'This is the SMS code, not your MoMo PIN.';

export function parseBalance(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True when available balance has clearly risen past the pre-funding baseline. */
export function isFundingSettled(
  availableBalance: string | number | null | undefined,
  baselineAvailable: number,
): boolean {
  return parseBalance(availableBalance) > baselineAvailable + 0.001;
}

export function isFundingSuccessful(status: FundingStatus | string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === 'SUCCESSFUL';
}

export function isTerminalFundingFailure(
  status: FundingStatus | string | null | undefined,
): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'FAILED' || s === 'CANCELLED' || s === 'EXPIRED';
}

export function fundingTerminalFailureCopy(
  status: FundingStatus | string | null | undefined,
  failureReason?: string | null,
): string {
  if (failureReason && failureReason.trim()) return failureReason.trim();
  const s = String(status ?? '').toUpperCase();
  if (s === 'CANCELLED') return 'Payment was cancelled.';
  if (s === 'EXPIRED') return 'The Mobile Money prompt expired before approval.';
  return 'Payment was not completed.';
}

export function isPendingFundingExpired(
  submittedAt: number,
  now = Date.now(),
  ttlMs = PENDING_FUNDING_TTL_MS,
): boolean {
  return now - submittedAt >= ttlMs;
}

export function fundingPollIntervalMs(submittedAt: number, now = Date.now()): number {
  return now - submittedAt < FUNDING_POLL_FAST_WINDOW_MS
    ? FUNDING_POLL_FAST_MS
    : FUNDING_POLL_SLOW_MS;
}

export function truncateFundingId(id: string, keep = 8): string {
  if (id.length <= keep + 1) return id;
  return `${id.slice(0, keep)}…`;
}

export function isValidPendingFunding(value: unknown): value is PendingFunding {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.nextAction != null && typeof v.nextAction !== 'string') return false;
  if (v.displayText != null && typeof v.displayText !== 'string') return false;
  return (
    typeof v.fundingId === 'string' &&
    v.fundingId.length > 0 &&
    typeof v.amount === 'number' &&
    Number.isFinite(v.amount) &&
    typeof v.provider === 'string' &&
    typeof v.phone === 'string' &&
    typeof v.baselineAvailable === 'number' &&
    typeof v.submittedAt === 'number'
  );
}

export function normalizeFundingNextAction(
  value: FundingNextAction | string | null | undefined,
): FundingNextAction {
  const s = String(value ?? '').toLowerCase();
  if (s === 'submit_otp') return 'submit_otp';
  if (s === 'approve_on_phone') return 'approve_on_phone';
  return 'none';
}

/** Paystack SMS codes are 4–8 digits. This is not the MoMo PIN. */
export function isFundingOtpCode(value: string): boolean {
  return /^\d{4,8}$/.test(value.trim());
}

export function fundingOtpTitle(displayText?: string | null): string {
  const title = displayText?.trim();
  return title ? title : OTP_SHEET_FALLBACK_TITLE;
}

/** Phone-approval wait. Appends `displayText` when the API sends extra copy. */
export function fundingApproveCopy(displayText?: string | null): string {
  const extra = displayText?.trim();
  if (!extra) return APPROVE_ON_PHONE_COPY;
  if (extra.toLowerCase() === APPROVE_ON_PHONE_COPY.toLowerCase()) return APPROVE_ON_PHONE_COPY;
  return `${APPROVE_ON_PHONE_COPY}\n${extra}`;
}

/** Pull a funding row out of a 200 body or a 400 body that echoes the current request. */
export function walletFundingFromPayload(data: unknown): WalletFunding | null {
  if (!data || typeof data !== 'object') return null;
  const v = data as Record<string, unknown>;
  const hasRow =
    typeof v.id === 'string' || typeof v.status === 'string' || typeof v.nextAction === 'string';
  if (!hasRow) return null;
  return {
    id: typeof v.id === 'string' ? v.id : '',
    status: typeof v.status === 'string' ? v.status : undefined,
    amount: typeof v.amount === 'string' || typeof v.amount === 'number' ? v.amount : undefined,
    provider: typeof v.provider === 'string' ? v.provider : undefined,
    phone: typeof v.phone === 'string' ? v.phone : v.phone === null ? null : undefined,
    failureReason:
      typeof v.failureReason === 'string'
        ? v.failureReason
        : v.failureReason === null
          ? null
          : undefined,
    nextAction:
      typeof v.nextAction === 'string' ? v.nextAction : v.nextAction === null ? null : undefined,
    displayText:
      typeof v.displayText === 'string' ? v.displayText : v.displayText === null ? null : undefined,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : undefined,
    completedAt:
      typeof v.completedAt === 'string' ? v.completedAt : v.completedAt === null ? null : undefined,
  };
}
