import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock, Clock, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SearchInput, StatusBadge } from "@/components/ui/primitives";
import { TeacherGate } from "@/components/teacher/bits";
import { COLORS } from "@/components/analytics/chartParts";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { fmtDate, fmtTime, toLocalDT } from "@/lib/utils";

export default function TeacherBatchesPage() {
  const { batches, classes } = useTeacherPortal();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return batches.filter((b) => !s || b.moduleName.toLowerCase().includes(s) || b.batch.toLowerCase().includes(s) || b.moduleCode.toLowerCase().includes(s));
  }, [batches, q]);
  const nextFor = (id: string) => {
    const now = toLocalDT(new Date());
    return classes.find((c) => c.batchId === id && (c.status === "scheduled" || c.status === "postponed") && c.end >= now);
  };
  return (
    <TeacherGate cards={3}>
      <PageHeader title="My Batches" description={`You teach ${batches.length} batch${batches.length === 1 ? "" : "es"}. Open one to manage students, materials, recordings and assignments.`} />
      <Card className="mb-6 p-4"><SearchInput placeholder="Search by module, code or batch…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search batches" /></Card>
      {list.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="h-6 w-6" />} title={batches.length ? "No batches match" : "No batches assigned yet"} text={batches.length ? "Try a different search." : "The front office assigns modules and batches to you. They will appear here automatically."} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const color = COLORS[batches.findIndex((x) => x.id === b.id) % COLORS.length];
            const next = nextFor(b.id);
            return (
              <Link key={b.id} to={`/teacher/batches/${b.id}`} aria-label={`Open ${b.moduleName} ${b.batch}`} className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card className="flex h-full flex-col overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
                  <div className="h-1.5" style={{ background: color }} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: color }}><BookOpen className="h-5 w-5" /></div>
                      <div className="flex items-center gap-2"><Badge tone="primary">{b.moduleCode}</Badge><StatusBadge status={b.status} /></div>
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-bold leading-snug">{b.moduleName}</h3>
                    <p className="mt-0.5 text-sm font-semibold text-brand">{b.batch}</p>
                    <ul className="mt-4 space-y-1.5 text-xs text-muted">
                      <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 shrink-0" /><span className="num font-semibold text-ink">{b.studentCount}</span> registered students</li>
                      <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" />{b.schedule}</li>
                    </ul>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted"><CalendarClock className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{next ? `Next: ${fmtDate(next.start, false)}, ${fmtTime(next.start)}` : "No upcoming class"}</span></span>
                      <span className="flex shrink-0 items-center gap-1 font-semibold text-brand">Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </TeacherGate>
  );
}
