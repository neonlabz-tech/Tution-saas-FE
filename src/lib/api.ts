import type { OnlineClass, Teacher } from "@/types";

const envApiUrl = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const API_BASE = envApiUrl?.replace(/\/+$/, "") || "http://localhost:4000";

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
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
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

  return (await res.json()) as T;
}

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
