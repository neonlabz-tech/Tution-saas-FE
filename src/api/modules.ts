import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type { Module } from "@/types";

export interface ModuleQueryParams {
  q?: string;
  status?: string;
  teacherId?: string;
  batch?: string;
}

export async function listModules(
  params: ModuleQueryParams = {},
  signal?: AbortSignal,
): Promise<Module[]> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    status: params.status,
    teacherId: params.teacherId,
    batch: params.batch,
  });
  const res = await request<Module[] | { items?: Module[] }>(`/modules${qs}`, { signal });
  return Array.isArray(res) ? res : (res?.items ?? []);
}
