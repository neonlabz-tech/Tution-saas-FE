// Student-portal API client — real backend calls via cookie-based auth.
import type { StudentAccount, StudentPortalData } from "@/types/student";
import { buildPortalData } from "@/lib/studentPortal";

export const PASSWORD_MIN_LENGTH = 8;

export interface AuthResult {
  account: StudentAccount;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  batch: string;
  moduleIds: string[];
  password: string;
}

const API = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")
  : `${(import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/+$/, "")}/api`;

interface ApiResponse<T> {
  success?: boolean;
  message?: string | string[];
  data?: T;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }

  if (!res.ok || (json && json.success === false)) {
    let msg = `Request failed (${res.status})`;
    if (json?.message) {
      msg = Array.isArray(json.message) ? json.message[0] : json.message;
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

export const studentAuthApi = {
  async checkAccount(email: string): Promise<{ exists: boolean; mustChangePassword: boolean }> {
    try {
      return await request<{ exists: boolean; mustChangePassword: boolean }>(
        `/student-auth/check-account?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      );
    } catch {
      return { exists: false, mustChangePassword: false };
    }
  },

  async register(p: RegisterPayload): Promise<{ message: string; studentId?: string }> {
    return request<{ message: string; studentId?: string }>("/student-auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: p.fullName.trim(),
        email: p.email.trim().toLowerCase(),
        phone: p.phone.trim(),
        dob: p.dob,
        address: p.address.trim(),
        guardianName: p.guardianName.trim(),
        guardianPhone: p.guardianPhone.trim(),
        batch: p.batch.trim(),
        moduleIds: p.moduleIds,
        password: p.password,
      }),
    });
  },

  async login(email: string, password: string, newPassword?: string): Promise<AuthResult> {
    const res = await request<{
      accessToken: string;
      user: {
        id: string;
        fullName: string;
        email: string;
        role: string;
        studentId: string | null;
        phone?: string;
        mustChangePassword?: boolean;
      };
    }>("/student-auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        ...(newPassword?.trim() ? { newPassword: newPassword.trim() } : {}),
      }),
    });

    const user = res?.user;
    if (!user) {
      throw new Error("Invalid response from server: user data missing");
    }

    const account: StudentAccount = {
      id: user.id,
      studentId: user.studentId,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? "",
      mustChangePassword: Boolean(user.mustChangePassword),
    };
    return { account };
  },

  async me(): Promise<StudentAccount | null> {
    try {
      const user = await request<{
        id: string;
        fullName: string;
        email: string;
        role: string;
        studentId: string | null;
        phone?: string;
        mustChangePassword?: boolean;
      }>("/student-auth/me");

      if (!user || !user.id) return null;

      return {
        id: user.id,
        studentId: user.studentId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone ?? "",
        mustChangePassword: Boolean(user.mustChangePassword),
      };
    } catch {
      return null;
    }
  },

  async changePassword(newPassword: string, currentPassword?: string): Promise<{ message: string }> {
    return request<{ message: string }>("/student-auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({ newPassword, currentPassword }),
    });
  },

  async logout(): Promise<void> {
    try {
      await request<unknown>("/student-auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  },

  async forgotPassword(email: string): Promise<{ message?: string; devResetUrl?: string }> {
    return request<{ message?: string; devResetUrl?: string }>("/student-auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  },

  async validateResetToken(token: string): Promise<boolean> {
    try {
      const res = await request<{ valid: boolean }>(
        `/student-auth/reset-password/validate?token=${encodeURIComponent(token)}`,
      );
      return Boolean(res.valid);
    } catch {
      return false;
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await request<unknown>("/student-auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  },
};

export const studentPortalApi = {
  getPortal(account: StudentAccount): Promise<StudentPortalData> {
    const wait = <T,>(v: T, ms = 450) => new Promise<T>((res) => setTimeout(() => res(v), ms));
    return wait(buildPortalData(account.studentId), 450);
  },
};
