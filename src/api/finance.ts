import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  RecordStudentPaymentDto,
  RecordStudentPaymentResponse,
  StudentPaymentsListResponse,
  StudentStatus,
} from "@/types";

export interface StudentPaymentQueryParams {
  q?: string;
  batch?: string;
  status?: StudentStatus | "all";
  debtorsOnly?: boolean;
  includeGraduated?: boolean;
  page?: number;
  limit?: number;
}

export async function listStudentPayments(
  params: StudentPaymentQueryParams = {},
  signal?: AbortSignal,
): Promise<StudentPaymentsListResponse> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    batch: params.batch,
    status: params.status,
    debtorsOnly: params.debtorsOnly,
    includeGraduated: params.includeGraduated,
    page: params.page,
    limit: params.limit,
  });
  const res = await request<StudentPaymentsListResponse>(`/finance/student-payments${qs}`, { signal });
  const items = Array.isArray(res?.items) ? res.items : [];
  const total = res?.pagination?.total ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? (items.length || 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    items,
    pagination: { total, page, limit, totalPages },
    summary: {
      debtorCount: res?.summary?.debtorCount ?? items.filter((i) => i.outstanding > 0).length,
      totalOutstanding: res?.summary?.totalOutstanding ?? items.reduce((s, i) => s + (i.outstanding ?? 0), 0),
    },
  };
}

export async function recordStudentPayment(
  payload: RecordStudentPaymentDto,
): Promise<RecordStudentPaymentResponse> {
  return request<RecordStudentPaymentResponse>("/finance/student-payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
