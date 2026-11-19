import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  CreateModuleDto,
  DeleteModuleResponse,
  ModuleDetail,
  ModuleListItem,
  ModuleQueryParams,
  UpdateModuleDto,
  UpdateModuleEnrollmentsResponse,
} from "@/types";

export type { ModuleQueryParams };

function normalizeModuleDetail(res: ModuleDetail): ModuleDetail {
  const enrolledStudents = Array.isArray(res.enrolledStudents) ? res.enrolledStudents : [];
  const enrolledCount = res.enrolledCount ?? enrolledStudents.length;
  const revenuePotential = res.revenuePotential ?? res.fee * enrolledCount;
  return {
    ...res,
    enrolledStudents,
    enrolledCount,
    revenuePotential,
  };
}

export async function listModules(
  params: ModuleQueryParams = {},
  signal?: AbortSignal,
): Promise<ModuleListItem[]> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    status: params.status,
    teacherId: params.teacherId,
    batch: params.batch,
  });
  const res = await request<ModuleListItem[] | { items?: ModuleListItem[] }>(`/modules${qs}`, { signal });
  return Array.isArray(res) ? res : (res?.items ?? []);
}

export async function getModuleById(id: string, signal?: AbortSignal): Promise<ModuleDetail> {
  const res = await request<ModuleDetail>(`/modules/${encodeURIComponent(id)}`, { signal });
  return normalizeModuleDetail(res);
}

export async function createModule(payload: CreateModuleDto): Promise<ModuleListItem> {
  return request<ModuleListItem>("/modules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateModule(id: string, payload: UpdateModuleDto): Promise<ModuleListItem> {
  return request<ModuleListItem>(`/modules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setModuleEnrollments(
  id: string,
  studentIds: string[],
): Promise<UpdateModuleEnrollmentsResponse> {
  const res = await request<UpdateModuleEnrollmentsResponse>(
    `/modules/${encodeURIComponent(id)}/enrollments`,
    {
      method: "PUT",
      body: JSON.stringify({ studentIds }),
    },
  );
  const enrolledStudents = Array.isArray(res?.enrolledStudents) ? res.enrolledStudents : [];
  return {
    moduleId: res?.moduleId ?? id,
    enrolledCount: res?.enrolledCount ?? enrolledStudents.length,
    enrolledStudents,
  };
}

export async function deleteModule(id: string): Promise<DeleteModuleResponse> {
  return request<DeleteModuleResponse>(`/modules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
