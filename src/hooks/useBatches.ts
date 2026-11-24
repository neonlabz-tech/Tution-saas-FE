import { useCallback, useEffect, useMemo, useState } from "react";
import { listBatches } from "@/api/batches";
import { getAuthToken } from "@/lib/api";
import type { BatchItem } from "@/types";

let dynamicBatches = new Set<string>();
let batchEntities: BatchItem[] = [];
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
    try {
      const items = await listBatches();
      const collected = new Set<string>();
      const validItems: BatchItem[] = [];

      for (const b of items) {
        if (!b) continue;
        if (b.status && b.status !== "active") continue;
        const label = b.name?.trim() || b.code?.trim();
        if (label) {
          collected.add(label);
          validItems.push(b);
        }
      }

      dynamicBatches = collected;
      batchEntities = validItems;
      hasLoadedFromApi = true;
      notifyListeners();
    } catch {
      // Keep existing state if request fails
    }
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

  return { batches, batchItems: batchEntities, refreshBatches: refresh, registerBatches };
}
