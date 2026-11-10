import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, BookOpen, CalendarClock, ClipboardCheck, CreditCard, GraduationCap, Megaphone, Percent, Plus, ScanLine, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, Video, Wallet } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, StatusBadge } from "@/components/ui/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { useAppData } from "@/hooks/useAppData";
import { ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps, moneyTick } from "@/components/analytics/chartParts";
import { attendanceRate, attendanceSeries, sumBy } from "@/lib/stats";
import { addDays, cn, fmtDate, fmtLKR, fmtTime, toISO, todayISO } from "@/lib/utils";

const monthKey = (offset: number) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short" }), end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
};
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);

export default function OverviewPage() {
  const { students, teachers, modules, attendance, transactions, classes, notices, outstanding, getStudent, getTeacher } = useAppData();
  const [pay, setPay] = useState(false);
  const today = todayISO();

  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => monthKey(i - 5)), []);
  const monthly = useMemo(
    () =>
      months.map((m) => ({
        label: m.label,
        income: sumBy(transactions.filter((t) => t.type === "income" && t.date.startsWith(m.key)), (t) => t.amount),
        expense: sumBy(transactions.filter((t) => t.type === "expense" && t.date.startsWith(m.key)), (t) => t.amount),
      })),
    [months, transactions],
  );
  const enrollMonthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => monthKey(i - 11)).map((m) => ({ label: m.label, total: students.filter((s) => s.enrollmentDate <= m.end).length, added: students.filter((s) => s.enrollmentDate.startsWith(m.key)).length }));
  }, [students]);
  const att14 = useMemo(() => attendanceSeries(attendance, { from: toISO(addDays(new Date(), -13)), to: today }), [attendance, today]);

  const cur = monthly[5];
  const prev = monthly[4];
  const todayRecs = attendance.filter((a) => a.date === today);
  const todayRate = attendanceRate(todayRecs);
  const activeStudents = students.filter((s) => s.status === "active").length;
  const totalOut = sumBy(students.filter((s) => s.status !== "graduated"), (s) => outstanding(s.id));

  const upcoming = useMemo(() => {
    const now = new Date();
    const nowStr = `${toISO(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return classes.filter((c) => c.status === "scheduled" && c.end >= nowStr).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5);
  }, [classes]);
  const recentStudents = useMemo(() => [...students].sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate)).slice(0, 5), [students]);
  const recentPayments = useMemo(() => transactions.filter((t) => t.studentId && t.category === "Tuition fees").slice(0, 5), [transactions]);
  const activeNotices = useMemo(() => notices.filter((n) => n.status === "published" && n.expiryDate >= today).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])).slice(0, 4), [notices, today]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const quick = [
    { label: "Add Student", icon: UserPlus, to: "/dashboard/students?new=1" },
    { label: "Mark Attendance", icon: ClipboardCheck, to: "/dashboard/attendance" },
    { label: "Record Payment", icon: CreditCard, action: () => setPay(true) },
    { label: "Create Notice", icon: Megaphone, to: "/dashboard/notices?new=1" },
    { label: "Open QR Scanner", icon: ScanLine, to: "/dashboard/qr-scanner" },
  ];

  const kpis = [
    { label: "Total students", value: String(students.length), icon: GraduationCap, gradient: "from-indigo-500 to-violet-500", color: "#6366F1", spark: enrollMonthly.map((m) => m.total), delta: pct(enrollMonthly[11].total, enrollMonthly[10].total) },
    { label: "Active students", value: String(activeStudents), icon: UserCheck, gradient: "from-teal-500 to-emerald-500", color: "#14B8A6", sub: `${Math.round((activeStudents / students.length) * 100)}% of enrollment`, spark: enrollMonthly.map((m) => m.added + 2) },
    { label: "Total teachers", value: String(teachers.length), icon: Users, gradient: "from-sky-500 to-indigo-500", color: "#0EA5E9", sub: `${teachers.filter((t) => t.status === "active").length} currently active` },
    { label: "Active modules", value: String(modules.filter((m) => m.status === "active").length), icon: BookOpen, gradient: "from-fuchsia-500 to-purple-500", color: "#A855F7", sub: `${modules.length} modules in total` },
    { label: "Today's attendance", value: todayRecs.length ? `${todayRate}%` : "—", icon: Percent, gradient: "from-emerald-500 to-teal-500", color: "#10B981", sub: `${todayRecs.length} students marked today`, spark: att14.map((a) => a.rate) },
    { label: "Monthly income", value: fmtLKR(cur.income), icon: TrendingUp, gradient: "from-green-500 to-emerald-500", color: "#22C55E", spark: monthly.map((m) => m.income), delta: pct(cur.income, prev.income) },
    { label: "Monthly expenses", value: fmtLKR(cur.expense), icon: TrendingDown, gradient: "from-rose-500 to-pink-500", color: "#F43F5E", spark: monthly.map((m) => m.expense), delta: pct(cur.expense, prev.expense), deltaGoodWhenUp: false },
    { label: "Outstanding payments", value: fmtLKR(totalOut), icon: Banknote, gradient: "from-amber-500 to-orange-500", color: "#F59E0B", sub: `${students.filter((s) => outstanding(s.id) > 0).length} students with balances` },
  ];

  return (
    <>
      {/* Hero */}
      <section className="grain relative mb-6 overflow-hidden rounded-[2rem] bg-mesh p-6 text-white shadow-pop sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Badge className="bg-white/15 text-white">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Badge>
            <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{greet}, Amara 👋</h1>
            <p className="mt-2 text-sm text-white/80 sm:text-base">
              <b className="num">{upcoming.filter((c) => c.start.startsWith(today)).length}</b> online classes today · <b className="num">{todayRecs.length}</b> attendance entries marked · <b className="num">{students.filter((s) => outstanding(s.id) > 0).length}</b> students with pending fees.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => {
              const cls = "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25 active:scale-95 sm:text-sm";
              return q.to ? (
                <Link key={q.label} to={q.to} className={cls}><q.icon className="h-4 w-4" />{q.label}</Link>
              ) : (
                <button key={q.label} onClick={q.action} className={cls}><q.icon className="h-4 w-4" />{q.label}</button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => <StatCard key={k.label} index={i} {...k} />)}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Income vs expenses" subtitle="Last 6 months · LKR" action={<ChartLegend items={[{ label: "Income", color: "#14B8A6" }, { label: "Expenses", color: "#F43F5E" }]} />} />
          <div className="h-72 p-4 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ left: -8, right: 8, top: 8 }} barGap={6}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                <Bar dataKey="income" name="Income" fill="#14B8A6" radius={[8, 8, 0, 0]} maxBarSize={34} />
                <Bar dataKey="expense" name="Expenses" fill="#F43F5E" radius={[8, 8, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming online classes" subtitle="Next sessions" action={<Link to="/dashboard/online-classes" className="text-xs font-semibold text-brand hover:underline">Calendar →</Link>} />
          <div className="space-y-2 p-4">
            {upcoming.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
                <div className="w-12 shrink-0 rounded-xl bg-primary/10 py-1.5 text-center text-brand">
                  <p className="text-[10px] font-bold uppercase">{new Date(c.start).toLocaleDateString("en-US", { month: "short" })}</p>
                  <p className="num text-base font-bold leading-none">{c.start.slice(8, 10)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.title}</p>
                  <p className="num truncate text-[11px] text-muted">{fmtTime(c.start)} · {getTeacher(c.teacherId)?.fullName}</p>
                </div>
                <a href={c.link} target="_blank" rel="noreferrer" aria-label="Join class" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand hover:bg-primary/10"><Video className="h-4 w-4" /></a>
              </div>
            ))}
            {upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming classes</p>}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Student enrollment trend" subtitle="Total enrolled students · 12 months" />
          <div className="h-64 p-4 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrollMonthly} margin={{ left: -15, right: 8, top: 8 }}>
                <defs><linearGradient id="ovEnr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Students" stroke="#8B5CF6" strokeWidth={3} fill="url(#ovEnr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Attendance percentage" subtitle="Daily rate · last 14 days" action={<Badge tone="green">{attendanceRate(attendance.filter((a) => a.date >= toISO(addDays(new Date(), -13))))}% avg</Badge>} />
          <div className="h-64 p-4 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={att14} margin={{ left: -15, right: 8, top: 8 }}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis domain={[50, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Line type="monotone" dataKey="rate" name="Attendance" stroke="#14B8A6" strokeWidth={3} dot={{ r: 3, fill: "#14B8A6" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent registrations" action={<Link to="/dashboard/students" className="text-xs font-semibold text-brand hover:underline">All →</Link>} />
          <div className="space-y-1 p-3">
            {recentStudents.map((s) => (
              <Link key={s.id} to={`/dashboard/students?q=${s.id}`} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2">
                <Avatar name={s.fullName} size="sm" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.fullName}</p><p className="truncate text-[11px] text-muted">{s.batch} · {fmtDate(s.enrollmentDate, false)}</p></div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent payments" action={<Link to="/dashboard/finance" className="text-xs font-semibold text-brand hover:underline">Ledger →</Link>} />
          <div className="space-y-1 p-3">
            {recentPayments.map((p) => {
              const s = getStudent(p.studentId ?? "");
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><Wallet className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s?.fullName ?? "Student"}</p><p className="truncate text-[11px] text-muted">{fmtDate(p.date, false)} · {p.method}</p></div>
                  <span className="num text-xs font-bold text-emerald-500">+{fmtLKR(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Active notices" action={<Link to="/dashboard/notices" className="text-xs font-semibold text-brand hover:underline">Manage →</Link>} />
          <div className="space-y-2 p-4">
            {activeNotices.map((n) => (
              <Link key={n.id} to="/dashboard/notices" className="block rounded-2xl border border-line p-3 transition hover:border-primary/40">
                <div className="mb-1 flex items-center justify-between gap-2"><StatusBadge status={n.priority} /><span className="text-[11px] text-muted">until {fmtDate(n.expiryDate, false)}</span></div>
                <p className={cn("line-clamp-2 text-sm font-semibold leading-snug")}>{n.title}</p>
                <p className="mt-1 truncate text-[11px] text-muted">{n.batches.length ? n.batches.join(", ") : "All batches"}</p>
              </Link>
            ))}
            {activeNotices.length === 0 && <p className="py-8 text-center text-sm text-muted">No active notices</p>}
            <Link to="/dashboard/notices?new=1"><Button variant="soft" size="sm" className="w-full"><Plus className="h-3.5 w-3.5" /> New notice</Button></Link>
          </div>
        </Card>
      </div>

      <RecordPaymentModal open={pay} onClose={() => setPay(false)} />
    </>
  );
}
