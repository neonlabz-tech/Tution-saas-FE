import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  CreateTransactionDto,
  DeleteTransactionResponse,
  FinanceChartsResponse,
  FinanceFilterParams,
  FinanceKpis,
  FinanceKpisResponse,
  FinanceTransactionsResponse,
  RecordStudentPaymentDto,
  RecordStudentPaymentResponse,
  StudentPaymentsListResponse,
  StudentStatus,
  Transaction,
  TransactionQueryParams,
  UpdateTransactionDto,
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

export async function getFinanceKpis(
  params: FinanceFilterParams = {},
  signal?: AbortSignal,
): Promise<FinanceKpisResponse> {
  const qs = buildQuery({
    period: params.period,
    from: params.from,
    to: params.to,
    category: params.category && params.category !== "all" ? params.category : undefined,
  });
  const res = await request<FinanceKpisResponse>(`/finance/kpis${qs}`, { signal });
  const kpis: FinanceKpis = res?.kpis ?? {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    totalOutstanding: 0,
    totalCount: 0,
  };
  return {
    kpis,
    period: res?.period ?? {
      period: params.period ?? "month",
      from: params.from ?? "",
      to: params.to ?? "",
    },
  };
}

export async function getFinanceCharts(
  params: FinanceFilterParams = {},
  signal?: AbortSignal,
): Promise<FinanceChartsResponse> {
  const qs = buildQuery({
    period: params.period,
    from: params.from,
    to: params.to,
    category: params.category && params.category !== "all" ? params.category : undefined,
  });
  const res = await request<FinanceChartsResponse>(`/finance/charts${qs}`, { signal });
  return {
    period: res?.period ?? {
      period: params.period ?? "month",
      from: params.from ?? "",
      to: params.to ?? "",
    },
    granularity: res?.granularity ?? "monthly",
    series: Array.isArray(res?.series) ? res.series : [],
    incomeByCategory: Array.isArray(res?.incomeByCategory) ? res.incomeByCategory : [],
    expenseByCategory: Array.isArray(res?.expenseByCategory) ? res.expenseByCategory : [],
  };
}

export async function listTransactions(
  params: TransactionQueryParams = {},
  signal?: AbortSignal,
): Promise<FinanceTransactionsResponse> {
  const qs = buildQuery({
    period: params.period,
    from: params.from,
    to: params.to,
    category: params.category && params.category !== "all" ? params.category : undefined,
    type: params.type,
    studentId: params.studentId,
    q: params.q?.trim() || undefined,
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  const res = await request<FinanceTransactionsResponse>(`/finance/transactions${qs}`, { signal });
  const items = Array.isArray(res?.items) ? res.items : [];
  const total = res?.pagination?.total ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? (items.length || 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  const kpis: FinanceKpis = res?.kpis ?? {
    totalIncome: items.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0),
    totalExpense: items.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0),
    netBalance: 0,
    totalOutstanding: 0,
    totalCount: total,
  };
  if (!res?.kpis) {
    kpis.netBalance = kpis.totalIncome - kpis.totalExpense;
  }

  return {
    items,
    pagination: { total, page, limit, totalPages },
    kpis,
    period: res?.period ?? {
      period: params.period ?? "month",
      from: params.from ?? "",
      to: params.to ?? "",
    },
  };
}

export async function createTransaction(payload: CreateTransactionDto): Promise<Transaction> {
  return request<Transaction>("/finance/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionDto,
): Promise<Transaction> {
  return request<Transaction>(`/finance/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTransaction(id: string): Promise<DeleteTransactionResponse> {
  return request<DeleteTransactionResponse>(`/finance/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
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
      totalStudents: res?.summary?.totalStudents ?? total,
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
