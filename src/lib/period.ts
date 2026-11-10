import { addDays, toISO } from "@/lib/utils";

export type Period = "week" | "month" | "year" | "custom";
export interface Range {
  from: string;
  to: string;
}

export const PERIOD_OPTIONS: { id: Period; label: string; hint: string }[] = [
  { id: "week", label: "Weekly", hint: "Last 7 days" },
  { id: "month", label: "Monthly", hint: "Last 30 days" },
  { id: "year", label: "Yearly", hint: "Last 12 months" },
  { id: "custom", label: "Custom", hint: "Pick dates" },
];

export function getRange(period: Period, custom: Range): Range {
  const today = new Date();
  const to = toISO(today);
  if (period === "week") return { from: toISO(addDays(today, -6)), to };
  if (period === "month") return { from: toISO(addDays(today, -29)), to };
  if (period === "year") return { from: toISO(new Date(today.getFullYear(), today.getMonth() - 11, 1)), to };
  const [a, b] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
  return { from: a, to: b };
}

export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;
