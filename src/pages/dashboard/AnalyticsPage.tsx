import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  GraduationCap,
  Percent,
  RotateCw,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Button, Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { PeriodFilter, usePeriod } from "@/components/ui/PeriodFilter";
import { useToast } from "@/components/ui/toast";
import {
  COLORS,
  ChartLegend,
  ChartTooltip,
  axisTick,
  cursorStyle,
  gridProps,
  moneyTick,
} from "@/components/analytics/chartParts";
import {
  analyticsApi,
  type AnalyticsOverviewResponse,
  type ModulePerformanceResponse,
} from "@/lib/api";
import { formatLkrPrice } from "@/lib/utils";

const PAYMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  paid: { label: "Fully paid", color: "#10B981" },
  partial: { label: "Partially paid", color: "#F59E0B" },
  unpaid: { label: "Unpaid", color: "#F43F5E" },
  unassigned: { label: "No modules yet", color: "#94A3B8" },
};

function ChartCard({
  title,
  subtitle,
  legend,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 ${className}`}>
      <CardHeader title={title} subtitle={subtitle} action={legend && <ChartLegend items={legend} />} />
      <div className="h-72 p-4 pt-3">{children}</div>
    </Card>
  );
}

const Empty = ({
  message = "No data for this period",
  loading = false,
}: {
  message?: string;
  loading?: boolean;
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
    {loading ? (
      <>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-brand" />
        <span className="text-xs font-medium">Loading data…</span>
      </>
    ) : (
      <span>{message}</span>
    )}
  </div>
);

type SortField = "name" | "enrolled" | "collected" | "owed" | "rate";

export default function AnalyticsPage() {
  const toast = useToast();
  const period = usePeriod("year");
  const { range } = period;

  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [modulePerf, setModulePerf] = useState<ModulePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sortField, setSortField] = useState<SortField>("collected");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let active = true;
    const params = {
      period: period.period,
      from: range.from,
      to: range.to,
    };
    setLoading(true);

    Promise.all([
      analyticsApi.getOverview(params),
      analyticsApi.getModulePerformance(params),
    ])
      .then(([o, m]) => {
        if (!active) return;
        setOverview(o);
        setModulePerf(m);
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Could not load analytics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period.period, range.from, range.to, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = overview?.financeSeries ?? [];
  const enroll = overview?.enrollmentSeries ?? [];
  // Skip buckets with zero recorded attendance so line doesn't artificially plunge to 0%
  const att = useMemo(
    () => (overview?.attendanceSeries ?? []).filter((b) => b.present + b.late + b.absent > 0),
    [overview],
  );
  const expenseCats = overview?.expenseByCategory ?? [];

  const income = overview?.kpis.totalIncome ?? 0;
  const expense = overview?.kpis.totalExpense ?? 0;
  const margin = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  const moduleStats = useMemo(
    () =>
      (modulePerf?.items ?? []).map((m, i) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        short: (m.code || m.name).split("-")[0],
        teacherName: m.teacher?.fullName,
        enrolled: m.enrolledCount,
        collected: Math.round(m.collected),
        owed: Math.round(m.owed),
        rate: Math.round(m.attendanceRate),
        color: COLORS[i % COLORS.length],
      })),
    [modulePerf],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const sortedModules = useMemo(() => {
    return [...moduleStats].sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") {
        return factor * a.name.localeCompare(b.name);
      }
      return factor * (a[sortField] - b[sortField]);
    });
  }, [moduleStats, sortField, sortDir]);

  const paymentStatus = useMemo(
    () =>
      (overview?.paymentStatusBreakdown ?? []).map((p) => {
        const meta = PAYMENT_STATUS_META[p.name] ?? {
          label: p.name,
          color: "#7D41AB",
        };
        return {
          name: meta.label,
          value: p.value,
          color: meta.color,
        };
      }),
    [overview],
  );

  const dash = loading && !overview ? "…" : undefined;
  const kpis = [
    { l: "Revenue", v: dash ?? formatLkrPrice(income), i: TrendingUp, c: "from-[#8B51BE] to-[#6D3599]" },
    { l: "Expenses", v: dash ?? formatLkrPrice(expense), i: TrendingDown, c: "from-[#4D1882] to-[#2B0A4D]" },
    { l: "Profit margin", v: dash ?? `${margin}%`, i: Percent, c: "from-[#A771CF] to-[#552780]" },
    { l: "New students", v: dash ?? String(overview?.kpis.newEnrollments ?? 0), i: GraduationCap, c: "from-[#BC99D9] to-[#713E99]" },
    { l: "Avg attendance", v: dash ?? `${Math.round(overview?.kpis.attendanceRate ?? 0)}%`, i: UserCheck, c: "from-[#CBADE3] to-[#A774D1]" },
    { l: "Outstanding", v: dash ?? formatLkrPrice(overview?.kpis.totalOutstanding ?? 0), i: Banknote, c: "from-[#693AA0] to-[#2F164E]" },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Interactive insight into revenue, enrollment, attendance and module performance."
      />
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodFilter state={period} />
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-xs"
            aria-label="Refresh analytics data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.l} className="p-4">
            <div
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white ${k.c}`}
            >
              <k.i className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-medium text-muted">{k.l}</p>
            <p className="num mt-0.5 truncate text-base font-bold sm:text-lg">{k.v}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Revenue trend"
          subtitle="Total income over time"
          legend={[{ label: "Income", color: "#7D41AB" }]}
        >
          {loading ? (
            <Empty loading />
          ) : series.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                <Tooltip content={<ChartTooltip money />} />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#7D41AB"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#7D41AB" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Income vs expenses"
          subtitle="Side-by-side comparison"
          legend={[
            { label: "Income", color: "#7D41AB" },
            { label: "Expenses", color: "#4D1882" },
          ]}
        >
          {loading ? (
            <Empty loading />
          ) : series.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                <Bar dataKey="income" name="Income" fill="#7D41AB" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="Expenses" fill="#4D1882" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Student enrollment"
          subtitle="Total students and new enrollments"
          legend={[
            { label: "Total", color: "#7D41AB" },
            { label: "New", color: "#BC99D9" },
          ]}
        >
          {loading ? (
            <Empty loading />
          ) : enroll.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enroll} margin={{ left: -15, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="enrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7D41AB" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#7D41AB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total students"
                  stroke="#7D41AB"
                  strokeWidth={2.5}
                  fill="url(#enrFill)"
                />
                <Area
                  type="monotone"
                  dataKey="added"
                  name="New enrollments"
                  stroke="#BC99D9"
                  strokeWidth={2}
                  fill="#BC99D9"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Attendance trend"
          subtitle="Daily attendance rate (%)"
          legend={[{ label: "Rate", color: "#A771CF" }]}
        >
          {loading ? (
            <Empty loading />
          ) : att.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={att} margin={{ left: -15, right: 8, top: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[50, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Attendance"
                  stroke="#A771CF"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Module enrollment" subtitle="Students per module">
          {loading ? (
            <Empty loading />
          ) : moduleStats.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                <Pie
                  data={moduleStats}
                  dataKey="enrolled"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="none"
                  label={({ name, percent }) =>
                    `${String(name).split(" ")[0]} ${Math.round((percent ?? 0) * 100)}%`
                  }
                  labelLine={{ stroke: "var(--line)", strokeWidth: 1 }}
                  style={{ fontSize: 10, fill: "var(--ink)" }}
                >
                  {moduleStats.map((m) => (
                    <Cell key={m.id} fill={m.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip suffix=" students" />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Expense categories" subtitle="Where the money goes">
          {loading ? (
            <Empty loading />
          ) : expenseCats.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCats}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={3}
                  stroke="none"
                >
                  {expenseCats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip money />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Payment status" subtitle="Students by fee settlement">
          {loading ? (
            <Empty loading />
          ) : paymentStatus.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-full flex-col items-center gap-2 sm:flex-row">
              <div className="h-full min-h-[180px] w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatus}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={85}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {paymentStatus.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip suffix=" students" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-3 sm:w-1/2">
                {paymentStatus.map((p) => (
                  <li key={p.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </span>
                    <span className="num font-bold">{p.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Outstanding by module" subtitle="Unpaid fees allocated pro-rata">
          {loading ? (
            <Empty loading />
          ) : moduleStats.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleStats} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                <YAxis
                  type="category"
                  dataKey="short"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                <Bar dataKey="owed" name="Outstanding" radius={[0, 8, 8, 0]} maxBarSize={20}>
                  {moduleStats.map((m) => (
                    <Cell key={m.id} fill={m.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <Card className="mt-6 min-w-0">
        <CardHeader title="Module performance" subtitle="Enrollment, collected revenue and attendance by module" />
        <div className="overflow-x-auto p-2 pt-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted select-none">
                <th
                  className="px-4 py-2 cursor-pointer hover:text-ink transition"
                  onClick={() => handleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Module
                    {sortField === "name" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-brand" /> : <ArrowDown className="h-3 w-3 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-2 cursor-pointer hover:text-ink transition"
                  onClick={() => handleSort("enrolled")}
                >
                  <span className="inline-flex items-center gap-1">
                    Students
                    {sortField === "enrolled" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-brand" /> : <ArrowDown className="h-3 w-3 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-2 cursor-pointer hover:text-ink transition"
                  onClick={() => handleSort("collected")}
                >
                  <span className="inline-flex items-center gap-1">
                    Collected
                    {sortField === "collected" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-brand" /> : <ArrowDown className="h-3 w-3 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-2 cursor-pointer hover:text-ink transition"
                  onClick={() => handleSort("owed")}
                >
                  <span className="inline-flex items-center gap-1">
                    Outstanding
                    {sortField === "owed" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-brand" /> : <ArrowDown className="h-3 w-3 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
                <th
                  className="px-4 py-2 cursor-pointer hover:text-ink transition"
                  onClick={() => handleSort("rate")}
                >
                  <span className="inline-flex items-center gap-1">
                    Attendance
                    {sortField === "rate" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-brand" /> : <ArrowDown className="h-3 w-3 text-brand" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-brand" />
                      <span>Loading module metrics…</span>
                    </div>
                  </td>
                </tr>
              ) : sortedModules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted">
                    No module data available for this period.
                  </td>
                </tr>
              ) : (
                sortedModules.map((m) => (
                  <tr key={m.id} className="border-t border-line/60 hover:bg-surface-2/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                        <div>
                          <p className="font-semibold text-ink">{m.name}</p>
                          <p className="text-[11px] text-muted">
                            {m.teacherName ? `Teacher: ${m.teacherName}` : (m.code || "—")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="num px-4 py-3 font-semibold">{m.enrolled}</td>
                    <td className="num px-4 py-3 font-semibold text-emerald-500">{formatLkrPrice(m.collected)}</td>
                    <td className="num px-4 py-3 font-semibold text-rose-500">{formatLkrPrice(m.owed)}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[130px] items-center gap-2">
                        <ProgressBar
                          value={m.rate}
                          tone={m.rate >= 85 ? "teal" : m.rate >= 70 ? "amber" : "rose"}
                        />
                        <span className="num w-12 text-xs font-bold">{m.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
