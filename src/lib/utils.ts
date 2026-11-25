import { formatLkrPrice } from "@/lib/formatPrice";
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatShortDate,
  DateDisplay,
  ShortDateDisplay,
  TimeDisplay,
  DateTimeDisplay,
  RelativeTimeDisplay,
} from "@/lib/dateTime";

export {
  formatLkrPrice,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatShortDate,
  DateDisplay,
  ShortDateDisplay,
  TimeDisplay,
  DateTimeDisplay,
  RelativeTimeDisplay,
};

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

export function toDateInput(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function fmtDate(iso: string, withYear = true): string {
  if (!iso) return "—";
  return withYear ? formatShortDate(iso) : formatShortDate(iso).replace(/, \d{4}$/, "");
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

/** Formats date & time strictly as DD/Jan/YYYY, hh:mm A (e.g. 23/Nov/2026, 01:36 PM) */
export function fmtNotificationDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}/${month}/${year}, ${formattedHours}:${minutes} ${ampm}`;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === "" || val === "all") continue;
    qs.set(key, String(val));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}
export function fmtTime(dt: string): string {
  return formatTime(dt);
}
export function fmtLKR(n: number): string {
  return formatLkrPrice(n);
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

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getNoticeExpiryDate(notice: {
  expiryDate: string;
  expiryTime?: string;
  expiresAt?: string;
}): Date {
  if (notice.expiresAt) {
    const parsed = new Date(notice.expiresAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const datePart = (notice.expiryDate || "").slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  const timePart = notice.expiryTime && /^\d{2}:\d{2}$/.test(notice.expiryTime) ? notice.expiryTime : "23:59";
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, hh ?? 23, mm ?? 59, 59, 999);
}

export function isNoticeExpired(
  notice: { expiryDate: string; expiryTime?: string; expiresAt?: string },
  now = new Date(),
): boolean {
  return now.getTime() >= getNoticeExpiryDate(notice).getTime();
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Audio & haptic feedback for QR scanning events */
export function playScanFeedback(type: "success" | "warning" | "error"): void {
  if (typeof window !== "undefined") {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "success") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.start();
          osc.stop(ctx.currentTime + 0.13);
        } else if (type === "warning") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          osc.frequency.setValueAtTime(440, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.22);
        } else {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.27);
        }
      }
    } catch {
      /* ignore audio error */
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        if (type === "success") navigator.vibrate(80);
        else if (type === "warning") navigator.vibrate([100, 50, 100]);
        else navigator.vibrate([200, 100, 200]);
      } catch {
        /* ignore vibrate error */
      }
    }
  }
}
