import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { ErrorState } from "@/components/student/states";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { useToast } from "@/components/ui/toast";
import { buildMarksTable } from "@/lib/teacherApi";
import { exportMarksXlsx } from "@/lib/teacherFiles";

export default function BatchMarksPage() {
  const { batch, students, studentsError, reloadStudents } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const toast = useToast();
  const t = useMemo(() => (actor ? buildMarksTable(actor, batch, students) : null), [actor, batch, students]);
  if (studentsError) return <ErrorState message={studentsError} onRetry={reloadStudents} />;
  if (!t) return null;
  if (!students.length || !t.assignments.length) return <Card><EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="Nothing to show yet" text="Marks appear once the batch has students and assignments." /></Card>;
  return (
    <Card>
      <CardHeader title="Marks sheet" subtitle={`${students.length} students · ${t.assignments.length} assignments`} action={<Button variant="secondary" onClick={() => { exportMarksXlsx(batch, t.assignments, t.rows, t.published); toast.success("Marks exported to Excel"); }}><Download className="h-4 w-4" /> Export Excel</Button>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-5 py-3 font-semibold">Student</th>
            {t.assignments.map((a) => (<th key={a.id} className="px-3 py-3 font-semibold"><span className="block max-w-[9rem] truncate">{a.title}</span><span className="flex items-center gap-1 font-normal">/ {a.maxMarks} {t.published.has(a.id) ? <Badge tone="green">Published</Badge> : <Badge tone="neutral">Draft</Badge>}</span></th>))}
            <th className="px-5 py-3 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.student.id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={r.student.fullName} size="sm" /><span className="font-semibold">{r.student.fullName}</span></div></td>
                {t.assignments.map((a) => (<td key={a.id} className="num px-3 py-3">{r.marks[a.id] ?? <span className="text-muted">—</span>}</td>))}
                <td className="num px-5 py-3 text-right font-bold">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
