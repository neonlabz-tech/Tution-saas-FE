import { PASSWORD_MIN_LENGTH } from "@/lib/studentApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const vName = (v: string) => {
  const t = v.trim();
  if (!t) return "Full name is required";
  if (t.length < 3) return "Enter your full name";
  return undefined;
};
export const vEmail = (v: string) => {
  const t = v.trim();
  if (!t) return "Email is required";
  if (!EMAIL_RE.test(t)) return "Enter a valid email address";
  return undefined;
};
export const vPhone = (v: string) => {
  const t = v.replace(/[\s-]/g, "");
  if (!t) return "Phone number is required";
  if (!/^(\+94|0)?7\d{8}$/.test(t)) return "Enter a valid mobile number, e.g. 0771234567";
  return undefined;
};
export const vStudentId = (v: string) => {
  const t = v.trim();
  if (t && !/^STU-\d{4}-\d{3,}$/i.test(t)) return "Format looks like STU-2025-001";
  return undefined;
};
export const vLoginPassword = (v: string) => (v ? undefined : "Password is required");

export const passwordRules = (v: string) => [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: v.length >= PASSWORD_MIN_LENGTH },
  { label: "A letter and a number", ok: /[A-Za-z]/.test(v) && /\d/.test(v) },
];
export const vNewPassword = (v: string) => {
  if (!v) return "Password is required";
  if (v.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Include at least one letter and one number";
  return undefined;
};
export const vConfirm = (pw: string, confirm: string) => {
  if (!confirm) return "Please confirm your password";
  if (pw !== confirm) return "Passwords do not match";
  return undefined;
};
export const hasErrors = (e: Record<string, string | undefined>) => Object.values(e).some(Boolean);
