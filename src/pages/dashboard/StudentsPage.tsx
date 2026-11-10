import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import type { Student } from "@/types";
import { Badge, Button, Card, PageHeader, SearchInput, Select, StatusBadge, Avatar } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { StudentFormModal } from "@/components/students/StudentFormModal";
import { StudentDetail } from "@/components/students/StudentDetail";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { fmtDate, fmtLKR } from "@/lib/utils";

export default function StudentsPage() {
  const { students, modules, outstanding, deleteStudent, getStudent } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [batch, setBatch] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<{ open: boolean; item: Student | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setForm({ open: true, item: null });
      setParams({}, { replace: true });
    } else if (params.get("q")) {
      setQ(params.get("q")!);
    }
  }, [params, setParams]);

  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter(
      (x) =>
        (!s || x.fullName.toLowerCase().includes(s) || x.id.toLowerCase().includes(s) || x.email.toLowerCase().includes(s)) &&
        (batch === "all" || x.batch === batch) &&
        (moduleId === "all" || x.moduleIds.includes(moduleId)) &&
        (status === "all" || x.status === status),
    );
  }, [students, q, batch, moduleId, status]);

  const columns = useMemo<Columns<Student>>(
    () => [
      {
        id: "student",
        header: "Student",
        accessorFn: (s) => s.fullName,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar name={row.original.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.fullName}</p>
              <p className="num text-[11px] text-muted">{row.original.id}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: "batch", header: "Batch", cell: (c) => <span className="text-sm">{c.getValue() as string}</span> },
      {
        id: "modules",
        header: "Modules",
        accessorFn: (s) => s.moduleIds.length,
        cell: ({ row }) => (
          <div className="flex max-w-[220px] flex-wrap gap-1">
            {row.original.moduleIds.slice(0, 2).map((id) => (
              <Badge key={id} tone="primary">{modules.find((m) => m.id === id)?.code}</Badge>
            ))}
            {row.original.moduleIds.length > 2 && <Badge>+{row.original.moduleIds.length - 2}</Badge>}
          </div>
        ),
      },
      { id: "enrolled", header: "Enrolled", accessorFn: (s) => s.enrollmentDate, cell: (c) => <span className="text-xs text-muted">{fmtDate(c.getValue() as string)}</span> },
      {
        id: "outstanding",
        header: "Outstanding",
        accessorFn: (s) => outstanding(s.id),
        cell: (c) => {
          const v = c.getValue() as number;
          return <span className={`num text-sm font-semibold ${v > 0 ? "text-rose-500" : "text-emerald-500"}`}>{v > 0 ? fmtLKR(v) : "Settled"}</span>;
        },
      },
      { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.getValue() as string} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label="View" onClick={() => setDetailId(row.original.id)}><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ open: true, item: row.original })}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ),
      },
    ],
    [modules, outstanding],
  );

  const activeCount = students.filter((s) => s.status === "active").length;
  const delStudent = delId ? getStudent(delId) : undefined;

  return (
    <>
      <PageHeader
        title="Students"
        description={`${students.length} students enrolled · ${activeCount} active. Each student gets a unique QR code for attendance and payments.`}
        actions={<Button onClick={() => setForm({ open: true, item: null })}><Plus className="h-4 w-4" /> Add student</Button>}
      />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput placeholder="Search name, ID or email…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:col-span-2 lg:col-span-1" />
          <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Filter by batch">
            <option value="all">All batches</option>
            {BATCHES.map((b) => <option key={b}>{b}</option>)}
          </Select>
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)} aria-label="Filter by module">
            <option value="all">All modules</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
          </Select>
        </div>
        <DataTable data={data} columns={columns} pageSize={8} onRowClick={(s) => setDetailId(s.id)} emptyTitle="No students found" />
      </Card>

      <StudentFormModal open={form.open} item={form.item} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      <StudentDetail
        studentId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => setForm({ open: true, item: getStudent(id) ?? null })}
        onDelete={(id) => setDelId(id)}
        onPay={(id) => setPayId(id)}
      />
      <RecordPaymentModal open={!!payId} studentId={payId ?? undefined} onClose={() => setPayId(null)} />
      <ConfirmDialog
        open={!!delId && !!delStudent}
        onClose={() => setDelId(null)}
        title="Delete student?"
        text={<>This removes <b>{delStudent?.fullName}</b> and their attendance records from the demo data. Payment history is kept for the finance ledger.</>}
        onConfirm={() => {
          if (delId) {
            deleteStudent(delId);
            if (detailId === delId) setDetailId(null);
            toast.success("Student deleted");
          }
        }}
      />
    </>
  );
}
