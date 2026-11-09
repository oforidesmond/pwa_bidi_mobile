import { Sheet } from '@/components/Sheet';
import { useAuth } from '@/context/AuthContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { getBidiLogo } from '@/utils/bidi-logo';
import { hapticMedium } from '@/utils/haptics';
import {
  hasInstalledRelatedApps,
  isDismissCooldownActive,
  isIosSafari,
  isPwaInstalled,
  setInstallDismissed,
} from '@/utils/pwa-install';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const SHOW_DELAY_MS = 1500;

type InstallPromptContextValue = {
  /** Whether the install sheet is currently open. */
  open: boolean;
  dismiss: () => void;
};

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

type PromptMode = 'chromium' | 'ios' | null;

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { scheme, tokens } = useBidiTheme();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PromptMode>(null);
  const [installing, setInstalling] = useState(false);
  /** Session flag: hide after install or explicit permanent hide this session. */
  const [sessionHidden, setSessionHidden] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(true);
  const [relatedInstalled, setRelatedInstalled] = useState(false);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const installed = isPwaInstalled() || relatedInstalled || sessionHidden;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cooldown, related] = await Promise.all([
        isDismissCooldownActive(),
        hasInstalledRelatedApps(),
      ]);
      if (cancelled) return;
      setCooldownActive(cooldown);
      setRelatedInstalled(related);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setOpen(false);
      setMode(null);
      setSessionHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (authLoading || !user || installed || cooldownActive || open) {
      return;
    }

    const nextMode: PromptMode = deferredPrompt
      ? 'chromium'
      : isIosSafari() && !isPwaInstalled()
        ? 'ios'
        : null;

    if (!nextMode) return;

    showTimerRef.current = setTimeout(() => {
      setMode(nextMode);
      setOpen(true);
      closingRef.current = false;
    }, SHOW_DELAY_MS);

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
  }, [authLoading, user, installed, cooldownActive, deferredPrompt, open]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setCooldownActive(true);
    setOpen(false);
    setMode(null);
    void setInstallDismissed();
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    void hapticMedium();
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setOpen(false);
        setMode(null);
        setSessionHidden(true);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, installing, dismiss]);

  const value = useMemo(() => ({ open, dismiss }), [open, dismiss]);

  const logoSrc = getBidiLogo(scheme, 'large');

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
      <Sheet open={open && mode != null} onClose={dismiss} ariaLabel="Install BiDi">
        {mode ? (
          <div className="bidi-sheet-body bidi-install-sheet">
            <div className="bidi-install-logo-wrap">
              <img src={logoSrc} alt="BiDi" className="bidi-install-logo" width={72} height={72} />
            </div>
            <h2 className="bidi-sheet-title">Install BiDi</h2>
            <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
              {mode === 'chromium'
                ? 'Add BiDi to your home screen for faster access, a full-screen experience, and smoother fuel token flows.'
                : 'Add BiDi to your Home Screen for a full-screen app experience and quicker access to your tokens.'}
            </p>

            {mode === 'ios' ? (
              <ol className="bidi-install-steps" style={{ color: tokens.textSecondary }}>
                <li>
                  Tap the <strong style={{ color: tokens.textPrimary }}>Share</strong> button in Safari
                </li>
                <li>
                  Scroll and choose{' '}
                  <strong style={{ color: tokens.textPrimary }}>Add to Home Screen</strong>
                </li>
                <li>
                  Tap <strong style={{ color: tokens.textPrimary }}>Add</strong> to confirm
                </li>
              </ol>
            ) : null}

            <div className="bidi-dialog-actions">
              {mode === 'chromium' ? (
                <button
                  type="button"
                  className="bidi-btn bidi-btn--primary"
                  disabled={installing || !deferredPrompt}
                  onClick={() => void handleInstall()}
                >
                  {installing ? 'Installing…' : 'Install'}
                </button>
              ) : (
                <button type="button" className="bidi-btn bidi-btn--primary" onClick={dismiss}>
                  Got it
                </button>
              )}
              <button type="button" className="bidi-btn bidi-btn--outline" onClick={dismiss}>
                Not now
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt(): InstallPromptContextValue {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) {
    throw new Error('useInstallPrompt must be used within InstallPromptProvider');
  }
  return ctx;
}
