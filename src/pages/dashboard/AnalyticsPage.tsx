import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, GraduationCap, Percent, TrendingDown, TrendingUp, UserCheck } from "lucide-react";
import { Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { PeriodFilter, usePeriod } from "@/components/ui/PeriodFilter";
import { useAppData } from "@/hooks/useAppData";
import { COLORS, ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps, moneyTick } from "@/components/analytics/chartParts";
import { attendanceRate, attendanceSeries, enrollmentSeries, financeSeries, groupSum, sumBy } from "@/lib/stats";
import { inRange } from "@/lib/period";
import { fmtLKR } from "@/lib/utils";

function ChartCard({ title, subtitle, legend, children, className = "" }: { title: string; subtitle?: string; legend?: { label: string; color: string }[]; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={legend && <ChartLegend items={legend} />} />
      <div className="h-72 p-4 pt-3">{children}</div>
    </Card>
  );
}
const Empty = () => <div className="flex h-full items-center justify-center text-sm text-muted">No data for this period</div>;

export default function AnalyticsPage() {
  const { transactions, students, modules, attendance, outstanding, feeTotal, paidTotal } = useAppData();
  const period = usePeriod("year");
  const { range } = period;

  const tx = useMemo(() => transactions.filter((t) => inRange(t.date, range)), [transactions, range]);
  const series = useMemo(() => financeSeries(tx, range), [tx, range]);
  const enroll = useMemo(() => enrollmentSeries(students, range), [students, range]);
  const att = useMemo(() => attendanceSeries(attendance, range), [attendance, range]);
  const expenseCats = useMemo(() => groupSum(tx.filter((t) => t.type === "expense")), [tx]);

  const income = sumBy(tx.filter((t) => t.type === "income"), (t) => t.amount);
  const expense = sumBy(tx.filter((t) => t.type === "expense"), (t) => t.amount);
  const margin = income ? Math.round(((income - expense) / income) * 100) : 0;
  const attRecs = attendance.filter((a) => inRange(a.date, range));
  const newStudents = students.filter((s) => inRange(s.enrollmentDate, range)).length;
  const totalOut = sumBy(students.filter((s) => s.status !== "graduated"), (s) => outstanding(s.id));

  const moduleStats = useMemo(
    () =>
      modules.map((m, i) => {
        const enrolled = students.filter((s) => s.moduleIds.includes(m.id));
        const collected = sumBy(enrolled, (s) => (feeTotal(s.id) ? (paidTotal(s.id) * m.fee) / feeTotal(s.id) : 0));
        const owed = sumBy(enrolled, (s) => (feeTotal(s.id) ? (outstanding(s.id) * m.fee) / feeTotal(s.id) : 0));
        const rate = attendanceRate(attendance.filter((a) => a.moduleId === m.id && inRange(a.date, range)));
        return { id: m.id, name: m.name, short: m.code.split("-")[0], enrolled: enrolled.length, collected: Math.round(collected), owed: Math.round(owed), rate, color: COLORS[i % COLORS.length] };
      }),
    [modules, students, attendance, range, feeTotal, paidTotal, outstanding],
  );
  const paymentStatus = useMemo(() => {
    const act = students.filter((s) => s.status !== "graduated" && feeTotal(s.id) > 0);
    return [
      { name: "Fully paid", value: act.filter((s) => outstanding(s.id) === 0).length, color: "#10B981" },
      { name: "Partially paid", value: act.filter((s) => outstanding(s.id) > 0 && paidTotal(s.id) > 0).length, color: "#F59E0B" },
      { name: "Unpaid", value: act.filter((s) => paidTotal(s.id) === 0).length, color: "#F43F5E" },
    ];
  }, [students, feeTotal, outstanding, paidTotal]);

  const kpis = [
    { l: "Revenue", v: fmtLKR(income), i: TrendingUp, c: "from-emerald-500 to-teal-500" },
    { l: "Expenses", v: fmtLKR(expense), i: TrendingDown, c: "from-rose-500 to-pink-500" },
    { l: "Profit margin", v: `${margin}%`, i: Percent, c: "from-indigo-500 to-violet-500" },
    { l: "New students", v: String(newStudents), i: GraduationCap, c: "from-sky-500 to-indigo-500" },
    { l: "Avg attendance", v: `${attendanceRate(attRecs)}%`, i: UserCheck, c: "from-teal-500 to-emerald-500" },
    { l: "Outstanding", v: fmtLKR(totalOut), i: Banknote, c: "from-amber-500 to-orange-500" },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Interactive insight into revenue, enrollment, attendance and module performance." />
      <Card className="mb-6 p-4"><PeriodFilter state={period} /></Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.l} className="p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white ${k.c}`}><k.i className="h-4 w-4" /></div>
            <p className="text-[11px] font-medium text-muted">{k.l}</p>
            <p className="num mt-0.5 truncate text-base font-bold sm:text-lg">{k.v}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue trend" subtitle="Total income over time" legend={[{ label: "Income", color: "#4F46E5" }]}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
              <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
              <Tooltip content={<ChartTooltip money />} />
              <Line type="monotone" dataKey="income" name="Income" stroke="#4F46E5" strokeWidth={3} dot={{ r: 3, fill: "#4F46E5" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Income vs expenses" subtitle="Side-by-side comparison" legend={[{ label: "Income", color: "#14B8A6" }, { label: "Expenses", color: "#F43F5E" }]}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
              <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
              <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
              <Bar dataKey="income" name="Income" fill="#14B8A6" radius={[6, 6, 0, 0]} maxBarSize={26} />
              <Bar dataKey="expense" name="Expenses" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Student enrollment" subtitle="Total students and new enrollments" legend={[{ label: "Total", color: "#8B5CF6" }, { label: "New", color: "#F59E0B" }]}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={enroll} margin={{ left: -15, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="enrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total" name="Total students" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#enrFill)" />
              <Area type="monotone" dataKey="added" name="New enrollments" stroke="#F59E0B" strokeWidth={2} fill="#F59E0B" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Attendance trend" subtitle="Daily attendance rate (%)" legend={[{ label: "Rate", color: "#14B8A6" }]}>
          {att.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={att} margin={{ left: -15, right: 8, top: 8 }}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis domain={[50, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Line type="monotone" dataKey="rate" name="Attendance" stroke="#14B8A6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Module enrollment" subtitle="Students per module">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={moduleStats} dataKey="enrolled" nameKey="name" outerRadius={95} paddingAngle={2} stroke="none" label={({ name, percent }) => `${String(name).split(" ")[0]} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} style={{ fontSize: 10 }}>
                {moduleStats.map((m) => <Cell key={m.id} fill={m.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip suffix=" students" />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expense categories" subtitle="Where the money goes">
          {expenseCats.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseCats} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} stroke="none">
                  {expenseCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip money />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Payment status" subtitle="Students by fee settlement">
          <div className="flex h-full flex-col items-center gap-2 sm:flex-row">
            <div className="h-full min-h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={4} stroke="none">{paymentStatus.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie>
                  <Tooltip content={<ChartTooltip suffix=" students" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-3 sm:w-1/2">
              {paymentStatus.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: p.color }} />{p.name}</span><span className="num font-bold">{p.value}</span></li>
              ))}
            </ul>
          </div>
        </ChartCard>

        <ChartCard title="Outstanding by module" subtitle="Unpaid fees allocated pro-rata">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moduleStats} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} /><YAxis type="category" dataKey="short" tick={axisTick} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
              <Bar dataKey="owed" name="Outstanding" radius={[0, 8, 8, 0]} maxBarSize={20}>{moduleStats.map((m) => <Cell key={m.id} fill={m.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="mt-6">
        <CardHeader title="Module performance" subtitle="Enrollment, collected revenue and attendance by module" />
        <div className="overflow-x-auto p-2 pt-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Module</th><th className="px-4 py-2">Students</th><th className="px-4 py-2">Collected</th><th className="px-4 py-2">Outstanding</th><th className="px-4 py-2">Attendance</th></tr></thead>
            <tbody>
              {[...moduleStats].sort((a, b) => b.collected - a.collected).map((m) => (
                <tr key={m.id} className="border-t border-line/60">
                  <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />{m.name}</span></td>
                  <td className="num px-4 py-3 font-semibold">{m.enrolled}</td>
                  <td className="num px-4 py-3 font-semibold text-emerald-500">{fmtLKR(m.collected)}</td>
                  <td className="num px-4 py-3 font-semibold text-rose-500">{fmtLKR(m.owed)}</td>
                  <td className="px-4 py-3"><div className="flex min-w-[130px] items-center gap-2"><ProgressBar value={m.rate} tone={m.rate >= 85 ? "teal" : m.rate >= 70 ? "amber" : "rose"} /><span className="num w-12 text-xs font-bold">{m.rate}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
