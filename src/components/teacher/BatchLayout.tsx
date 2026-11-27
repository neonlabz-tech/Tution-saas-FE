import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ClipboardList, FolderOpen, LayoutGrid, MonitorPlay, Table2, Users } from "lucide-react";
import { Badge, Card, StatusBadge } from "@/components/ui/primitives";
import { COLORS } from "@/components/analytics/chartParts";
import { NoAccess, TeacherGate } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listBatchStudents } from "@/lib/teacherApi";
import { cn } from "@/lib/utils";
import type { TeacherBatch, TeacherStudent } from "@/types/teacher";

export interface BatchCtx {
  batch: TeacherBatch;
  students: TeacherStudent[];
  studentsLoading: boolean;
  studentsError: string | null;
  reloadStudents: () => void;
}
export const useBatchCtx = () => useOutletContext<BatchCtx>();

const TABS = [
  { to: "", label: "Overview", icon: LayoutGrid, end: true },
  { to: "students", label: "Students", icon: Users },
  { to: "materials", label: "Study materials", icon: FolderOpen },
  { to: "recordings", label: "Recordings", icon: MonitorPlay },
  { to: "assignments", label: "Assignments", icon: ClipboardList },
  { to: "marks", label: "Marks", icon: Table2 },
];

/** Route layout for /teacher/batches/:batchId/*. A batch that isn't in the teacher's own list is refused outright. */
export function BatchLayout() {
  const { batchId = "" } = useParams();
  const { batches, actor } = useTeacherPortal();
  const batch = batches.find((b) => b.id === batchId);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [studentsLoading, setLoading] = useState(true);
  const [studentsError, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reloadStudents = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!batch || !actor) return;
    let active = true;
    setLoading(true);
    setError(null);
    listBatchStudents(actor, batch)
      .then((s) => active && setStudents(s))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load students."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [batch, actor, tick]);

  return (
    <TeacherGate cards={3}>
      {!batch ? (
        <NoAccess />
      ) : (
        <>
          <Link to="/teacher/batches" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> My batches</Link>
          <Card className="mb-5 overflow-hidden">
            <div className="h-2" style={{ background: COLORS[batches.findIndex((b) => b.id === batch.id) % COLORS.length] }} />
            <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-brand"><BookOpen className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="primary">{batch.moduleCode}</Badge><StatusBadge status={batch.status} /></div>
                <h1 className="mt-1 font-heading text-2xl font-extrabold tracking-tight">{batch.moduleName}</h1>
                <p className="text-sm font-semibold text-brand">{batch.batch}</p>
              </div>
              <div className="text-right"><p className="num text-3xl font-bold">{studentsLoading ? batch.studentCount : students.length}</p><p className="text-xs text-muted">students</p></div>
            </div>
          </Card>
          <nav aria-label="Batch sections" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
            {TABS.map((t) => (
              <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => cn("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors", isActive ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
          <Outlet context={{ batch, students, studentsLoading, studentsError, reloadStudents } satisfies BatchCtx} />
        </>
      )}
    </TeacherGate>
  );
}
