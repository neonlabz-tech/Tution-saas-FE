import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiErrorDetail, Notice, OnlineClass, Teacher } from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")
  : `${(import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/+$/, "")}/api`;

const TOKEN_STORAGE_KEY = "eduflow-token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type UserRole = "super_admin" | "admin" | "teacher" | "student";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface LoginConfigResponse {
  authEnabled: boolean;
  loginMethods: string[];
  allowSelfRegistration: boolean;
  passwordMinLength: number;
  tokenType: "Bearer";
  tokenExpiresIn: string;
  instituteName: string;
  roles: UserRole[];
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: AuthUser;
}

export interface OverviewResponse {
  summary: {
    classesToday: number;
    attendanceMarkedToday: number;
    studentsWithPendingFees: number;
  };
  kpis: {
    totalStudents: { value: number; delta: number; spark: number[] };
    activeStudents: { value: number; percentOfEnrollment: number; spark: number[] };
    totalTeachers: { value: number; activeTeachers: number };
    activeModules: { value: number; totalModules: number };
    todayAttendance: { rate: number; markedCount: number; spark: number[] };
    monthlyIncome: { value: number; delta: number; spark: number[] };
    monthlyExpenses: { value: number; delta: number; spark: number[] };
    outstandingPayments: { value: number; studentsWithBalances: number };
  };
  trends: {
    incomeVsExpenses: { key: string; label: string; income: number; expense: number }[];
    studentEnrollment: { key: string; label: string; total: number; added: number }[];
    attendancePercentage: {
      avgRate: number;
      days: { date: string; label: string; rate: number; present: number; absent: number; late: number; excused: number }[];
    };
  };
  activityFeeds: {
    upcomingClasses: {
      id: string;
      title: string;
      moduleId: string;
      teacherId: string;
      teacherName: string;
      batch: string;
      start: string;
      end: string;
      link: string;
      status: string;
    }[];
    recentRegistrations: {
      id: string;
      fullName: string;
      batch: string;
      enrollmentDate: string;
      status: string;
    }[];
    recentPayments: {
      id: string;
      studentId: string;
      studentName: string;
      amount: number;
      date: string;
      method: string;
      description: string;
    }[];
    activeNotices: {
      id: string;
      title: string;
      description: string;
      batches: string[];
      publishDate: string;
      expiryDate: string;
      priority: Notice["priority"];
      status: Notice["status"];
    }[];
    timeline: {
      id: string;
      type: "registration" | "payment" | "notice" | "class";
      title: string;
      subtitle: string;
      timestamp: string;
    }[];
  };
}

export interface TeacherModuleSummary {
  id: string;
  code: string;
  name: string;
  studentCount: number;
}

export interface TeacherWorkload {
  modulesCount: number;
  studentsCount: number;
  hoursPerWeek: number;
}

export interface TeacherListItem extends Teacher {
  moduleIds?: string[];
  assignedModules: TeacherModuleSummary[];
  workload: TeacherWorkload;
}

export interface TeachersMetrics {
  totalTeachers: number;
  activeTeachers: number;
  weeklyTeachingHours: number;
  teachersWithoutModules: number;
}

export interface TeachersListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: TeacherListItem[];
  metrics: TeachersMetrics;
}

export interface TeacherProfileResponse extends TeacherListItem {
  upcomingSchedule: OnlineClass[];
}

export interface DeleteTeacherResponse {
  deleted: boolean;
  id: string;
  unassignedModulesCount: number;
  deletedClassesCount: number;
}

export type TeacherPayload = Omit<Teacher, "id"> & { moduleIds: string[] };

export class ApiError extends Error {
  status: number;
  details?: ApiErrorDetail[];

  constructor(status: number, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function applyApiValidationErrors<TFieldValues extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<TFieldValues>,
): boolean {
  if (!(err instanceof ApiError) || !err.details?.length) return false;
  let mapped = false;
  for (const detail of err.details) {
    if (detail.field && detail.message) {
      setError(detail.field as Path<TFieldValues>, { type: "server", message: detail.message });
      mapped = true;
    }
  }
  return mapped;
}

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string | string[];
  data?: T;
  details?: ApiErrorDetail[];
}

export async function requestWithMeta<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; message?: string }> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  let body: ApiEnvelope<T> | T | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T> | T;
  } catch {
    body = null;
  }

  const envelope = body && typeof body === "object" ? (body as ApiEnvelope<T>) : null;
  const failedEnvelope = envelope !== null && envelope.success === false;

  if (!res.ok || failedEnvelope) {
    if (res.status === 401 && !path.startsWith("/auth/login") && typeof window !== "undefined") {
      window.dispatchEvent(new Event("eduflow:unauthorized"));
    }
    let message = `Request failed (${res.status})`;
    if (envelope) {
      if (Array.isArray(envelope.message)) message = envelope.message.join(", ");
      else if (typeof envelope.message === "string" && envelope.message) message = envelope.message;
    }
    const details = Array.isArray(envelope?.details) ? envelope.details : undefined;
    throw new ApiError(res.status, message, details);
  }

  const message = typeof envelope?.message === "string" ? envelope.message : undefined;
  const data = envelope && "data" in envelope && envelope.data !== undefined ? envelope.data : (body as T);
  return { data, message };
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await requestWithMeta<T>(path, init);
  return data;
}

export const authApi = {
  getConfig() {
    return request<LoginConfigResponse>("/auth/config");
  },

  login(payload: { email: string; password: string }) {
    return request<AuthTokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: { fullName: string; email: string; password: string }) {
    return request<AuthTokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<AuthUser>("/auth/me");
  },

  logout() {
    return request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
  },

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return request<{ updated: boolean }>("/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export const overviewApi = {
  getOverview() {
    return request<OverviewResponse>("/overview");
  },

  getKpisTrends() {
    return request<Pick<OverviewResponse, "summary" | "kpis" | "trends">>("/overview/kpis-trends");
  },

  getActivityFeeds() {
    return request<OverviewResponse["activityFeeds"]>("/overview/activity-feeds");
  },
};

export const teachersApi = {
  list(params?: { q?: string; moduleId?: string; batch?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.moduleId && params.moduleId !== "all") qs.set("moduleId", params.moduleId);
    if (params?.batch && params.batch !== "all") qs.set("batch", params.batch);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<TeachersListResponse>(`/teachers${suffix}`);
  },

  get(id: string) {
    return request<TeacherProfileResponse>(`/teachers/${encodeURIComponent(id)}`);
  },

  create(payload: TeacherPayload) {
    return request<TeacherProfileResponse>("/teachers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: Partial<TeacherPayload>) {
    return request<TeacherProfileResponse>(`/teachers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return request<DeleteTeacherResponse>(`/teachers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

export type NoticePayload = Omit<Notice, "id">;

export const noticesApi = {
  list() {
    return request<Notice[]>("/notices");
  },

  create(payload: NoticePayload) {
    return request<Notice>("/notices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: NoticePayload) {
    return request<Notice>(`/notices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return request<{ deleted: boolean; id: string }>(`/notices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
