import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, type AuthUser, type LoginConfigResponse } from "@/lib/api";

interface AuthCtx {
  user: AuthUser | null;
  config: LoginConfigResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<LoginConfigResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    authApi
      .getConfig()
      .then(setConfig)
      .catch(() => {
        /* backend offline */
      });
  }, []);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener("eduflow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("eduflow:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setUser(res.user);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const res = await authApi.register({ fullName, email, password });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, config, loading, login, register, logout, refreshUser }),
    [user, config, loading, login, register, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
