import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiErrorDetail, AttendanceRecord, AttendanceStatus, Module, ModuleStatus, Notice, NoticeState, OnlineClass, Teacher } from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")
  : `${(import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/+$/, "")}/api`;

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
    /** All live notices; activeNotices holds only the top 5. */
    activeNoticesTotal?: number;
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
  hoursPerWeek?: number;
}

export interface TeacherListItem extends Teacher {
  moduleIds?: string[];
  assignedModules: TeacherModuleSummary[];
  workload: TeacherWorkload;
}

export interface TeachersMetrics {
  totalTeachers: number;
  activeTeachers: number;
  inactiveTeachers?: number;
  weeklyTeachingHours?: number;
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

const TOKEN_KEY = "eduflow_access_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

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
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
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
      clearAuthToken();
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
  const data = envelope && "data" in envelope && envelope.data !== undefined ? (envelope.data as T) : (body as T);
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

  async login(payload: { email: string; password: string }) {
    const res = await request<AuthTokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res?.accessToken) {
      setAuthToken(res.accessToken);
    }
    return res;
  },

  async register(payload: { fullName: string; email: string; password: string; role?: UserRole }) {
    const res = await request<AuthTokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res?.accessToken) {
      setAuthToken(res.accessToken);
    }
    return res;
  },

  me() {
    return request<AuthUser>("/auth/me");
  },

  async logout() {
    try {
      return await request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } finally {
      clearAuthToken();
    }
  },

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return request<{ updated: boolean }>("/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  forgotPassword(payload: { email: string }) {
    return request<{ message: string; devResetUrl?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  resetPassword(payload: { token: string; newPassword: string }) {
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
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

export interface InstituteSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  about: string;
  logo: string | null;
}

export interface AppearanceSettings {
  mode: "light" | "dark" | "system";
  accent: string;
}

export interface NotificationToggles {
  payments: boolean;
  overdue: boolean;
  absence: boolean;
  classes: boolean;
  notices: boolean;
}

export interface NotificationChannels {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface SettingsResponse {
  institute: InstituteSettings;
  appearance: AppearanceSettings;
  notifications: NotificationToggles;
  channels: NotificationChannels;
  profile: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  };
}

export interface NotificationItem {
  id: string;
  type: "notice" | "class" | "payment" | "student" | "system";
  title: string;
  subtitle: string;
  link: string;
  read: boolean;
  persisted: boolean;
}

export const notificationsApi = {
  list() {
    return request<{ items: NotificationItem[]; unreadCount: number }>("/notifications");
  },

  create(payload: {
    type?: NotificationItem["type"];
    title: string;
    subtitle?: string;
    link?: string;
  }) {
    return request<NotificationItem>("/notifications", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  markAsRead(id: string) {
    return request<{ id: string; read: true }>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    });
  },

  markAllAsRead() {
    return request<{ updatedCount: number }>("/notifications/read-all", {
      method: "PATCH",
    });
  },
};

export const settingsApi = {
  get() {
    return request<SettingsResponse>("/settings");
  },

  updateInstitute(payload: Partial<InstituteSettings>) {
    return request<InstituteSettings>("/settings/institute", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateAppearance(payload: Partial<AppearanceSettings>) {
    return request<AppearanceSettings>("/settings/appearance", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateProfile(payload: {
    fullName?: string;
    email?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return request<SettingsResponse["profile"]>("/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateNotifications(payload: {
    notifications?: Partial<NotificationToggles>;
    channels?: Partial<NotificationChannels>;
  }) {
    return request<{
      notifications: NotificationToggles;
      channels: NotificationChannels;
    }>("/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size?: number;
  mimeType?: string;
}

export const storageApi = {
  upload(file: File, folder?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (folder) formData.append("folder", folder);
    return request<UploadResult>("/storage/upload", {
      method: "POST",
      body: formData,
    });
  },
  uploadBase64(base64: string, folder?: string, prefix?: string) {
    return request<UploadResult>("/storage/upload-base64", {
      method: "POST",
      body: JSON.stringify({ base64, folder, prefix }),
    });
  },
  delete(key: string) {
    return request<{ success: boolean; message: string }>(
      `/storage?key=${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
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

export interface EnrolledStudentSummary {
  id: string;
  fullName: string;
  batch: string;
  status: string;
  email?: string;
}

export interface ModuleDetailResponse extends Module {
  revenuePotential: number;
  enrolledStudents: EnrolledStudentSummary[];
}

export interface ModulePayload {
  code: string;
  name: string;
  description: string;
  fee: number;
  duration: string;
  teacherId?: string | null;
  batches: string[];
  status?: ModuleStatus;
}

export interface DeleteModuleResponse {
  deleted: boolean;
  id: string;
  affectedStudentsCount: number;
  deletedClassesCount: number;
  deletedAttendanceCount: number;
}

export interface SyncEnrollmentsResponse {
  moduleId: string;
  enrolledCount: number;
  enrolledStudents: EnrolledStudentSummary[];
}

export const modulesApi = {
  list(params?: { q?: string; status?: string; teacherId?: string; batch?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.teacherId && params.teacherId !== "all") qs.set("teacherId", params.teacherId);
    if (params?.batch && params.batch !== "all") qs.set("batch", params.batch);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Module[]>(`/modules${suffix}`);
  },

  get(id: string) {
    return request<ModuleDetailResponse>(`/modules/${encodeURIComponent(id)}`);
  },

  create(payload: ModulePayload) {
    return request<Module>("/modules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: Partial<ModulePayload>) {
    return request<Module>(`/modules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return request<DeleteModuleResponse>(`/modules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  syncEnrollments(id: string, studentIds: string[]) {
    return request<SyncEnrollmentsResponse>(`/modules/${encodeURIComponent(id)}/enrollments`, {
      method: "PUT",
      body: JSON.stringify({ studentIds }),
    });
  },
};

export type NoticePayload = Omit<Notice, "id" | "state">;
export type NoticeCounts = Record<"all" | NoticeState, number>;
export interface NoticeListResponse {
  items: Notice[];
  counts: NoticeCounts;
}

export const noticesApi = {
  list() {
    return request<NoticeListResponse>("/notices");
  },

  get(id: string) {
    return request<Notice>(`/notices/${encodeURIComponent(id)}`);
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

export interface DailyRosterEntry {
  key: string;
  student: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    batch?: string;
    status: string;
    avatar?: string;
  };
  module: {
    id: string;
    name: string;
    code: string;
  };
  record: AttendanceRecord | null;
}

export interface DailyRosterResponse {
  date: string;
  moduleId: string;
  batch: string;
  totalEntries: number;
  markedCount: number;
  unmarkedCount: number;
  counts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  rows: DailyRosterEntry[];
}

export interface StudentAttendanceSummary {
  student: {
    id: string;
    fullName: string;
    email?: string;
    batch?: string;
    status: string;
    phone?: string;
  };
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export interface AttendanceSummariesResponse {
  from: string;
  to: string;
  moduleId: string;
  batch: string;
  totalStudents: number;
  overallCounts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  overallRate: number;
  summaries: StudentAttendanceSummary[];
}

export interface StudentHistoryRecord extends AttendanceRecord {
  module?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface StudentHistoryResponse {
  student: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    batch?: string;
    status: string;
    moduleIds: string[];
  };
  overallRate: number;
  counts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  records: StudentHistoryRecord[];
}

export interface VerifyQrResponse {
  valid: boolean;
  message: string;
  student: {
    id: string;
    ref: string;
    fullName: string;
    email?: string;
    phone?: string;
    batch?: string;
    status: string;
    moduleIds: string[];
    feeTotal?: number;
    paidTotal?: number;
    outstanding?: number;
    paymentStatus?: "paid" | "partial" | "unpaid";
  };
  enrolledInModule?: boolean;
  alreadyMarked?: boolean;
  existingAttendance?: AttendanceRecord;
}

export interface MarkAttendanceResponse {
  success: boolean;
  message: string;
  isNew: boolean;
  record: AttendanceRecord;
  student?: {
    id: string;
    fullName: string;
    batch?: string;
  };
  module?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface BulkMarkUnmarkedResponse {
  success: boolean;
  message: string;
  date: string;
  moduleId: string;
  batch: string;
  markedCount: number;
  records: AttendanceRecord[];
}

export const attendanceApi = {
  getDailyRoster(params: { date?: string; moduleId?: string; batch?: string; studentId?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params.date) qs.set("date", params.date);
    if (params.moduleId && params.moduleId !== "all") qs.set("moduleId", params.moduleId);
    if (params.batch && params.batch !== "all") qs.set("batch", params.batch);
    if (params.studentId && params.studentId !== "all") qs.set("studentId", params.studentId);
    if (params.search) {
      qs.set("search", params.search);
      qs.set("q", params.search);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<DailyRosterResponse>(`/attendance/daily-roster${suffix}`);
  },

  getSummaries(params: {
    from: string;
    to: string;
    moduleId?: string;
    batch?: string;
    studentId?: string;
    search?: string;
    q?: string;
  }) {
    const qs = new URLSearchParams();
    qs.set("from", params.from);
    qs.set("to", params.to);
    if (params.moduleId && params.moduleId !== "all") qs.set("moduleId", params.moduleId);
    if (params.batch && params.batch !== "all") qs.set("batch", params.batch);
    if (params.studentId && params.studentId !== "all") qs.set("studentId", params.studentId);
    if (params.search) qs.set("search", params.search);
    if (params.q) qs.set("q", params.q);
    return request<AttendanceSummariesResponse>(`/attendance/summaries?${qs.toString()}`);
  },

  getStudentHistory(studentId: string, params?: { from?: string; to?: string; moduleId?: string }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.moduleId && params.moduleId !== "all") qs.set("moduleId", params.moduleId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<StudentHistoryResponse>(`/attendance/student/${encodeURIComponent(studentId)}${suffix}`);
  },

  listRecords(params?: {
    from?: string;
    to?: string;
    date?: string;
    studentId?: string;
    moduleId?: string;
    status?: string;
    method?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.date) qs.set("date", params.date);
    if (params?.studentId && params.studentId !== "all") qs.set("studentId", params.studentId);
    if (params?.moduleId && params.moduleId !== "all") qs.set("moduleId", params.moduleId);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.method && params.method !== "all") qs.set("method", params.method);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<AttendanceRecord[]>(`/attendance${suffix}`);
  },

  mark(payload: {
    studentId: string;
    moduleId: string;
    date: string;
    status: AttendanceStatus;
    method?: "manual" | "qr";
    notes?: string;
  }) {
    return request<MarkAttendanceResponse>("/attendance/mark", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  bulkMarkUnmarked(payload: {
    date: string;
    moduleId?: string;
    batch?: string;
    status?: AttendanceStatus;
  }) {
    return request<BulkMarkUnmarkedResponse>("/attendance/bulk-mark-unmarked", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  verifyQr(payload: { code: string; moduleId?: string; date?: string }) {
    return request<VerifyQrResponse>("/attendance/qr/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  markQr(payload: { code: string; moduleId: string; date?: string; status?: AttendanceStatus }) {
    return request<MarkAttendanceResponse>("/attendance/qr/mark", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteRecord(id: string) {
    return request<{ deleted: boolean; id: string }>(`/attendance/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
