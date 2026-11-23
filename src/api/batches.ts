import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type { BatchItem, CreateBatchDto, UpdateBatchDto } from "@/types";

export interface BatchQueryParams {
  q?: string;
}

export async function listBatches(
  params: BatchQueryParams = {},
  signal?: AbortSignal,
): Promise<BatchItem[]> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
  });
  const res = await request<BatchItem[] | { items?: BatchItem[] }>(`/batches${qs}`, { signal });
  return Array.isArray(res) ? res : (res?.items ?? []);
}

export async function getBatchById(id: string, signal?: AbortSignal): Promise<BatchItem> {
  return request<BatchItem>(`/batches/${encodeURIComponent(id)}`, { signal });
}

export async function createBatch(payload: CreateBatchDto): Promise<BatchItem> {
  return request<BatchItem>("/batches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBatch(id: string, payload: UpdateBatchDto): Promise<BatchItem> {
  return request<BatchItem>(`/batches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBatch(
  id: string,
): Promise<{ success: boolean; message: string; id: string; name: string }> {
  return request<{ success: boolean; message: string; id: string; name: string }>(
    `/batches/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}
