import type { Notice, OnlineClass, Teacher } from "@/types";

const envApiUrl = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const API_BASE = envApiUrl?.replace(/\/+$/, "") || "http://localhost:4000";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/login") && typeof window !== "undefined") {
      window.dispatchEvent(new Event("eduflow:unauthorized"));
    }
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (typeof body.message === "string") message = body.message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }

  const json = (await res.json()) as unknown;
  if (
    json !== null &&
    typeof json === "object" &&
    "success" in json &&
    "data" in json &&
    (json as { success: unknown }).success === true
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
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
  accent: "indigo" | "violet" | "teal" | "rose";
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
