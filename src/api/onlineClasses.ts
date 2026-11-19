import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  CreateOnlineClassDto,
  DeleteOnlineClassResponse,
  OnlineClassItem,
  OnlineClassQueryParams,
  UpdateOnlineClassDto,
} from "@/types";

export type { OnlineClassQueryParams };

function normalizeClass(item: OnlineClassItem): OnlineClassItem {
  return {
    ...item,
    description: item.description ?? "",
  };
}

export async function listOnlineClasses(
  params: OnlineClassQueryParams = {},
  signal?: AbortSignal,
): Promise<OnlineClassItem[]> {
  const qs = buildQuery({
    teacherId: params.teacherId,
    moduleId: params.moduleId,
    batch: params.batch,
    status: params.status,
    from: params.from,
    to: params.to,
    q: params.q?.trim() || undefined,
  });
  const res = await request<OnlineClassItem[] | { items?: OnlineClassItem[] }>(
    `/online-classes${qs}`,
    { signal },
  );
  const items = Array.isArray(res) ? res : (res?.items ?? []);
  return items.map(normalizeClass);
}

export async function getOnlineClassById(
  id: string,
  signal?: AbortSignal,
): Promise<OnlineClassItem> {
  const res = await request<OnlineClassItem>(`/online-classes/${encodeURIComponent(id)}`, {
    signal,
  });
  return normalizeClass(res);
}

export async function createOnlineClass(
  payload: CreateOnlineClassDto,
): Promise<OnlineClassItem> {
  const res = await request<OnlineClassItem>("/online-classes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeClass(res);
}

export async function updateOnlineClass(
  id: string,
  payload: UpdateOnlineClassDto,
): Promise<OnlineClassItem> {
  const res = await request<OnlineClassItem>(`/online-classes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeClass(res);
}

export async function deleteOnlineClass(id: string): Promise<DeleteOnlineClassResponse> {
  return request<DeleteOnlineClassResponse>(`/online-classes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
