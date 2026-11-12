import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, clearAuthToken, getAuthToken, setAuthToken, type AuthUser, type LoginConfigResponse } from "@/lib/api";

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  config: LoginConfigResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<LoginConfigResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getAuthToken()));

  useEffect(() => {
    authApi
      .getConfig()
      .then(setConfig)
      .catch(() => {
        /* backend offline */
      });
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    authApi
      .me()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        if (active) {
          clearAuthToken();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearAuthToken();
      setToken(null);
      setUser(null);
    };
    window.addEventListener("eduflow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("eduflow:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setAuthToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const res = await authApi.register({ fullName, email, password });
    setAuthToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    } finally {
      clearAuthToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, token, config, loading, login, register, logout }),
    [user, token, config, loading, login, register, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
