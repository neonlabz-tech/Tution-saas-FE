import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  CreatePaymentDto,
  CreatePaymentResponse,
  DeletePaymentResponse,
  PaymentDetailResponse,
  PaymentsListQueryParams,
  PaymentsListResponse,
  PaymentStudentsQueryParams,
  PaymentStudentsResponse,
  UpdatePaymentDto,
  UpdatePaymentResponse,
} from "@/types";

export async function listPaymentStudents(
  params: PaymentStudentsQueryParams = {},
  signal?: AbortSignal,
): Promise<PaymentStudentsResponse> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    batch: params.batch && params.batch !== "all" ? params.batch : undefined,
    status: params.status && params.status !== "all" ? params.status : undefined,
    paymentStatus:
      params.paymentStatus && params.paymentStatus !== "all" ? params.paymentStatus : undefined,
    debtorsOnly: params.debtorsOnly,
    includeGraduated: params.includeGraduated,
    page: params.page,
    limit: params.limit,
  });

  const res = await request<PaymentStudentsResponse>(`/payments/students${qs}`, { signal });
  const items = Array.isArray(res?.items) ? res.items : [];
  const total = res?.pagination?.total ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? (items.length || 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  const totalStudents = res?.summary?.totalStudents ?? total;
  const debtorCount = res?.summary?.debtorCount ?? items.filter((i) => i.outstanding > 0).length;
  const settledCount = res?.summary?.settledCount ?? Math.max(0, totalStudents - debtorCount);
  const totalOutstanding =
    res?.summary?.totalOutstanding ?? items.reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const totalCollected =
    res?.summary?.totalCollected ?? items.reduce((s, i) => s + (i.paidTotal ?? 0), 0);

  return {
    items,
    pagination: { total, page, limit, totalPages },
    summary: {
      totalStudents,
      debtorCount,
      settledCount,
      totalOutstanding,
      totalCollected,
    },
  };
}

export async function listPayments(
  params: PaymentsListQueryParams = {},
  signal?: AbortSignal,
): Promise<PaymentsListResponse> {
  const qs = buildQuery({
    q: params.q?.trim() || undefined,
    studentId: params.studentId,
    method: params.method && params.method !== "all" ? params.method : undefined,
    category: params.category && params.category !== "all" ? params.category : undefined,
    status: params.status && params.status !== "all" ? params.status : undefined,
    period: params.period,
    from: params.from,
    to: params.to,
    page: params.page,
    limit: params.limit,
  });

  const res = await request<PaymentsListResponse>(`/payments${qs}`, { signal });
  const items = Array.isArray(res?.items) ? res.items : [];
  const total = res?.pagination?.total ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? (items.length || 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    items,
    pagination: { total, page, limit, totalPages },
    summary: {
      totalCollected:
        res?.summary?.totalCollected ??
        items.filter((i) => i.status === "completed").reduce((s, i) => s + (i.amount ?? 0), 0),
      totalCount: res?.summary?.totalCount ?? total,
    },
  };
}

export async function getPaymentById(
  id: string,
  signal?: AbortSignal,
): Promise<PaymentDetailResponse> {
  return request<PaymentDetailResponse>(`/payments/${encodeURIComponent(id)}`, { signal });
}

export async function createPayment(
  payload: CreatePaymentDto,
): Promise<CreatePaymentResponse> {
  return request<CreatePaymentResponse>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePayment(
  id: string,
  payload: UpdatePaymentDto,
): Promise<UpdatePaymentResponse> {
  return request<UpdatePaymentResponse>(`/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePayment(id: string): Promise<DeletePaymentResponse> {
  return request<DeletePaymentResponse>(`/payments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
