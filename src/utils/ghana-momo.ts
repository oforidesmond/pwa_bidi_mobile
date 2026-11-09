import type { FundingProvider } from '@/types';

const MTN_PREFIXES = ['024', '025', '053', '054', '055', '059'];
const TELECEL_PREFIXES = ['020', '050'];
const AT_PREFIXES = ['026', '027', '056', '057'];

export type DetectedMomoNetwork = {
  provider: FundingProvider;
  label: string;
  shortLabel: string;
};

/**
 * Strip to digits and normalize Ghana MSISDN toward local `0XXXXXXXXX`.
 * Accepts `0…`, `233…`, `+233…`.
 */
export function normalizeGhanaLocalPhone(input: string | null | undefined): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(0, 10);
  }
  return digits;
}

/** True when we have a complete Ghana local mobile of 10 digits starting with 0. */
export function isValidGhanaLocalMsisdn(local: string): boolean {
  return /^0\d{9}$/.test(local);
}

/**
 * Detect MoMo rail from typed digits (prefix-based).
 * Returns null until the first 3 national digits after 0 are known.
 */
export function detectGhanaMomoNetwork(
  input: string | null | undefined,
): DetectedMomoNetwork | null {
  const local = normalizeGhanaLocalPhone(input);
  if (local.length < 3) return null;

  const prefix = local.slice(0, 3);
  if (MTN_PREFIXES.includes(prefix)) {
    return { provider: 'MTN_MOMO', label: 'MTN MoMo', shortLabel: 'MTN' };
  }
  if (TELECEL_PREFIXES.includes(prefix)) {
    return { provider: 'VODAFONE_CASH', label: 'Telecel Cash', shortLabel: 'Telecel' };
  }
  if (AT_PREFIXES.includes(prefix)) {
    return { provider: 'AIRTELTIGO_MONEY', label: 'AT Money', shortLabel: 'AT' };
  }
  return null;
}

/** Prefer local form for Korba `customer_number`. */
export function toKorbaCustomerNumber(input: string): string {
  return normalizeGhanaLocalPhone(input);
}

/** Display helper: format stored `233…` as local `0…` for the input field. */
export function toDisplayLocalPhone(input: string | null | undefined): string {
  return normalizeGhanaLocalPhone(input);
}
