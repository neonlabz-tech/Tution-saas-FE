import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight, ClipboardList } from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { ErrorState } from "@/components/student/states";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listAssignments, listSubmissions } from "@/lib/teacherApi";
import { fmtDateTime } from "@/lib/utils";

export default function BatchAssignmentsPage() {
  const { batch, students, studentsError, reloadStudents } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const items = useMemo(() => {
    if (!actor) return [];
    return listAssignments(actor, batch).map((a) => {
      const { rows, publication } = listSubmissions(actor, batch, a.id, students);
      const submitted = rows.filter((r) => r.submission.submittedAt).length;
      const marked = rows.filter((r) => r.submission.marks !== null).length;
      return { a, total: rows.length, submitted, marked, published: !!publication };
    });
  }, [actor, batch, students]);

  if (studentsError) return <ErrorState message={studentsError} onRetry={reloadStudents} />;
  if (items.length === 0) return <Card><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No assignments yet" text="Assignments set for this batch appear here with their submissions." /></Card>;
  return (
    <div className="space-y-3">
      {items.map(({ a, total, submitted, marked, published }) => (
        <Link key={a.id} to={a.id} className="block">
          <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:border-primary/40">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{a.title}</p>{published ? <Badge tone="green">Published</Badge> : marked === submitted && submitted > 0 ? <Badge tone="amber">Ready to publish</Badge> : <Badge tone="neutral">Marking</Badge>}</div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="h-3 w-3" />Due {fmtDateTime(a.dueDate)} · {a.maxMarks} marks</p>
            </div>
            <div className="w-full sm:w-56">
              <p className="mb-1 flex justify-between text-[11px] text-muted"><span>{submitted}/{total} submitted</span><span>{marked} marked</span></p>
              <ProgressBar value={submitted ? (marked / submitted) * 100 : 0} />
            </div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
