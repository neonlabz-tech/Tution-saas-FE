import type { ReactNode } from "react";
import { fmtCompact, fmtLKR } from "@/lib/utils";

export const COLORS = ["#4F46E5", "#14B8A6", "#F59E0B", "#F43F5E", "#8B5CF6", "#0EA5E9", "#84CC16", "#EC4899"];

export const axisTick = { fill: "var(--muted)", fontSize: 11 };
export const gridProps = { stroke: "var(--line)", strokeDasharray: "4 4", vertical: false } as const;
export const cursorStyle = { fill: "color-mix(in oklab, var(--color-primary) 8%, transparent)" };

interface Entry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}
export function ChartTooltip({
  active,
  payload,
  label,
  money = false,
  suffix = "",
}: {
  active?: boolean;
  payload?: Entry[];
  label?: ReactNode;
  money?: boolean;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-pop">
      {label !== undefined && label !== "" && <p className="mb-1.5 text-xs font-bold text-ink">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-semibold text-ink">{money && typeof p.value === "number" ? fmtLKR(p.value) : `${p.value}${suffix}`}</span>
        </div>
      ))}
    </div>
  );
}

export const moneyTick = (v: number) => fmtCompact(v);

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
