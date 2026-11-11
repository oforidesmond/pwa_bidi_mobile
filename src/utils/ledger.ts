import type {
  LedgerDirection,
  LedgerEntry,
  LedgerEntryMetadata,
  LedgerListMeta,
} from '@/types';
import type { SignalCategory } from '@/theme/bidi-theme';

/** Contract labels — do not rename reason strings without a mobile + backend bump. */
export function ledgerReasonLabel(reason: string): string {
  const key = String(reason).toUpperCase();
  switch (key) {
    case 'TOPUP':
      return 'Top-up';
    case 'TOKEN_PURCHASE':
      return 'Token purchase';
    case 'REFUND':
      return 'Refund';
    case 'TRANSFER_IN':
      return 'Transfer in';
    case 'TRANSFER_OUT':
      return 'Transfer out';
    case 'FUEL_REDEMPTION':
      return 'Fuel redemption';
    default:
      return reason.replace(/_/g, ' ');
  }
}

export function ledgerDirectionLabel(direction: LedgerDirection | string): string {
  return String(direction).toUpperCase() === 'CREDIT' ? 'Credit' : 'Debit';
}

function asMetadata(raw: LedgerEntry['metadata']): LedgerEntryMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as LedgerEntryMetadata;
}

function providerShortLabel(provider: string | undefined): string | null {
  if (!provider) return null;
  const p = provider.toUpperCase();
  if (p === 'BANK_TRANSFER' || p === 'BANK') return 'Bank';
  if (p === 'MTN_MOMO' || p === 'MTN') return 'MTN';
  if (p === 'VODAFONE_CASH' || p === 'VOD' || p === 'TELECEL') return 'Telecel';
  if (p === 'AIRTELTIGO_MONEY' || p === 'AIR' || p === 'AT') return 'AT';
  return provider.replace(/_/g, ' ');
}

export function formatLedgerShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLedgerFullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString();
}

function refundKindLabel(kind: string | undefined): string | null {
  if (!kind) return null;
  const k = kind.toUpperCase();
  if (k === 'REJECT') return 'Reject';
  if (k === 'REVERSAL') return 'Reversal';
  return kind.replace(/_/g, ' ');
}

function nonEmpty(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export type LedgerDetailRow = {
  label: string;
  value: string;
  selectable?: boolean;
  copyable?: boolean;
};

function isInternalReference(reference: string): boolean {
  return /^[A-Z_]+:/.test(reference);
}

export function ledgerDetailRows(entry: LedgerEntry): LedgerDetailRow[] {
  const currency = entry.currency || 'GHS';
  const meta = asMetadata(entry.metadata);
  const rows: LedgerDetailRow[] = [
    { label: 'Amount', value: `${currency} ${entry.amount}` },
    { label: 'Direction', value: ledgerDirectionLabel(entry.direction) },
    { label: 'Date', value: formatLedgerFullTime(entry.createdAt) },
    { label: 'Balance before', value: `${currency} ${entry.balanceBefore}` },
    { label: 'Balance after', value: `${currency} ${entry.balanceAfter}` },
  ];

  const providerRaw =
    typeof meta?.provider === 'string' ? meta.provider : undefined;
  const isBankTopUp =
    String(providerRaw ?? '').toUpperCase() === 'BANK_TRANSFER' ||
    String(providerRaw ?? '').toUpperCase() === 'BANK';
  const network = providerShortLabel(providerRaw);
  if (network) {
    rows.push({ label: isBankTopUp ? 'Method' : 'Network', value: network });
  }

  const phone = nonEmpty(meta?.phoneMasked);
  if (phone && !isBankTopUp) rows.push({ label: 'Phone', value: phone });

  const token = nonEmpty(meta?.tokenCodeMasked);
  if (token) rows.push({ label: 'Token', value: token, selectable: true });

  const kind = refundKindLabel(typeof meta?.kind === 'string' ? meta.kind : undefined);
  if (kind) rows.push({ label: 'Refund kind', value: kind });

  const txnId = nonEmpty(entry.transactionId);
  if (txnId) rows.push({ label: 'Transaction ID', value: txnId, selectable: true });

  const externalId = nonEmpty(entry.externalId);
  if (externalId) {
    rows.push({
      label: 'Transaction ref.',
      value: externalId,
      selectable: true,
      copyable: true,
    });
  }

  const reference = nonEmpty(entry.reference);
  if (reference && !isInternalReference(reference)) {
    rows.push({ label: 'Reference', value: reference, selectable: true });
  }

  return rows;
}

export function ledgerSubtitle(entry: Pick<LedgerEntry, 'reason' | 'createdAt' | 'metadata'>): string {
  const meta = asMetadata(entry.metadata);
  const reason = String(entry.reason ?? '').toUpperCase();
  const when = formatLedgerShortTime(entry.createdAt);

  if (reason === 'TOPUP' && meta) {
    const provider =
      typeof meta.provider === 'string' ? meta.provider : undefined;
    const network = providerShortLabel(provider);
    const phone =
      typeof meta.phoneMasked === 'string' && meta.phoneMasked.trim()
        ? meta.phoneMasked.trim()
        : null;
    const isBank =
      String(provider ?? '').toUpperCase() === 'BANK_TRANSFER' ||
      String(provider ?? '').toUpperCase() === 'BANK';
    const parts = [isBank ? 'Bank transfer top-up' : 'MoMo top-up'];
    if (network && !isBank) parts.push(network);
    if (phone && !isBank) parts.push(phone);
    if (parts.length > 1 || isBank) return parts.join(' · ');
  }

  if (reason === 'TOKEN_PURCHASE' && meta) {
    const code =
      typeof meta.tokenCodeMasked === 'string' && meta.tokenCodeMasked.trim()
        ? meta.tokenCodeMasked.trim()
        : null;
    if (code) return `Token · ${code}`;
  }

  if (reason === 'REFUND' && meta) {
    const kind = typeof meta.kind === 'string' ? meta.kind.toUpperCase() : '';
    if (kind === 'REJECT') return 'Reject refund';
    if (kind === 'REVERSAL') return 'Reversal refund';
  }

  return when;
}

export function ledgerTotalPages(meta: LedgerListMeta | undefined, pageSize: number): number {
  const size = pageSize > 0 ? pageSize : 20;
  if (meta && typeof meta.total === 'number' && Number.isFinite(meta.total)) {
    return Math.max(1, Math.ceil(Math.max(0, meta.total) / size));
  }
  if (meta && typeof meta.totalPages === 'number' && Number.isFinite(meta.totalPages)) {
    return Math.max(1, Math.floor(meta.totalPages));
  }
  return 1;
}

export function signalCategoryFromReason(reason: string): SignalCategory {
  const key = String(reason).toUpperCase();
  if (key === 'TOPUP' || key === 'TRANSFER_IN' || key === 'REFUND') return 'topup';
  if (key === 'TOKEN_PURCHASE') return 'purchase';
  if (key === 'FUEL_REDEMPTION') return 'redemption';
  if (key === 'LOYALTY_REWARD' || key === 'REFERRAL_BONUS') return 'loyalty';
  return 'fuelSale';
}
