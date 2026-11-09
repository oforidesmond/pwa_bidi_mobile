import { applyThemeCssVars, getSemanticTokens, type BidiSemanticTokens } from '@/theme/bidi-theme';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'bidi_appearance_preference';

export type AppearancePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
  scheme: 'light' | 'dark';
  tokens: BidiSemanticTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [hydrated, setHydrated] = useState(false);
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(readSystemScheme);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemScheme(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const scheme: 'light' | 'dark' = useMemo(() => {
    if (preference === 'light') return 'light';
    if (preference === 'dark') return 'dark';
    return systemScheme;
  }, [preference, systemScheme]);

  useEffect(() => {
    applyThemeCssVars(scheme);
  }, [scheme]);

  const tokens = useMemo(() => getSemanticTokens(scheme), [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: hydrated ? preference : 'system',
      setPreference,
      scheme,
      tokens,
    }),
    [hydrated, preference, setPreference, scheme, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useBidiTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useBidiTheme must be used within ThemeProvider');
  }
  return ctx;
}
