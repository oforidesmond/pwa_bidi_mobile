import { normalizePhone } from '@/api/auth';
import { storage } from '@/lib/storage';

const TRUSTED_PHONE_KEY = 'driver_trusted_phone';

/** Phone digits marked trusted after OTP on this browser/device. */
export async function getTrustedDriverPhone(): Promise<string | null> {
  const raw = await storage.getItem(TRUSTED_PHONE_KEY);
  if (!raw) return null;
  const digits = normalizePhone(raw);
  return digits.length >= 9 ? digits : null;
}

export async function setTrustedDriverPhone(phone: string): Promise<void> {
  const digits = normalizePhone(phone);
  if (digits.length < 9) return;
  await storage.setItem(TRUSTED_PHONE_KEY, digits);
}

/** Clears device trust (different number / forget device). Logout does not call this. */
export async function clearTrustedDriverPhone(): Promise<void> {
  await storage.removeItem(TRUSTED_PHONE_KEY);
}
