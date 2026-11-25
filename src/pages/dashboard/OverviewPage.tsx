import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Megaphone,
  Percent,
  RefreshCw,
  ScanLine,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { useAuth } from "@/hooks/useAuth";
import { ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps, moneyTick } from "@/components/analytics/chartParts";
import { overviewApi, type OverviewResponse } from "@/lib/api";
import { cn, formatLkrPrice, formatShortDate, formatTime } from "@/lib/utils";

const EMPTY_OVERVIEW: OverviewResponse = {
  summary: { classesToday: 0, attendanceMarkedToday: 0, studentsWithPendingFees: 0 },
  kpis: {
    totalStudents: { value: 0, delta: 0, spark: [] },
    activeStudents: { value: 0, percentOfEnrollment: 0, spark: [] },
    totalTeachers: { value: 0, activeTeachers: 0 },
    activeModules: { value: 0, totalModules: 0 },
    todayAttendance: { rate: 0, markedCount: 0, spark: [] },
    monthlyIncome: { value: 0, delta: 0, spark: [] },
    monthlyExpenses: { value: 0, delta: 0, spark: [] },
    outstandingPayments: { value: 0, studentsWithBalances: 0 },
  },
  trends: {
    incomeVsExpenses: [],
    studentEnrollment: [],
    attendancePercentage: { avgRate: 0, days: [] },
  },
  activityFeeds: {
    upcomingClasses: [],
    recentRegistrations: [],
    recentPayments: [],
    activeNotices: [],
    timeline: [],
  },
};

