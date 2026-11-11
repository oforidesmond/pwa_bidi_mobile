/** Staff profile from GET /auth/profile (and login user summary). */
export interface User {
  id: string;
  email: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: RoleKey | string | null;
  roles?: string[];
  ownerType?: 'USER' | 'DRIVER' | string;
  /** From OTP verify — pinSetAt null on backend. */
  needsPin?: boolean;
  /** From OTP verify — profileCompletedAt null on backend. */
  needsProfile?: boolean;
}

/** Backend role keys (staff). Drivers use ownerType DRIVER, not these. */
export type RoleKey =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SUPPORT_STAFF'
  | 'OMC_ADMIN'
  | 'STATION_MANAGER'
  | 'FUEL_ATTENDANT'
  | 'AGENT'
  | 'BUSINESS_ADMIN';

/** @deprecated Prefer RoleKey string on User.role */
export interface Role {
  id?: string;
  name: string;
  key?: string;
}

/** Backend fuel-token lifecycle statuses. */
export type TokenStatus =
  | 'ISSUED'
  | 'RESERVED'
  | 'REDEEMED'
  | 'REJECTED'
  | 'REVERSED'
  | 'EXPIRED'
  | 'USED';

export interface Transaction {
  id: string;
  status?: TokenStatus | string;
  productCatalog?: { id: string; name: string; defaultPrice?: number | string };
  catalog?: { id: string; name: string; defaultPrice?: number | string };
  station?: { id: string; name: string };
  pumpAttendant?: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    contact?: string | null;
  };
  attendant?: { id: string; firstName?: string; lastName?: string };
  pump?: { id: string; pumpNumber: number | string };
  liters?: number | null;
  amount?: number | string | null;
  driverId?: string;
  token?: string;
  createdAt: string;
  deletedAt?: string;
  /** Present after attendant reject or admin reverse. */
  rejectionReason?: string | null;
  mobileNumber?: string;
  productId?: string;
  product?: Product;
  pumpAttendantId?: string;
  stationId?: string;
}

/** PATCH /transactions/token/:token/reject success — money fields are decimal strings. */
export interface TokenRejectResponse {
  id: string;
  token: string;
  status: 'REJECTED' | string;
  /** Credited amount; null when nothing left to refund. */
  refunded: string | null;
  balanceAfter: string | null;
  rejectionReason?: string | null;
}

export interface Product {
  id: string;
  type?: string;
  name?: string;
  liters?: number;
  amount?: number;
  stationId?: string;
}

export interface Driver {
  id: string;
  phone?: string;
  firstName?: string | null;
  lastName?: string | null;
  ownerType?: 'DRIVER';
  needsPin?: boolean;
  needsProfile?: boolean;
}

export type LedgerDirection = 'CREDIT' | 'DEBIT';

export type LedgerReason =
  | 'TOPUP'
  | 'TOKEN_PURCHASE'
  | 'FUEL_REDEMPTION'
  | 'PENSION_CONTRIBUTION'
  | 'LOYALTY_REWARD'
  | 'REFERRAL_BONUS'
  | 'REFUND'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'AGENT_COMMISSION'
  | 'BUSINESS_ALLOCATION'
  | 'INSURANCE_PREMIUM'
  | 'FEE'
  | 'ADJUSTMENT';

/** Optional Activity-row helpers from GET .../ledger metadata (unknown keys allowed). */
export type LedgerEntryMetadata = {
  provider?: string;
  phoneMasked?: string;
  gateway?: string;
  tokenCodeMasked?: string;
  kind?: 'REJECT' | 'REVERSAL' | string;
  [key: string]: unknown;
};

/** GET /wallet/driver/:walletId/ledger entry — amounts are decimal strings. */
export interface LedgerEntry {
  id: string;
  walletId: string;
  createdAt: string;
  direction: LedgerDirection;
  reason: LedgerReason | string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  reference?: string | null;
  externalId?: string | null;
  correlationId?: string | null;
  transactionId?: string | null;
  fundingRequestId?: string | null;
  reversalOfId?: string | null;
  metadata?: LedgerEntryMetadata | Record<string, unknown> | null;
}

export interface LedgerListMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface LedgerListResponse {
  data: LedgerEntry[];
  meta: LedgerListMeta;
}

/** GET /wallet/balance — money fields are often decimal strings. */
export interface WalletBalance {
  id: string;
  balance: string | number;
  pendingBalance?: string | number;
  availableBalance: string | number;
  currency?: string;
  status?: string;
  version?: number;
}

/** Driver `POST /wallet/funding` MoMo providers (Korba collections). */
export type FundingProvider = 'MTN_MOMO' | 'VODAFONE_CASH' | 'AIRTELTIGO_MONEY';

/**
 * Local funding row status from GET/POST /wallet/funding*.
 * Paystack verify uses lowercase `success` / `failed` / `abandoned` / etc.;
 * the backend maps those into this enum (abandoned/reversed → FAILED).
 */
export type FundingStatus =
  | 'PENDING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

/** What the driver must do while a funding request is still PENDING. */
export type FundingNextAction = 'submit_otp' | 'approve_on_phone' | 'none';

export interface WalletFunding {
  id: string;
  amount?: string | number;
  status?: FundingStatus | string;
  provider?: FundingProvider | string;
  phone?: string | null;
  failureReason?: string | null;
  nextAction?: FundingNextAction | string | null;
  /** Server copy for the OTP sheet title or the phone-approval wait. */
  displayText?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}
