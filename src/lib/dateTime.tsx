// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Format a date to a readable string.
 * e.g. "March 26, 2026"
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", options).format(d);
}

/**
 * Format a time to a readable string.
 * e.g. "02:30 PM"
 */
export function formatTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid time";
  return new Intl.DateTimeFormat("en-US", options).format(d);
}

/**
 * Format a full date + time.
 * e.g. "March 26, 2026 at 02:30 PM"
 */
export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Format a date as a short relative string.
 * e.g. "2 days ago", "just now", "in 3 hours"
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid date";

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");

  // Fall back to full date for older/further dates
  return formatDate(d);
}

/**
 * Format a short date.
 * e.g. "Mar 26, 2026"
 */
export function formatShortDate(date: string | Date): string {
  return formatDate(date, { year: "numeric", month: "short", day: "numeric" });
}

// ─── React Components ─────────────────────────────────────────────────────────

interface DateDisplayProps {
  date: string | Date;
  className?: string;
}

/** Renders a full date: "March 26, 2026" */
export function DateDisplay({ date, className = "" }: DateDisplayProps) {
  return (
    <time dateTime={new Date(date).toISOString()} className={className}>
      {formatDate(date)}
    </time>
  );
}

/** Renders a short date: "Mar 26, 2026" */
export function ShortDateDisplay({ date, className = "" }: DateDisplayProps) {
  return (
    <time dateTime={new Date(date).toISOString()} className={className}>
      {formatShortDate(date)}
    </time>
  );
}

/** Renders time only: "02:30 PM" */
export function TimeDisplay({ date, className = "" }: DateDisplayProps) {
  return (
    <time dateTime={new Date(date).toISOString()} className={className}>
      {formatTime(date)}
    </time>
  );
}

/** Renders full date and time: "March 26, 2026 at 02:30 PM" */
export function DateTimeDisplay({ date, className = "" }: DateDisplayProps) {
  return (
    <time dateTime={new Date(date).toISOString()} className={className}>
      {formatDateTime(date)}
    </time>
  );
}

/** Renders a relative time: "2 days ago", "just now" */
export function RelativeTimeDisplay({ date, className = "" }: DateDisplayProps) {
  return (
    <time
      dateTime={new Date(date).toISOString()}
      title={formatDateTime(date)}
      className={className}
    >
      {formatRelativeTime(date)}
    </time>
  );
}
