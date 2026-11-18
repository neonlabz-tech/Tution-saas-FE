import { request, requestWithMeta } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  CreateStudentDto,
  DeleteStudentResponse,
  RotateQrResponse,
  StudentDetail,
  StudentListResponse,
  StudentQueryParams,
  UpdateStudentDto,
} from "@/types";

export async function listStudents(
  params: StudentQueryParams = {},
  signal?: AbortSignal,
): Promise<StudentListResponse> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    batch: params.batch,
    moduleId: params.moduleId,
    status: params.status,
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });

  const res = await request<StudentListResponse>(`/students${qs}`, { signal });
  const items = Array.isArray(res?.items) ? res.items : [];
  const total = res?.pagination?.total ?? res?.summary?.filteredTotal ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? (items.length || 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    items,
    pagination: { total, page, limit, totalPages },
    summary: {
      total: res?.summary?.total ?? total,
      activeCount: res?.summary?.activeCount ?? items.filter((s) => s.status === "active").length,
      filteredTotal: res?.summary?.filteredTotal ?? total,
    },
  };
}

export async function lookupStudent(code: string, signal?: AbortSignal): Promise<StudentDetail> {
  const qs = buildQuery({ code: code.trim() });
  return request<StudentDetail>(`/students/lookup${qs}`, { signal });
}

export async function getStudentById(id: string, signal?: AbortSignal): Promise<StudentDetail> {
  return request<StudentDetail>(`/students/${encodeURIComponent(id)}`, { signal });
}

export async function createStudentWithMeta(
  payload: CreateStudentDto,
): Promise<{ student: StudentDetail; message?: string }> {
  const { data, message } = await requestWithMeta<StudentDetail>("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { student: data, message };
}

export async function createStudent(payload: CreateStudentDto): Promise<StudentDetail> {
  const { student } = await createStudentWithMeta(payload);
  return student;
}

export async function updateStudent(id: string, payload: UpdateStudentDto): Promise<StudentDetail> {
  return request<StudentDetail>(`/students/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStudent(id: string): Promise<DeleteStudentResponse> {
  return request<DeleteStudentResponse>(`/students/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function rotateStudentQr(id: string): Promise<RotateQrResponse> {
  return request<RotateQrResponse>(`/students/${encodeURIComponent(id)}/rotate-qr`, {
    method: "POST",
  });
}
