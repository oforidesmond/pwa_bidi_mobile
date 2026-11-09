import { storage } from '@/lib/storage';

export const INSTALL_DISMISS_KEY = 'bidi_install_prompt_dismissed_at';
export const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
};

/** True when the app is already running as an installed PWA. */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;

  const nav = window.navigator as NavigatorWithStandalone;
  if (nav.standalone === true) return true;

  return false;
}

/**
 * Best-effort check for related installed apps (Chromium).
 * Returns false when the API is missing or fails.
 */
export async function hasInstalledRelatedApps(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithStandalone;
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

/** iPhone / iPad Safari (excludes Chrome/CriOS and other WebKit browsers on iOS). */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // CriOS = Chrome iOS, FxiOS = Firefox iOS, EdgiOS = Edge iOS
  if (/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export async function isDismissCooldownActive(): Promise<boolean> {
  const raw = await storage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  return Date.now() - dismissedAt < INSTALL_DISMISS_MS;
}

export async function setInstallDismissed(): Promise<void> {
  await storage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
}

export async function clearInstallDismissed(): Promise<void> {
  await storage.removeItem(INSTALL_DISMISS_KEY);
}
