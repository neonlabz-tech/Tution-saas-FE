import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { studentAuthApi, type RegisterPayload } from "@/lib/studentApi";
import type { StudentAccount } from "@/types/student";

interface StudentAuthCtx {
  account: StudentAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<StudentAuthCtx | null>(null);

/** Separate from the admin AuthProvider: its own session key, never shares tokens with /dashboard. */
export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<StudentAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    studentAuthApi
      .me()
      .then((a) => active && setAccount(a))
      .catch(() => active && setAccount(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await studentAuthApi.login(email, password);
    setAccount(res.account);
  }, []);
  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await studentAuthApi.register(payload);
    setAccount(res.account);
  }, []);
  const logout = useCallback(async () => {
    await studentAuthApi.logout();
    setAccount(null);
  }, []);

  const value = useMemo(() => ({ account, loading, login, register, logout }), [account, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudentAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudentAuth must be used inside StudentAuthProvider");
  return ctx;
}
