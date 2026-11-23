import { useCallback, useEffect, useMemo, useState } from "react";
import { listStudents } from "@/api/students";
import { getAuthToken, modulesApi, noticesApi, requestWithMeta, teachersApi } from "@/lib/api";

let dynamicBatches = new Set<string>();
let hasLoadedFromApi = false;
let inflightLoad: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function getSortedBatches(extra?: readonly (string | undefined | null)[]): string[] {
  const merged = new Set<string>(dynamicBatches);
  if (extra) {
    for (const raw of extra) {
      const trimmed = raw?.trim();
      if (trimmed) merged.add(trimmed);
    }
  }
  return Array.from(merged).sort((a, b) => a.localeCompare(b));
}

export function registerBatches(batches: readonly (string | undefined | null)[]) {
  let changed = false;
  for (const raw of batches) {
    const trimmed = raw?.trim();
    if (trimmed && !dynamicBatches.has(trimmed)) {
      dynamicBatches.add(trimmed);
      changed = true;
    }
  }
  if (changed) notifyListeners();
}

export async function refreshBatches(force = false): Promise<void> {
  if (!getAuthToken()) return;
  if (hasLoadedFromApi && !force) return;
  if (inflightLoad) return inflightLoad;

  inflightLoad = (async () => {
    const collected = new Set<string>();

    try {
      const res = await requestWithMeta<unknown>("/batches");
      const raw = res.data as
        | unknown[]
        | { items?: unknown[]; batches?: unknown[]; data?: unknown[] }
        | null;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.batches)
            ? raw.batches
            : Array.isArray(raw?.data)
              ? raw.data
              : [];

      for (const entry of list) {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (trimmed) collected.add(trimmed);
        } else if (entry && typeof entry === "object") {
          const obj = entry as { name?: string; code?: string; status?: string };
          if (obj.status && obj.status !== "active") continue;
          const label = obj.name?.trim() || obj.code?.trim();
          if (label) collected.add(label);
        }
      }

      if (collected.size > 0) {
        dynamicBatches = collected;
        hasLoadedFromApi = true;
        notifyListeners();
        return;
      }
    } catch {
      // Fallback to extracting batches from existing resources if /batches is unavailable
    }

    const [modsRes, studentsRes, teachersRes, noticesRes] = await Promise.allSettled([
      modulesApi.list(),
      listStudents({ limit: 100 }),
      teachersApi.list(),
      noticesApi.list(),
    ]);

    if (modsRes.status === "fulfilled") {
      for (const m of modsRes.value) {
        for (const b of m.batches ?? []) {
          const trimmed = b?.trim();
          if (trimmed) collected.add(trimmed);
        }
      }
    }

    if (studentsRes.status === "fulfilled") {
      for (const s of studentsRes.value.items ?? []) {
        const trimmed = s.batch?.trim();
        if (trimmed) collected.add(trimmed);
      }
    }

    if (teachersRes.status === "fulfilled") {
      for (const t of teachersRes.value.data ?? []) {
        for (const b of t.batches ?? []) {
          const trimmed = b?.trim();
          if (trimmed) collected.add(trimmed);
        }
      }
    }

    if (noticesRes.status === "fulfilled") {
      for (const n of noticesRes.value.items ?? []) {
        for (const b of n.batches ?? []) {
          const trimmed = b?.trim();
          if (trimmed) collected.add(trimmed);
        }
      }
    }

    dynamicBatches = collected;
    hasLoadedFromApi = true;
    notifyListeners();
  })().finally(() => {
    inflightLoad = null;
  });

  return inflightLoad;
}

export function useBatches(extraBatches?: readonly (string | undefined | null)[]) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    listeners.add(onUpdate);
    void refreshBatches(false);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const extraKey = extraBatches?.filter(Boolean).join("|") ?? "";
  const batches = useMemo(() => getSortedBatches(extraBatches), [version, extraKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => refreshBatches(true), []);

  return { batches, refreshBatches: refresh, registerBatches };
}
