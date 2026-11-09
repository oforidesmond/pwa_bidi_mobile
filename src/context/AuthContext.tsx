import { validateToken } from '@/api/auth';
import api, { setUnauthorizedHandler } from '@/api/index';
import { storage } from '@/lib/storage';
import type { User } from '@/types';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getFeedbackBridge } from './FeedbackContext';

/** Normalized app role for tab gating (maps backend role keys). */
export type RoleName =
  | 'DRIVER'
  | 'FUEL_ATTENDANT'
  | 'ADMIN'
  | 'OMC_ADMIN'
  | 'SUPER_ADMIN'
  | 'STATION_MANAGER'
  | 'SUPPORT_STAFF'
  | 'AGENT'
  | 'BUSINESS_ADMIN'
  | null;

interface AuthState {
  user: User | null;
  token: string | null;
  role: RoleName;
  setAuth: (payload: { user: User | null; token: string | null }) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEYS = {
  token: 'access_token',
  user: 'user',
} as const;

function clearApiAuthHeader() {
  delete api.defaults.headers.common.Authorization;
  delete (api.defaults.headers as Record<string, unknown>).Authorization;
}

function setApiAuthHeader(t: string | null) {
  if (t) {
    api.defaults.headers.Authorization = `Bearer ${t}`;
  } else {
    clearApiAuthHeader();
  }
}

function normalizeRole(user: User | null): RoleName {
  if (!user) return null;
  if (user.ownerType === 'DRIVER') return 'DRIVER';
  const key = (user.role || user.roles?.[0] || null) as RoleName;
  if ((key as string) === 'PUMP_ATTENDANT') return 'FUEL_ATTENDANT';
  return key;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hadSessionRef = useRef(false);

  const logout = async () => {
    hadSessionRef.current = false;
    setUser(null);
    setToken(null);
    await storage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
    clearApiAuthHeader();
  };

  useEffect(() => {
    let mounted = true;

    setUnauthorizedHandler(async () => {
      if (!mounted) return;
      const wasLoggedIn = hadSessionRef.current;
      setUser(null);
      setToken(null);
      hadSessionRef.current = false;
      if (wasLoggedIn) {
        getFeedbackBridge()?.showSessionExpired();
      }
    });

    (async () => {
      try {
        const [t, u] = await Promise.all([
          storage.getItem(STORAGE_KEYS.token),
          storage.getItem(STORAGE_KEYS.user),
        ]);

        if (t && u) {
          const parsed = JSON.parse(u) as User;
          setToken(t);
          setUser(parsed);
          hadSessionRef.current = true;
          setApiAuthHeader(t);
          if (parsed.ownerType !== 'DRIVER') {
            void validateTokenInBackground(t);
          }
        } else if (t) {
          await storage.removeItem(STORAGE_KEYS.token);
        } else if (u) {
          await storage.removeItem(STORAGE_KEYS.user);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const validateTokenInBackground = async (storedToken: string) => {
    try {
      setApiAuthHeader(storedToken);
      const validation = (await validateToken()) as {
        success?: boolean;
        user?: User;
      };
      if (validation.success && validation.user) {
        const profile = validation.user;
        const nextUser: User = {
          id: profile.id,
          email: profile.email ?? null,
          phone: profile.phone ?? null,
          firstName: profile.firstName ?? null,
          lastName: profile.lastName ?? null,
          role: profile.role ?? profile.roles?.[0] ?? null,
          roles: profile.roles ?? [],
          ownerType: profile.ownerType ?? 'USER',
        };
        setUser(nextUser);
        hadSessionRef.current = true;
        await storage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
      } else {
        throw new Error('Token validation failed');
      }
    } catch {
      await storage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
      setToken(null);
      setUser(null);
      hadSessionRef.current = false;
      clearApiAuthHeader();
    }
  };

  const setAuth = async ({
    user: nextUser,
    token: nextToken,
  }: {
    user: User | null;
    token: string | null;
  }) => {
    setUser(nextUser);
    setToken(nextToken);
    hadSessionRef.current = !!(nextUser && nextToken);
    if (nextToken) {
      await storage.setItem(STORAGE_KEYS.token, nextToken);
      setApiAuthHeader(nextToken);
    } else {
      await storage.removeItem(STORAGE_KEYS.token);
      clearApiAuthHeader();
    }
    if (nextUser) await storage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    else await storage.removeItem(STORAGE_KEYS.user);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      role: normalizeRole(user),
      setAuth,
      logout,
      loading,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Hydrate staff profile after login — same as mobile staff flow. */