import { useMemo, useState } from "react";
import { PERIOD_OPTIONS, getRange, type Period, type Range } from "@/lib/period";
import { addDays, toISO } from "@/lib/utils";
import { Input, Tabs } from "./primitives";

export function usePeriod(initial: Period = "year") {
  const [period, setPeriod] = useState<Period>(initial);
  const [custom, setCustom] = useState<Range>({ from: toISO(addDays(new Date(), -45)), to: toISO(new Date()) });
  const range = useMemo(() => getRange(period, custom), [period, custom]);
  return { period, setPeriod, custom, setCustom, range };
}

export function PeriodFilter({ state }: { state: ReturnType<typeof usePeriod> }) {
  const { period, setPeriod, custom, setCustom } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs items={PERIOD_OPTIONS.map((p) => ({ id: p.id, label: p.label }))} value={period} onChange={setPeriod} />
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-40" aria-label="From date" />
          <span className="text-xs text-muted">to</span>
          <Input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-40" aria-label="To date" />
        </div>
      )}
    </div>
  );
}
