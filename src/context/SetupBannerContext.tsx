import { useAuth } from '@/context/AuthContext';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type SetupBannerState = {
  dismissed: boolean;
  dismiss: () => void;
  reset: () => void;
};

const SetupBannerContext = createContext<SetupBannerState | undefined>(undefined);

/** Session-scoped dismiss for the USSD setup banner across driver tabs. */
export function SetupBannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => setDismissed(true), []);
  const reset = useCallback(() => setDismissed(false), []);

  useEffect(() => {
    if (!user) setDismissed(false);
  }, [user]);

  const value = useMemo(
    () => ({ dismissed, dismiss, reset }),
    [dismissed, dismiss, reset],
  );

  return <SetupBannerContext.Provider value={value}>{children}</SetupBannerContext.Provider>;
}

export function useSetupBanner() {
  const ctx = useContext(SetupBannerContext);
  if (!ctx) {
    throw new Error('useSetupBanner must be used within SetupBannerProvider');
  }
  return ctx;
}
