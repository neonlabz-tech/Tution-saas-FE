import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Lock, Megaphone, Pencil } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Textarea } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { ErrorState } from "@/components/student/states";
import { AssignmentBadge } from "@/components/teacher/assignmentBadge";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { NoAccess, useReport } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listSubmissions, publishMarks, setMarks, type SubmissionRow } from "@/lib/teacherApi";
import { ForbiddenError } from "@/lib/teacherPolicy";
import { downloadSampleSubmission, openLink } from "@/lib/teacherFiles";
import { fmtDateTime } from "@/lib/utils";

export default function AssignmentDetailPage() {
  const { assignmentId = "" } = useParams();
  const { batch, students, studentsError, reloadStudents } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const toast = useToast();
  const report = useReport();
  const [tick, setTick] = useState(0);
  const [edit, setEdit] = useState<SubmissionRow | null>(null);
  const [marks, setMarksVal] = useState("");
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!actor) return null;
    try { return listSubmissions(actor, batch, assignmentId, students); } catch (e) { return e instanceof ForbiddenError ? "denied" as const : null; }
  }, [actor, batch, assignmentId, students, tick]);

  if (studentsError) return <ErrorState message={studentsError} onRetry={reloadStudents} />;
  if (data === "denied" || !data) return <NoAccess text="That assignment isn't part of this batch." />;
  const { assignment, rows, publication } = data;
  const locked = !!publication;
  const submitted = rows.filter((r) => r.submission.submittedAt);
  const unmarked = submitted.filter((r) => r.submission.marks === null).length;

  const openEdit = (r: SubmissionRow) => { setEdit(r); setMarksVal(r.submission.marks?.toString() ?? ""); setFeedback(r.submission.feedback ?? ""); setErr(null); };
  const saveMarks = () => {
    if (!edit || !actor) return;
    const n = marks.trim() === "" ? null : Number(marks);
    if (n !== null && !Number.isFinite(n)) { setErr("Enter a number."); return; }
    try {
      setMarks(actor, batch, assignment.id, edit.student.id, n, feedback);
      toast.success("Marks saved");
      setEdit(null);
      setTick((t) => t + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save marks."); }
  };
  const publish = async () => {
    if (!actor) return;
    setBusy(true);
    try { await publishMarks(actor, batch, assignment.id, students); toast.success("Marks published to students via Notices"); setTick((t) => t + 1); } catch (e) { report(e); }
    setBusy(false);
    setConfirm(false);
  };
  const download = (r: SubmissionRow) => (r.submission.fileUrl ? openLink(r.submission.fileUrl, r.submission.fileName ?? undefined) : downloadSampleSubmission(r.submission.fileName ?? "submission.pdf", r.student.fullName, assignment.title));

  const columns: Columns<SubmissionRow> = [
    { id: "student", header: "Student", accessorFn: (r) => r.student.fullName, cell: ({ row: { original: r } }) => (<div className="flex items-center gap-3"><Avatar name={r.student.fullName} size="sm" /><div className="min-w-0"><p className="truncate font-semibold">{r.student.fullName}</p><p className="num text-[11px] text-muted">{r.student.id}</p></div></div>) },
    { id: "status", header: "Status", accessorFn: (r) => r.submission.marks !== null ? 2 : r.submission.submittedAt ? 1 : 0, cell: ({ row: { original: r } }) => <AssignmentBadge sub={r.submission} /> },
    { id: "at", header: "Submitted", accessorFn: (r) => r.submission.submittedAt ?? "", cell: ({ row: { original: r } }) => <span className="text-xs text-muted">{r.submission.submittedAt ? fmtDateTime(r.submission.submittedAt) : "—"}</span> },
    { id: "marks", header: "Marks", accessorFn: (r) => r.submission.marks ?? -1, cell: ({ row: { original: r } }) => <span className="num font-semibold">{r.submission.marks ?? "—"}<span className="text-xs font-normal text-muted"> / {assignment.maxMarks}</span></span> },
    { id: "actions", header: "", enableSorting: false, cell: ({ row: { original: r } }) => (
      <div className="flex justify-end gap-1.5">
        {r.submission.submittedAt && <Button size="sm" variant="secondary" onClick={() => download(r)} aria-label={`Download submission by ${r.student.fullName}`}><Download className="h-3.5 w-3.5" /></Button>}
        {r.submission.submittedAt && <Button size="sm" variant="soft" disabled={locked} onClick={() => openEdit(r)} aria-label={`${r.submission.marks === null ? "Enter" : "Edit"} marks for ${r.student.fullName}`}><Pencil className="h-3.5 w-3.5" /> {r.submission.marks === null ? "Mark" : "Edit"}</Button>}
      </div>) },
  ];

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> All assignments</Link>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0"><h2 className="font-heading text-lg font-bold">{assignment.title}</h2><p className="mt-1 max-w-2xl text-sm text-muted">{assignment.description}</p><p className="mt-2 text-xs text-muted">Due {fmtDateTime(assignment.dueDate)} · {assignment.maxMarks} marks · {submitted.length}/{rows.length} submitted</p></div>
          {locked ? <Badge tone="green"><Lock className="mr-1 inline h-3 w-3" />Published · locked</Badge> : <Button onClick={() => setConfirm(true)} disabled={submitted.length === 0}><Megaphone className="h-4 w-4" /> Publish marks</Button>}
        </div>
        {!locked && unmarked > 0 && <p className="border-t border-line px-5 py-2.5 text-xs text-amber-600 dark:text-amber-400">{unmarked} submission{unmarked > 1 ? "s" : ""} still need marks before you can publish.</p>}
      </Card>
      <Card>
        <CardHeader title="Submissions" subtitle="Students only ever see their own mark, and only after you publish." />
        <DataTable columns={columns} data={rows} pageSize={10} emptyTitle="No students in this batch" />
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Marks · ${edit?.student.fullName ?? ""}`} description={assignment.title}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={saveMarks}>Save marks</Button></>}>
        <div className="space-y-4">
          {err && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
          <Field label={`Marks (0–${assignment.maxMarks})`}><Input type="number" min={0} max={assignment.maxMarks} step="0.5" value={marks} onChange={(e) => setMarksVal(e.target.value)} aria-label="Marks" /></Field>
          <Field label="Feedback (optional)"><Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label="Feedback" /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => !busy && setConfirm(false)} title="Publish these marks?" confirmVariant="primary" confirmLabel="Publish marks" loading={busy}
        text={<>A results notice with the class summary is sent to {batch.batch}. Each student sees only their own mark. Published marks are locked and can’t be edited afterwards.</>} onConfirm={publish} />
    </>
  );
}
