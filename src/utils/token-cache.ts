import type { Transaction } from '@/types';

/** In-memory cache so token detail can render immediately after list tap. */
let cached: Transaction | null = null;

export function setTokenDetailPayload(txn: Transaction | null) {
  cached = txn;
}

export function getTokenDetailPayload(): Transaction | null {
  return cached;
}
