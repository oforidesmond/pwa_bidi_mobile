import type { CSSProperties } from 'react';

/** Tabular figures for aligned money in lists and cards. */
export const tabularNumsStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

/** Format a money amount for display. */
export function formatDisplayMoney(
  amount: string | number | null | undefined,
  currency = 'GHS',
  opts?: { forceCompact?: boolean; forceFull?: boolean },
): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const useCompact = opts?.forceFull === true ? false : opts?.forceCompact === true;

  if (useCompact && Math.abs(value) >= 1000) {
    const abs = Math.abs(value);
    let compact: string;
    if (abs >= 1_000_000) {
      compact = `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    } else {
      compact = `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return `${currency} ${compact}`;
  }

  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMaskedMoney(currency = 'GHS'): string {
  return `${currency} ••••••`;
}