export default function OverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<OverviewResponse>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pay, setPay] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setError(null);

    overviewApi
      .getOverview()
      .then((res) => {
        if (active) {
          setOverview(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "Failed to load dashboard overview data");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, refreshKey]);

  const { summary, kpis: kpiData, trends, activityFeeds } = overview;
  const firstName = (user?.fullName ?? "Amara Perera").split(" ")[0];

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
    { label: "Total students", value: String(kpiData.totalStudents.value), icon: GraduationCap, gradient: "from-[#8B51BE] to-[#6D3599]", color: "#8B51BE", spark: kpiData.totalStudents.spark, delta: kpiData.totalStudents.delta },
    { label: "Active students", value: String(kpiData.activeStudents.value), icon: UserCheck, gradient: "from-[#A771CF] to-[#552780]", color: "#A771CF", sub: `${kpiData.activeStudents.percentOfEnrollment}% of enrollment`, spark: kpiData.activeStudents.spark },
    { label: "Total teachers", value: String(kpiData.totalTeachers.value), icon: Users, gradient: "from-[#BC99D9] to-[#713E99]", color: "#9A6DBC", sub: `${kpiData.totalTeachers.activeTeachers} currently active` },
    { label: "Active modules", value: String(kpiData.activeModules.value), icon: BookOpen, gradient: "from-[#CBADE3] to-[#A774D1]", color: "#A774D1", sub: `${kpiData.activeModules.totalModules} modules in total` },
    { label: "Today's attendance", value: kpiData.todayAttendance.markedCount ? `${kpiData.todayAttendance.rate}%` : "—", icon: Percent, gradient: "from-[#7948A2] to-[#461A71]", color: "#7948A2", sub: `${kpiData.todayAttendance.markedCount} students marked today`, spark: kpiData.todayAttendance.spark },
    { label: "Monthly income", value: formatLkrPrice(kpiData.monthlyIncome.value), icon: TrendingUp, gradient: "from-[#8B51BE] to-[#6D3599]", color: "#7D41AB", spark: kpiData.monthlyIncome.spark, delta: kpiData.monthlyIncome.delta },
    { label: "Monthly expenses", value: formatLkrPrice(kpiData.monthlyExpenses.value), icon: TrendingDown, gradient: "from-[#4D1882] to-[#2B0A4D]", color: "#4D1882", spark: kpiData.monthlyExpenses.spark, delta: kpiData.monthlyExpenses.delta, deltaGoodWhenUp: false },
    { label: "Outstanding payments", value: formatLkrPrice(kpiData.outstandingPayments.value), icon: Banknote, gradient: "from-[#693AA0] to-[#2F164E]", color: "#693AA0", sub: `${kpiData.outstandingPayments.studentsWithBalances} students with balances` },
  ];

  return (
    <>
      {/* Error alert banner */}
      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex items-center gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Hero */}
      <section className="grain relative mb-6 overflow-hidden rounded-[2rem] bg-mesh p-6 text-white shadow-pop sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Badge className="bg-white/15 text-white">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Badge>
            <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{greet}, {firstName} 👋</h1>
            <p className="mt-2 text-sm text-white/80 sm:text-base">
              {loading ? (
                <span className="inline-block h-4 w-72 animate-pulse rounded bg-white/20" />
              ) : (
                <>
                  <b className="num">{summary.classesToday}</b> classes today · <b className="num">{summary.attendanceMarkedToday}</b> attendance entries marked · <b className="num">{summary.studentsWithPendingFees}</b> students with pending fees.
                </>
              )}
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

      {/* 8 KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                </div>
                <Skeleton className="mt-4 h-8 w-32" />
                <Skeleton className="mt-2 h-3.5 w-40" />
              </div>
            ))
          : kpis.map((k, i) => <StatCard key={k.label} index={i} {...k} />)}
      </div>

      {/* Financial Trend + Upcoming Classes */}
      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Income vs expenses" subtitle="Last 6 months · LKR" action={<ChartLegend items={[{ label: "Income", color: "#7D41AB" }, { label: "Expenses", color: "#4D1882" }]} />} />
          <div className="h-72 p-4 pt-3">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.incomeVsExpenses} margin={{ left: -8, right: 8, top: 8 }} barGap={6}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                  <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                  <Bar dataKey="income" name="Income" fill="#7D41AB" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="expense" name="Expenses" fill="#4D1882" radius={[8, 8, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming classes" subtitle="Next sessions" action={<Link to="/dashboard/online-classes" className="text-xs font-semibold text-brand hover:underline">Calendar →</Link>} />
          <div className="space-y-2 p-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              ))
            ) : (
              <>
                {activityFeeds.upcomingClasses.map((c) => {
                  const isPhysical = c.classType === "physical";
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3 transition hover:bg-surface-2">
                      <div className="w-12 shrink-0 rounded-xl bg-primary/10 py-1.5 text-center text-brand">
                        <p className="text-[10px] font-bold uppercase">{new Date(c.start).toLocaleDateString("en-US", { month: "short" })}</p>
                        <p className="num text-base font-bold leading-none">{c.start.slice(8, 10)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold">{c.title}</p>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isPhysical ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {isPhysical ? (c.hall ? `Hall ${c.hall}` : "Physical") : "Online"}
                          </span>
                        </div>
                        <p className="num truncate text-[11px] text-muted">{formatTime(c.start)} · {c.teacherName}</p>
                      </div>
                      {isPhysical ? (
                        <div title={c.hall ? `Physical session in ${c.hall}` : "Physical session"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-sm">
                          <Building2 className="h-4 w-4" />
                        </div>
                      ) : c.link ? (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Join online class"
                          title="Join online class"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand shadow-sm hover:bg-primary/10 transition"
                        >
                          <Video className="h-4 w-4" />
                        </a>
                      ) : (
                        <div title="Online session" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
                          <Video className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {activityFeeds.upcomingClasses.length === 0 && <p className="py-8 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming classes</p>}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Enrollment & Attendance Trends */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Student enrollment trend" subtitle="Total enrolled students · 12 months" />
          <div className="h-64 p-4 pt-3">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.studentEnrollment} margin={{ left: -15, right: 8, top: 8 }}>
                  <defs><linearGradient id="ovEnr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7D41AB" stopOpacity={0.4} /><stop offset="100%" stopColor="#7D41AB" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="total" name="Students" stroke="#7D41AB" strokeWidth={3} fill="url(#ovEnr)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Attendance percentage" subtitle="Daily rate · last 14 days" action={<Badge tone="primary">{trends.attendancePercentage.avgRate}% avg</Badge>} />
          <div className="h-64 p-4 pt-3">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.attendancePercentage.days} margin={{ left: -15, right: 8, top: 8 }}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Line type="monotone" dataKey="rate" name="Attendance" stroke="#A771CF" strokeWidth={3} dot={{ r: 3, fill: "#A771CF" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Activity Feeds */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent registrations" action={<Link to="/dashboard/students" className="text-xs font-semibold text-brand hover:underline">All →</Link>} />
          <div className="space-y-1 p-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))
            ) : (
              <>
                {activityFeeds.recentRegistrations.map((s) => (
                  <Link key={s.id} to={`/dashboard/students?q=${s.id}`} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2 transition">
                    <Avatar name={s.fullName} size="sm" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.fullName}</p><p className="truncate text-[11px] text-muted">{s.batch} · {formatShortDate(s.enrollmentDate)}</p></div>
                    <StatusBadge status={s.status} />
                  </Link>
                ))}
                {activityFeeds.recentRegistrations.length === 0 && <p className="py-8 text-center text-sm text-muted">No recent registrations</p>}
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent payments" action={<Link to="/dashboard/finance" className="text-xs font-semibold text-brand hover:underline">Ledger →</Link>} />
          <div className="space-y-1 p-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                  <Skeleton className="h-8 w-8 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))
            ) : (
              <>
                {activityFeeds.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2 transition">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><Wallet className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.studentName}</p><p className="truncate text-[11px] text-muted">{formatShortDate(p.date)} · {p.method}</p></div>
                    <span className="num text-xs font-bold text-emerald-500">+{formatLkrPrice(p.amount)}</span>
                  </div>
                ))}
                {activityFeeds.recentPayments.length === 0 && <p className="py-8 text-center text-sm text-muted">No recent payments</p>}
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Active notices" action={<Link to="/dashboard/notices" className="text-xs font-semibold text-brand hover:underline">Manage →</Link>} />
          <div className="space-y-2 p-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-line p-3 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : (
              <>
                {activityFeeds.activeNotices.map((n) => (
                  <Link key={n.id} to="/dashboard/notices" className="block rounded-2xl border border-line p-3 transition hover:border-primary/40">
                    <div className="mb-1 flex items-center justify-between gap-2"><StatusBadge status={n.priority} /><span className="text-[11px] text-muted">until {formatShortDate(n.expiryDate)}</span></div>
                    <p className={cn("line-clamp-2 text-sm font-semibold leading-snug")}>{n.title}</p>
                    <p className="mt-1 truncate text-[11px] text-muted">{n.batches.length ? n.batches.join(", ") : "All batches"}</p>
                  </Link>
                ))}
                {activityFeeds.activeNotices.length === 0 && <p className="py-8 text-center text-sm text-muted">No active notices</p>}
                {(() => {
                  const more = (activityFeeds.activeNoticesTotal ?? 0) - activityFeeds.activeNotices.length;
                  return more > 0 ? (
                    <Link to="/dashboard/notices" className="block py-1 text-center text-xs font-semibold text-brand hover:underline">
                      +{more} more active notice{more > 1 ? "s" : ""} →
                    </Link>
                  ) : null;
                })()}
              </>
            )}
          </div>
        </Card>
      </div>

      <RecordPaymentModal
        open={pay}
        onClose={() => setPay(false)}
        onDone={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
