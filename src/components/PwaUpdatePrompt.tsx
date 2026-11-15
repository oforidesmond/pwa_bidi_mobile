import { hapticMedium } from '@/utils/haptics';
import { useCallback, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** How often to poll for a new service worker while the app stays open. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Shows a persistent update bar when a new PWA build is waiting.
 * Clicking Update activates the waiting service worker and reloads.
 */
export function PwaUpdatePrompt() {
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        void registration.update();
      };

      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
  });

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  const applyUpdate = useCallback(async () => {
    if (updating) return;
    setUpdating(true);
    void hapticMedium();
    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
    }
  }, [updating, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div className="bidi-pwa-update" role="status" aria-live="polite">
      <span className="material-symbols-outlined bidi-pwa-update__icon" aria-hidden>
        system_update
      </span>
      <p className="bidi-pwa-update__text">A new version of Bidi Mobile is ready.</p>
      <button
        type="button"
        className="bidi-btn bidi-btn--primary bidi-pwa-update__action"
        disabled={updating}
        onClick={() => void applyUpdate()}
      >
        {updating ? 'Updating…' : 'Update'}
      </button>
      <button
        type="button"
        className="bidi-pwa-update__dismiss"
        aria-label="Dismiss update"
        disabled={updating}
        onClick={dismiss}
      >
        <span className="material-symbols-outlined" aria-hidden>
          close
        </span>
      </button>
    </div>
  );
}
