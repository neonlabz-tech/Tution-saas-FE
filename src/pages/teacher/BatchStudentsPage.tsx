import { useMemo, useState } from "react";
import { Mail, Phone, Users } from "lucide-react";
import { Avatar, Card, CardHeader, EmptyState, SearchInput, StatusBadge } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/overlays";
import { ErrorState } from "@/components/student/states";
import { AssignmentBadge } from "@/components/teacher/assignmentBadge";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { studentSubmissions } from "@/lib/teacherApi";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import type { TeacherStudent } from "@/types/teacher";

export default function BatchStudentsPage() {
  const { batch, students, studentsLoading, studentsError, reloadStudents } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<TeacherStudent | null>(null);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => !s || x.fullName.toLowerCase().includes(s) || x.id.toLowerCase().includes(s) || x.email.toLowerCase().includes(s));
  }, [students, q]);
  const work = useMemo(() => (sel && actor ? studentSubmissions(actor, batch, students, sel.id) : []), [sel, actor, batch, students]);

  const columns: Columns<TeacherStudent> = [
    { accessorKey: "fullName", header: "Student", cell: ({ row: { original: s } }) => (<div className="flex items-center gap-3"><Avatar name={s.fullName} size="sm" /><div className="min-w-0"><p className="truncate font-semibold">{s.fullName}</p><p className="num text-[11px] text-muted">{s.id}</p></div></div>) },
    { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span> },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="num text-xs">{getValue() as string}</span> },
    { accessorKey: "enrollmentDate", header: "Registered", cell: ({ getValue }) => <span className="text-xs text-muted">{fmtDate(getValue() as string)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  if (studentsError) return <ErrorState message={studentsError} onRetry={reloadStudents} />;
  return (
    <Card>
      <CardHeader title="Registered students" subtitle={`${students.length} in ${batch.batch}`} />
      <div className="p-5 pb-0"><SearchInput placeholder="Search name, registration no. or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></div>
      {students.length === 0 && !studentsLoading ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No students registered yet" text="Students appear here once the front office enrols them in this module and batch." />
      ) : (
        <DataTable data={rows} columns={columns} pageSize={10} loading={studentsLoading} onRowClick={setSel} emptyTitle="No students match" />
      )}
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.fullName} description={sel ? `${sel.id} · ${batch.batch}` : undefined}>
        {sel && (
          <div className="space-y-5">
            <div className="space-y-2 rounded-2xl border border-line p-4 text-sm">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" />{sel.email || "—"}</p>
              <p className="num flex items-center gap-2"><Phone className="h-4 w-4 text-muted" />{sel.phone || "—"}</p>
              <p className="text-xs text-muted">Registered {fmtDate(sel.enrollmentDate)}</p>
            </div>
            <div>
              <h3 className="mb-2 font-heading text-sm font-bold">Assignments &amp; marks</h3>
              <div className="space-y-2">
                {work.map(({ assignment, submission }) => (
                  <div key={assignment.id} className="rounded-2xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{assignment.title}</p><AssignmentBadge sub={submission} /></div>
                    <p className="mt-1 text-[11px] text-muted">{submission?.submittedAt ? `Submitted ${fmtDateTime(submission.submittedAt)}${submission.late ? " (late)" : ""}` : "Not submitted"}</p>
                    <p className="num mt-1 text-xs font-bold">{submission?.marks != null ? `${submission.marks} / ${assignment.maxMarks}` : `— / ${assignment.maxMarks}`}</p>
                  </div>
                ))}
                {work.length === 0 && <p className="text-sm text-muted">No assignments in this batch yet.</p>}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </Card>
  );
}
