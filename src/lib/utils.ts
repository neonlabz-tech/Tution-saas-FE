export { cn } from "@/utils/cn";

export const pad = (n: number) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local YYYY-MM-DDTHH:mm */
export function toLocalDT(d: Date): string {
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export const todayISO = () => toISO(new Date());
export function addDays(d: Date | string, n: number): Date {
  const x = typeof d === "string" ? parseISO(d) : new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return toISO(addDays(d, -dow));
}

export function fmtDate(iso: string, withYear = true): string {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}
export function fmtTime(dt: string): string {
  const [h, m] = dt.slice(11, 16).split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
}
export function fmtLKR(n: number): string {
  return `LKR ${Math.round(n).toLocaleString("en-US")}`;
}
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

export function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Locally generated opaque reference for QR codes. It carries no personal data. */
export function makeRef(): string {
  const bytes = new Uint8Array(10);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}
export const QR_PREFIX = "EDUFLOW:";
export const qrPayload = (ref: string) => `${QR_PREFIX}${ref}`;
export const parseQrPayload = (text: string) =>
  text.trim().startsWith(QR_PREFIX) ? text.trim().slice(QR_PREFIX.length) : text.trim();

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
