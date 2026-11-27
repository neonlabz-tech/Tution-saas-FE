import { Link } from "react-router-dom";
import { CalendarClock, ClipboardList, FolderOpen, MonitorPlay, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClassKindBadge } from "@/components/teacher/badges";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listAssignments, listMaterials, listRecordings } from "@/lib/teacherApi";
import { fmtDate, fmtTime, toLocalDT } from "@/lib/utils";

export default function BatchOverviewPage() {
  const { batch, students } = useBatchCtx();
  const { actor, classes } = useTeacherPortal();
  if (!actor) return null;
  const materials = listMaterials(actor, batch).length;
  const recordings = listRecordings(actor, batch).length;
  const assignments = listAssignments(actor, batch);
  const dueSoon = assignments.filter((a) => a.dueDate >= toLocalDT(new Date())).length;
  const now = toLocalDT(new Date());
  const upcoming = classes.filter((c) => c.batchId === batch.id && (c.status === "scheduled" || c.status === "postponed") && c.end >= now).slice(0, 4);
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="students"><StatCard index={0} label="Students" value={String(students.length)} icon={Users} gradient="from-indigo-500 to-violet-500" color="#6366F1" sub="Registered in this batch" /></Link>
        <Link to="materials"><StatCard index={1} label="Study materials" value={String(materials)} icon={FolderOpen} gradient="from-teal-500 to-emerald-500" color="#14B8A6" sub="Files and links" /></Link>
        <Link to="recordings"><StatCard index={2} label="Recordings" value={String(recordings)} icon={MonitorPlay} gradient="from-fuchsia-500 to-purple-500" color="#A855F7" sub="Recorded classes" /></Link>
        <Link to="assignments"><StatCard index={3} label="Assignments" value={String(assignments.length)} icon={ClipboardList} gradient="from-amber-500 to-orange-500" color="#F59E0B" sub={`${dueSoon} not yet due`} /></Link>
      </div>
      <Card>
        <CardHeader title="Upcoming classes for this batch" />
        <div className="space-y-2 p-4">
          {upcoming.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/70 p-3">
              <div className="min-w-0"><p className="truncate text-sm font-bold">{c.title}</p><p className="num text-[11px] text-muted">{fmtDate(c.start, false)} · {fmtTime(c.start)} – {fmtTime(c.end)}{c.location ? ` · ${c.location}` : ""}</p></div>
              <ClassKindBadge kind={c.kind} />
            </div>
          ))}
          {upcoming.length === 0 && <p className="py-6 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming classes.</p>}
        </div>
      </Card>
    </>
  );
}
