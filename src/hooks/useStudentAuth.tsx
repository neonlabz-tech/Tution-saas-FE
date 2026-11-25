import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { studentAuthApi, type RegisterPayload } from "@/lib/studentApi";
import type { StudentAccount } from "@/types/student";

interface StudentAuthCtx {
  account: StudentAccount | null;
  loading: boolean;
  login: (email: string, password: string, newPassword?: string) => Promise<StudentAccount>;
  register: (payload: RegisterPayload) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
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

  const login = useCallback(async (email: string, password: string, newPassword?: string) => {
    const res = await studentAuthApi.login(email, password, newPassword);
    setAccount(res.account);
    return res.account;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<{ message: string }> => {
    const res = await studentAuthApi.register(payload);
    // Don't set account — registration requires admin approval first
    return { message: res.message };
  }, []);

  const logout = useCallback(async () => {
    await studentAuthApi.logout();
    setAccount(null);
  }, []);

  const updatePassword = useCallback(async (newPassword: string, currentPassword?: string) => {
    await studentAuthApi.changePassword(newPassword, currentPassword);
    setAccount((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
  }, []);

  const value = useMemo(
    () => ({ account, loading, login, register, logout, updatePassword }),
    [account, loading, login, register, logout, updatePassword],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudentAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudentAuth must be used inside StudentAuthProvider");
  return ctx;
}
