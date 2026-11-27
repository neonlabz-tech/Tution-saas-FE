import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { studentPortalApi } from "@/lib/studentApi";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import type { StudentPortalData } from "@/types/student";

interface StudentDataCtx {
  data: StudentPortalData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<StudentDataCtx | null>(null);

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { account } = useStudentAuth();
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!account) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    studentPortalApi
      .getPortal(account)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load your data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [account, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOptionalStudentData() {
  return useContext(Ctx);
}

export function useStudentData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudentData must be used inside StudentDataProvider");
  return ctx;
}
