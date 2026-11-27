import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CalendarDays, MapPin, Users, Video } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClassCalendar } from "@/components/teacher/ClassCalendar";
import { ClassKindBadge, ClassStatusBadge } from "@/components/teacher/badges";
import { TeacherGate } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listBatchStudents } from "@/lib/teacherApi";
import { addDays, fmtDate, fmtTime, toISO, toLocalDT } from "@/lib/utils";

export default function TeacherOverviewPage() {
  const { profile, batches, classes, actor } = useTeacherPortal();
  const [unique, setUnique] = useState<number | null>(null);

  // Distinct students across all assigned batches (a student in two of your batches is counted once).
  useEffect(() => {
    if (!actor || !batches.length) return setUnique(0);
    let active = true;
    Promise.all(batches.map((b) => listBatchStudents(actor, b)))
      .then((lists) => active && setUnique(new Set(lists.flat().map((s) => s.id)).size))
      .catch(() => active && setUnique(null));
    return () => {
      active = false;
    };
  }, [actor, batches]);

  const view = useMemo(() => {
    const now = toLocalDT(new Date());
    const weekEnd = `${toISO(addDays(new Date(), 7))}T23:59`;
    const live = classes.filter((c) => (c.status === "scheduled" || c.status === "postponed") && c.end >= now);
    return { upcoming: live.slice(0, 5), week: live.filter((c) => c.start <= weekEnd).length, weekOnline: live.filter((c) => c.start <= weekEnd && c.kind === "online").length };
  }, [classes]);

  const totalStudents = unique ?? batches.reduce((s, b) => s + b.studentCount, 0);
  const maxCount = Math.max(1, ...batches.map((b) => b.studentCount));
  const first = (profile?.fullName ?? "").replace(/^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i, "").split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <TeacherGate>
      <section className="grain relative mb-6 overflow-hidden rounded-[2rem] bg-mesh p-6 text-white shadow-pop sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Badge className="bg-white/15 text-white">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Badge>
            <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{greet}, {first} 👋</h1>
            <p className="mt-2 text-sm text-white/80 sm:text-base"><b className="num">{batches.length}</b> batches · <b className="num">{totalStudents}</b> students · <b className="num">{view.week}</b> classes in the next 7 days</p>
          </div>
          <Link to="/teacher/batches" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25"><Users className="h-4 w-4" /> My batches</Link>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Assigned batches" value={String(batches.length)} icon={Users} gradient="from-indigo-500 to-violet-500" color="#6366F1" sub={`${batches.filter((b) => b.status === "active").length} active`} />
        <StatCard index={1} label="Total students" value={String(totalStudents)} icon={Users} gradient="from-teal-500 to-emerald-500" color="#14B8A6" sub="Across all your batches" />
        <StatCard index={2} label="Classes this week" value={String(view.week)} icon={CalendarDays} gradient="from-fuchsia-500 to-purple-500" color="#A855F7" sub={`${view.weekOnline} online · ${view.week - view.weekOnline} physical`} />
        <StatCard index={3} label="Next class" value={view.upcoming[0] ? fmtTime(view.upcoming[0].start) : "—"} icon={CalendarClock} gradient="from-amber-500 to-orange-500" color="#F59E0B" sub={view.upcoming[0] ? `${fmtDate(view.upcoming[0].start, false)} · ${view.upcoming[0].batch}` : "Nothing scheduled"} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Students per batch" subtitle="Registered students in each batch you teach" action={<Link to="/teacher/batches" className="text-xs font-semibold text-brand hover:underline">All batches →</Link>} />
          <div className="space-y-3 p-5">
            {batches.map((b) => (
              <Link key={b.id} to={`/teacher/batches/${b.id}`} className="block rounded-2xl border border-line p-3.5 transition hover:border-primary/40 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{b.moduleName}</p><p className="truncate text-[11px] text-muted">{b.batch}</p></div><span className="num shrink-0 text-lg font-bold">{b.studentCount}</span></div>
                <ProgressBar className="mt-2" value={(b.studentCount / maxCount) * 100} tone="teal" />
              </Link>
            ))}
            {batches.length === 0 && <EmptyState icon={<Users className="h-6 w-6" />} title="No batches assigned yet" text="The front office assigns modules and batches to you. They will appear here automatically." />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming classes" subtitle="Your next sessions" />
          <div className="space-y-2 p-4">
            {view.upcoming.map((c) => (
              <div key={c.id} className="rounded-2xl bg-surface-2/70 p-3">
                <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 text-sm font-bold">{c.moduleName}</p><ClassKindBadge kind={c.kind} /></div>
                <p className="num mt-0.5 text-[11px] text-muted">{fmtDate(c.start, false)} · {fmtTime(c.start)} – {fmtTime(c.end)}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-muted">{c.kind === "physical" ? <><MapPin className="h-3 w-3" />{c.location}</> : <><Video className="h-3 w-3" />{c.batch}</>}</span>
                  {c.status === "postponed" ? <ClassStatusBadge status="postponed" /> : c.kind === "online" && c.link ? <a href={c.link} target="_blank" rel="noreferrer noopener" className="text-[11px] font-semibold text-brand hover:underline">Join →</a> : null}
                </div>
              </div>
            ))}
            {view.upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming classes.</p>}
            <a href="#class-calendar"><Button variant="soft" size="sm" className="mt-1 w-full">Open calendar <ArrowRight className="h-3.5 w-3.5" /></Button></a>
          </div>
        </Card>
      </div>

      <div id="class-calendar" className="scroll-mt-24"><h2 className="mb-3 font-heading text-lg font-bold">Class calendar</h2><ClassCalendar classes={classes} /></div>
    </TeacherGate>
  );
}
