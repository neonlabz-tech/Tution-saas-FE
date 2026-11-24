import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock, CalendarDays, ClipboardList, CreditCard, Megaphone, Receipt, Video, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataGate } from "@/components/student/states";
import { DueBadge, PaymentBadge } from "@/components/student/badges";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentData } from "@/hooks/useStudentData";
import type { Notice } from "@/types";
import { addDays, fmtDate, fmtLKR, fmtTime, toISO, toLocalDT } from "@/lib/utils";

export default function StudentOverviewPage() {
  const { account } = useStudentAuth();
  const { data, loading, error, reload } = useStudentData();
  const [notice, setNotice] = useState<Notice | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const now = toLocalDT(new Date());
    const weekEnd = `${toISO(addDays(new Date(), 7))}T23:59`;
    const upcomingOnline = data.onlineClasses.filter((c) => c.status === "scheduled" && c.end >= now).slice(0, 5);
    const weekOnline = data.onlineClasses.filter((c) => c.status === "scheduled" && c.end >= now && c.start <= weekEnd).length;
    const weekPhysical = data.physicalClasses.filter((c) => c.status === "scheduled" && c.end >= now && c.start <= weekEnd).length;
    const openAssignments = data.assignments.filter((a) => a.status === "pending" || a.status === "overdue");
    return { upcomingOnline, weekOnline, weekPhysical, openAssignments, overdueAssignments: openAssignments.filter((a) => a.status === "overdue").length };
  }, [data]);

  const firstName = (account?.fullName ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload}>
      {data && view && (
        <>
          {/* Hero */}
          <section className="grain relative mb-6 overflow-hidden rounded-[2rem] bg-mesh p-6 text-white shadow-pop sm:p-8">
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <Badge className="bg-white/15 text-white">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Badge>
                <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{greet}, {firstName} 👋</h1>
                <p className="mt-2 text-sm text-white/80 sm:text-base">
                  <b className="num">{view.weekOnline + view.weekPhysical}</b> classes in the next 7 days · <b className="num">{view.openAssignments.length}</b> open assignments · <b className="num">{fmtLKR(data.paymentSummary.outstanding)}</b> outstanding
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "My Modules", icon: BookOpen, to: "/student/modules" },
                  { label: "Payments", icon: CreditCard, to: "/student/payments" },
                  ...(view.upcomingOnline[0] ? [{ label: "Next class", icon: CalendarClock, to: `/student/modules/${view.upcomingOnline[0].moduleId}?tab=calendar` }] : []),
                ].map((q) => (
                  <Link key={q.label} to={q.to} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25 active:scale-95 sm:text-sm">
                    <q.icon className="h-4 w-4" />
                    {q.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} label="Registered modules" value={String(data.modules.length)} icon={BookOpen} gradient="from-indigo-500 to-violet-500" color="#6366F1" sub={`${data.modules.filter((m) => m.status === "active").length} currently active`} />
            <StatCard index={1} label="Classes this week" value={String(view.weekOnline + view.weekPhysical)} icon={CalendarDays} gradient="from-teal-500 to-emerald-500" color="#14B8A6" sub={`${view.weekOnline} online · ${view.weekPhysical} on-site`} />
            <StatCard index={2} label="Open assignments" value={String(view.openAssignments.length)} icon={ClipboardList} gradient="from-fuchsia-500 to-purple-500" color="#A855F7" sub={view.overdueAssignments ? `${view.overdueAssignments} overdue` : "Nothing overdue"} />
            <StatCard index={3} label="Outstanding balance" value={fmtLKR(data.paymentSummary.outstanding)} icon={Wallet} gradient="from-amber-500 to-orange-500" color="#F59E0B" sub={data.dues.length ? `${data.dues.length} payment${data.dues.length > 1 ? "s" : ""} due` : "All fees settled"} />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            {/* Notices */}
            <Card className="xl:col-span-2">
              <CardHeader title="Notices & announcements" subtitle={`${data.notices.length} active for your batch`} />
              <div className="space-y-2 p-4">
                {data.notices.slice(0, 5).map((n) => (
                  <button key={n.id} onClick={() => setNotice(n)} className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 text-left transition hover:border-primary/40 hover:bg-surface-2">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.priority === "high" ? "bg-rose-500/10 text-rose-500" : n.priority === "medium" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-brand"}`}>
                      <Megaphone className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{n.title}</span>
                        <StatusBadge status={n.priority} />
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted">{n.description}</span>
                      <span className="mt-1.5 block text-[11px] text-muted">Posted {fmtDate(n.publishDate, false)} · {n.batches.length ? n.batches.join(", ") : "All batches"}</span>
                    </span>
                  </button>
                ))}
                {data.notices.length === 0 && <p className="py-10 text-center text-sm text-muted"><Megaphone className="mx-auto mb-2 h-6 w-6" />No announcements right now.</p>}
              </div>
            </Card>

            {/* Upcoming online classes */}
            <Card>
              <CardHeader title="Upcoming online classes" subtitle="Your next live sessions" />
              <div className="space-y-2 p-4">
                {view.upcomingOnline.map((c) => {
                  const mod = data.modules.find((m) => m.id === c.moduleId);
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
                      <Link to={`/student/modules/${c.moduleId}?tab=calendar`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="w-12 shrink-0 rounded-xl bg-primary/10 py-1.5 text-center text-brand">
                          <p className="text-[10px] font-bold uppercase">{new Date(c.start).toLocaleDateString("en-US", { month: "short" })}</p>
                          <p className="num text-base font-bold leading-none">{c.start.slice(8, 10)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{c.title}</p>
                          <p className="num truncate text-[11px] text-muted">{new Date(c.start).toLocaleDateString("en-US", { weekday: "short" })} · {fmtTime(c.start)} – {fmtTime(c.end)}</p>
                          <p className="truncate text-[11px] text-muted">{mod?.teacher?.fullName ?? mod?.name}</p>
                        </div>
                      </Link>
                      <a href={c.link} target="_blank" rel="noreferrer" aria-label={`Join ${c.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand hover:bg-primary/10">
                        <Video className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
                {view.upcomingOnline.length === 0 && <p className="py-10 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming online classes.</p>}
                <Link to="/student/modules"><Button variant="soft" size="sm" className="mt-1 w-full">View module calendars <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Outstanding */}
            <Card>
              <CardHeader title="Outstanding & due payments" subtitle="What you owe and when" action={<Link to="/student/payments" className="text-xs font-semibold text-brand hover:underline">Payments →</Link>} />
              <div className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted">Total outstanding</p>
                    <p className={`num text-3xl font-bold ${data.paymentSummary.outstanding > 0 ? "text-ink" : "text-emerald-500"}`}>{fmtLKR(data.paymentSummary.outstanding)}</p>
                  </div>
                  {data.paymentSummary.overdue > 0 && <Badge tone="rose">{fmtLKR(data.paymentSummary.overdue)} overdue</Badge>}
                </div>
                <ProgressBar className="mt-4" tone={data.paymentSummary.overdue > 0 ? "amber" : "teal"} value={data.paymentSummary.totalFees ? (data.paymentSummary.paid / data.paymentSummary.totalFees) * 100 : 0} />
                <p className="mt-1.5 text-[11px] text-muted">{fmtLKR(data.paymentSummary.paid)} paid of {fmtLKR(data.paymentSummary.totalFees)} course fees</p>
                {data.paymentSummary.pendingVerification > 0 && <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">{fmtLKR(data.paymentSummary.pendingVerification)} is awaiting bank-transfer confirmation.</p>}
                <div className="mt-4 space-y-2">
                  {data.dues.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.moduleName}</p>
                        <p className="text-[11px] text-muted">Due {fmtDate(d.dueDate)}</p>
                      </div>
                      <span className="num text-sm font-bold">{fmtLKR(d.amount)}</span>
                      <DueBadge status={d.status} />
                    </div>
                  ))}
                  {data.dues.length === 0 && <p className="py-4 text-center text-sm text-emerald-600 dark:text-emerald-400">You're fully paid up. Nothing due 🎉</p>}
                </div>
              </div>
            </Card>

            {/* Payment history */}
            <Card>
              <CardHeader title="Recent payments" subtitle="Your latest transactions" action={<Link to="/student/payments" className="text-xs font-semibold text-brand hover:underline">All payments →</Link>} />
              <div className="space-y-1 p-3">
                {data.payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}><Receipt className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.description}</p>
                      <p className="truncate text-[11px] text-muted">{fmtDate(p.date)} · {p.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-xs font-bold">{fmtLKR(p.amount)}</p>
                      <PaymentBadge status={p.status} />
                    </div>
                  </div>
                ))}
                {data.payments.length === 0 && <p className="py-10 text-center text-sm text-muted">No payments recorded yet.</p>}
              </div>
            </Card>
          </div>

          <Modal open={!!notice} onClose={() => setNotice(null)} title={notice?.title} description={notice ? `Posted ${fmtDate(notice.publishDate)} · ${notice.batches.length ? notice.batches.join(", ") : "All batches"}` : undefined} footer={<Button variant="secondary" onClick={() => setNotice(null)}>Close</Button>}>
            {notice && (
              <div className="space-y-3">
                <StatusBadge status={notice.priority} />
                <p className="text-sm leading-relaxed">{notice.description}</p>
                <p className="text-xs text-muted">Valid until {fmtDate(notice.expiryDate)}</p>
              </div>
            )}
          </Modal>
        </>
      )}
    </DataGate>
  );
}
