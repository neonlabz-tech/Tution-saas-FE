import { useCallback, useEffect, useRef, useState } from "react";
import { getOnlineClassById, listOnlineClasses } from "@/api/onlineClasses";
import type { OnlineClassItem, OnlineClassQueryParams } from "@/types";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useOnlineClasses(params: OnlineClassQueryParams) {
  const [data, setData] = useState<OnlineClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reqIdRef = useRef(0);

  const { teacherId, moduleId, batch, status, from, to, q } = params;

  const refetch = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    listOnlineClasses({ teacherId, moduleId, batch, status, from, to, q }, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load online classes");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [teacherId, moduleId, batch, status, from, to, q, reloadTick]);

  return { data, setData, loading, error, refetch };
}

export function useOnlineClassDetail(classId: string | null, refreshKey = 0) {
  const [item, setItem] = useState<OnlineClassItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalTick, setInternalTick] = useState(0);
  const reqIdRef = useRef(0);

  const refresh = useCallback(() => {
    setInternalTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!classId) {
      setItem(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);

    getOnlineClassById(classId, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setItem(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load class details");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [classId, refreshKey, internalTick]);

  return { item, setItem, loading, error, refresh };
}
