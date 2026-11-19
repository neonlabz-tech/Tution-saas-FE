import { useCallback, useEffect, useRef, useState } from "react";
import { getModuleById, listModules } from "@/api/modules";
import type { ModuleDetail, ModuleListItem, ModuleQueryParams } from "@/types";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useModules(params: ModuleQueryParams) {
  const [data, setData] = useState<ModuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reqIdRef = useRef(0);

  const { q, status, teacherId, batch } = params;

  const refetch = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    listModules({ q, status, teacherId, batch }, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load modules");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [q, status, teacherId, batch, reloadTick]);

  return { data, loading, error, refetch };
}

export function useModuleDetail(moduleId: string | null, refreshKey = 0) {
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalTick, setInternalTick] = useState(0);
  const reqIdRef = useRef(0);

  const refresh = useCallback(() => {
    setInternalTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!moduleId) {
      setModule(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    getModuleById(moduleId, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setModule(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load module details");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [moduleId, refreshKey, internalTick]);

  return { module, setModule, loading, error, refresh };
}
