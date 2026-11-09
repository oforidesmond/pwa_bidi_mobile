import type { TokenRejectResponse } from '@/types';
import api from './index';
import { createIdempotencyKey } from './idempotency';

export type ReserveConfirmPayload = {
  productCatalogId?: string;
  catalogId?: string;
  liters?: number;
  amount?: number;
  stationId?: string;
  dispenserId?: string;
  pumpId?: string;
};

/** @deprecated Always 400 on backend — use reserveToken + confirmToken. */
export const sellFuel = async (token: string, data: ReserveConfirmPayload) => {
  return confirmToken(token, data);
};

export const reserveToken = async (
  token: string,
  data: ReserveConfirmPayload,
  idempotencyKey = createIdempotencyKey(),
) => {
  const response = await api.patch(`/transactions/token/${token}/reserve`, data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
};

export const confirmToken = async (
  token: string,
  data: ReserveConfirmPayload,
  idempotencyKey = createIdempotencyKey(),
) => {
  const response = await api.patch(`/transactions/token/${token}/confirm`, data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
};

export const rejectToken = async (
  token: string,
  reason?: string,
  idempotencyKey = createIdempotencyKey(),
): Promise<TokenRejectResponse> => {
  const response = await api.patch(
    `/transactions/token/${token}/reject`,
    reason ? { reason } : {},
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return response.data;
};

export const getAttendantSales = async (attendantId: string) => {
  const response = await api.get('/transactions', {
    params: { pumpAttendantId: attendantId },
  });
  return response.data;
};

export const getTokenDetails = async (token: string) => {
  const response = await api.get(`/transactions/${token}`);
  return response.data;
};

export const searchTokens = async (q: string): Promise<string[]> => {
  const response = await api.get('/transactions/tokens/search', {
    params: { q: (q || '').toUpperCase() },
  });
  return (response.data || []).map((t: { token: string }) => t.token);
};

export type AttendantPumpOption = {
  id: string;
  pumpNumber: number | string;
  dispenserId: string;
  dispenserNumber?: number | string;
  productName?: string;
  productCatalogId?: string;
};

export type AttendantBootstrap = {
  stationId: string | null;
  products: Array<{ id: string; name: string }>;
  pumps: AttendantPumpOption[];
};

function mapPump(p: Record<string, unknown>, dispenser?: Record<string, unknown>): AttendantPumpOption | null {
  const id = p?.id ?? p?.pumpId;
  if (id == null) return null;
  const catalog = (p.productCatalog ?? p.product ?? null) as Record<string, unknown> | string | null;
  const catalogId =
    p.productCatalogId ??
    p.catalogId ??
    (typeof catalog === 'object' && catalog ? catalog?.id : undefined);
  const productName =
    (typeof catalog === 'object' && catalog ? (catalog?.name as string | undefined) : undefined) ||
    (typeof p.product === 'string' ? p.product : undefined) ||
    (p.productName as string | undefined) ||
    undefined;
  return {
    id: String(id),
    pumpNumber: (p.pumpNumber ?? p.number ?? '?') as number | string,
    dispenserId: String(dispenser?.id ?? p.dispenserId ?? (p.dispenser as { id?: string })?.id ?? ''),
    dispenserNumber:
      (dispenser?.dispenserNumber as number | string | undefined) ??
      (p.dispenserNumber as number | string | undefined) ??
      (p.dispenser as { dispenserNumber?: number | string })?.dispenserNumber,
    productName: productName ? String(productName) : undefined,
    productCatalogId: catalogId != null ? String(catalogId) : undefined,
  };
}

/** Normalize GET /attendants/me/available-products (assignedPumps and/or station.dispensers). */
export function normalizeAvailableProducts(avail: Record<string, unknown> | null | undefined): AttendantBootstrap {
  const station = (avail?.station ?? null) as Record<string, unknown> | null;
  const stationId = (station?.id ?? avail?.stationId ?? null) as string | null;

  const rawProducts = (station?.products ?? avail?.products ?? []) as Array<Record<string, unknown>>;
  const products = (Array.isArray(rawProducts) ? rawProducts : []).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? p.productName ?? ''),
  }));

  const byId = new Map<string, AttendantPumpOption>();

  const assigned = (avail?.assignedPumps ?? station?.assignedPumps ?? []) as Array<Record<string, unknown>>;
  for (const p of Array.isArray(assigned) ? assigned : []) {
    const mapped = mapPump(p);
    if (mapped) byId.set(mapped.id, mapped);
  }

  const dispensers = (station?.dispensers ?? avail?.dispensers ?? []) as Array<Record<string, unknown>>;
  for (const d of Array.isArray(dispensers) ? dispensers : []) {
    for (const p of (d?.pumps as Array<Record<string, unknown>>) || []) {
      const mapped = mapPump(p, d);
      if (mapped && !byId.has(mapped.id)) byId.set(mapped.id, mapped);
    }
  }

  for (const p of Array.isArray(station?.pumps) ? (station!.pumps as Array<Record<string, unknown>>) : []) {
    const mapped = mapPump(p);
    if (mapped && !byId.has(mapped.id)) byId.set(mapped.id, mapped);
  }

  return { stationId, products, pumps: [...byId.values()] };
}

/** Attendant bootstrap: station products, dispensers, assigned pumps. */
export const getAvailableProducts = async () => {
  const response = await api.get('/attendants/me/available-products');
  return response.data;
};

/** Pumps assigned to an attendant (fallback when bootstrap list is empty). */
export const getAttendantPumps = async (attendantId: string) => {
  const response = await api.get(`/attendants/${attendantId}/pumps`);
  return response.data;
};

export const calculateLiters = async (token: string, product: string) => {
  const response = await api.get(`/transactions/${token}/calculate-liters`, {
    params: { product },
  });
  return response.data;
};

/** Admin/OMC catalog list — not for FUEL_ATTENDANT day-to-day; prefer getAvailableProducts. */
export const getProducts = async () => {
  const response = await api.get('/user/products');
  return response.data;
};
