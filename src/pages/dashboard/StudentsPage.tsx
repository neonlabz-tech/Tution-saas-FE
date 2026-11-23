import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SortingState } from "@tanstack/react-table";
import { ArrowRightLeft, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import type { BatchItem, Module, StudentDetail as StudentDetailType, StudentListItem, StudentSortBy } from "@/types";
import { Avatar, Badge, Button, Card, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { listModules } from "@/api/modules";
import { listBatches } from "@/api/batches";
import { deleteStudent } from "@/api/students";
import { useStudents } from "@/hooks/useStudents";
import { BATCHES } from "@/lib/constants";
import { StudentFormModal } from "@/components/students/StudentFormModal";
import { StudentDetail } from "@/components/students/StudentDetail";
import { MoveBatchModal } from "@/components/students/MoveBatchModal";
import { RecordPaymentModal, type PaymentStudentSummary } from "@/components/finance/RecordPaymentModal";
import { fmtDate, fmtLKR } from "@/lib/utils";

const PAGE_LIMIT = 8;

const SORTABLE_COLUMNS: ReadonlySet<string> = new Set<StudentSortBy>([
  "fullName",
  "id",
  "batch",
  "enrollmentDate",
  "status",
  "createdAt",
  "feeTotal",
  "paidTotal",
  "outstanding",
]);

export default function StudentsPage() {
  const toast = useToast();
  const { refreshStudents } = useAppData();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const lastUrlQRef = useRef<string | null>(params.get("q"));

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ.trim());
  const [batch, setBatch] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [modules, setModules] = useState<Module[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [form, setForm] = useState<{ open: boolean; item: StudentListItem | StudentDetailType | null }>({
    open: false,
    item: null,
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [delTarget, setDelTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [payState, setPayState] = useState<{
    open: boolean;
    studentId?: string;
    summary?: PaymentStudentSummary;
  }>({ open: false });

  useEffect(() => {
    const controller = new AbortController();
    listModules({}, controller.signal)
      .then(setModules)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    listBatches({}, controller.signal)
      .then(setBatches)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (params.get("new") === "1") {
      setForm({ open: true, item: null });
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
      return;
    }
    const urlQ = params.get("q");
    if (urlQ !== lastUrlQRef.current) {
      lastUrlQRef.current = urlQ;
      const nextQ = urlQ ?? "";
      setQ(nextQ);
      setDebouncedQ(nextQ.trim());
      setPage(1);
    }
  }, [params, setParams]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === debouncedQ) return;
    const timer = window.setTimeout(() => {
      setDebouncedQ(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, debouncedQ]);

  const activeSort = sorting[0];
  const sortBy = activeSort && SORTABLE_COLUMNS.has(activeSort.id) ? (activeSort.id as StudentSortBy) : undefined;
  const sortOrder = sortBy ? (activeSort.desc ? "desc" : "asc") : undefined;

  const { data, loading, error, refetch } = useStudents({
    q: debouncedQ || undefined,
    batch,
    moduleId,
    status: status as "all" | "pending" | "active" | "inactive" | "graduated",
    page,
    limit: PAGE_LIMIT,
    sortBy,
    sortOrder,
  });

  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { total: 0, page, limit: PAGE_LIMIT, totalPages: 1 };
  const summary = data?.summary ?? { total: 0, activeCount: 0, filteredTotal: 0 };

  const columns = useMemo<Columns<StudentListItem>>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: () => {
          const pageIds = items.map((s) => s.id);
          const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
          const someSelected = pageIds.some((id) => selectedIds.has(id)) && !allSelected;
          return (
            <div className="flex items-center pl-1">
              <input
                type="checkbox"
                aria-label="Select all students on this page"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked) {
                      pageIds.forEach((id) => next.add(id));
                    } else {
                      pageIds.forEach((id) => next.delete(id));
                    }
                    return next;
                  });
                }}
                className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30 accent-primary cursor-pointer"
              />
            </div>
          );
        },
        cell: ({ row }) => {
          const id = row.original.id;
          const isChecked = selectedIds.has(id);
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center pl-1"
            >
              <input
                type="checkbox"
                aria-label={`Select student ${row.original.fullName}`}
                checked={isChecked}
                onChange={() => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30 accent-primary cursor-pointer"
              />
            </div>
          );
        },
      },
      {
        id: "fullName",
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
      {
        accessorKey: "batch",
        header: "Batch",
        cell: (c) => <span className="text-sm">{c.getValue() as string}</span>,
      },
      {
        id: "modules",
        header: "Modules",
        enableSorting: false,
        cell: ({ row }) => {
          const mods =
            row.original.modules?.length
              ? row.original.modules
              : (row.original.moduleIds ?? [])
                  .map((id) => moduleMap.get(id))
                  .filter((m): m is Module => Boolean(m));
          const count = mods.length || (row.original.moduleIds?.length ?? 0);
          return (
            <div className="flex max-w-[220px] flex-wrap gap-1">
              {mods.slice(0, 2).map((m) => (
                <Badge key={m.id} tone="primary">
                  {m.code}
                </Badge>
              ))}
              {count > 2 && <Badge>+{count - 2}</Badge>}
              {count === 0 && <span className="text-xs text-muted">—</span>}
            </div>
          );
        },
      },
      {
        id: "enrollmentDate",
        header: "Enrolled",
        accessorFn: (s) => s.enrollmentDate,
        cell: (c) => <span className="text-xs text-muted">{fmtDate(c.getValue() as string)}</span>,
      },
      {
        id: "outstanding",
        header: "Outstanding",
        accessorFn: (s) => s.outstanding ?? 0,
        cell: (c) => {
          const v = (c.getValue() as number) ?? 0;
          return (
            <span className={`num text-sm font-semibold ${v > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {v > 0 ? fmtLKR(v) : "Settled"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (c) => <StatusBadge status={c.getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label="View" onClick={() => setDetailId(row.original.id)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => setForm({ open: true, item: row.original })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              className="hover:text-rose-500"
              onClick={() => setDelTarget({ id: row.original.id, fullName: row.original.fullName })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [moduleMap, items, selectedIds],
  );

  const allBatchOptions = useMemo(() => {
    const names = new Set<string>();
    batches.forEach((b) => names.add(b.name));
    BATCHES.forEach((b) => names.add(b));
    return Array.from(names);
  }, [batches]);

  const hasFilters = Boolean(debouncedQ || batch !== "all" || moduleId !== "all" || status !== "all");
  const headerDescription =
    loading && !data
      ? "Loading students…"
      : `${summary.total} students enrolled · ${summary.activeCount} active${hasFilters ? ` · ${summary.filteredTotal} matching filters` : ""}. Each student gets a unique QR code for attendance and payments.`;

  const handleDeleteConfirm = async () => {
    if (!delTarget) return;
    const targetId = delTarget.id;
    try {
      await deleteStudent(targetId);
      if (detailId === targetId) setDetailId(null);
      void refreshStudents();
      toast.success("Student deleted");
      if (items.length <= 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        refetch();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete student");
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Students"
        description={headerDescription}
        actions={
          <Button onClick={() => setForm({ open: true, item: null })}>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            placeholder="Search name, ID or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:col-span-2 lg:col-span-1"
          />
          <Select
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by batch"
          >
            <option value="all">All batches</option>
            {allBatchOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select
            value={moduleId}
            onChange={(e) => {
              setModuleId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by module"
          >
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
          </Select>
        </div>

        <DataTable
          data={items}
          columns={columns}
          pageSize={PAGE_LIMIT}
          manualPagination
          manualSorting
          pageIndex={page - 1}
          total={summary.filteredTotal}
          totalPages={pagination.totalPages}
          sorting={sorting}
          onPaginationChange={({ pageIndex }) => setPage(pageIndex + 1)}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
          loading={loading}
          error={error}
          onRetry={refetch}
          onRowClick={(s) => setDetailId(s.id)}
          emptyTitle="No students found"
        />
      </Card>

      <StudentFormModal
        open={form.open}
        item={form.item}
        modules={modules}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={(saved) => {
          refetch();
          void refreshStudents();
          if (detailId && detailId === saved.id) {
            setDetailRefreshKey((k) => k + 1);
          }
        }}
      />

      <StudentDetail
        studentId={detailId}
        modulesList={modules}
        refreshKey={detailRefreshKey}
        onClose={() => setDetailId(null)}
        onEdit={(student) => setForm({ open: true, item: student })}
        onDelete={(student) => setDelTarget({ id: student.id, fullName: student.fullName })}
        onPay={(student) =>
          setPayState({
            open: true,
            studentId: student.id,
            summary: {
              id: student.id,
              fullName: student.fullName,
              feeTotal: student.feeTotal,
              paidTotal: student.paidTotal,
              outstanding: student.outstanding,
            },
          })
        }
        onRefresh={refetch}
      />

      <RecordPaymentModal
        open={payState.open}
        studentId={payState.studentId}
        studentSummary={payState.summary}
        onClose={() => setPayState({ open: false })}
        onDone={() => {
          refetch();
          if (detailId) setDetailRefreshKey((k) => k + 1);
        }}
      />

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Delete student?"
        text={
          <>
            This removes <b>{delTarget?.fullName}</b> and deletes their attendance records. Finance payment history is preserved for the ledger.
          </>
        }
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleDeleteConfirm}
      />

      {/* Bulk action floating bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-5 py-3 shadow-pop backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span>{selectedIds.size === 1 ? "student selected" : "students selected"}</span>
          </div>
          <div className="h-4 w-px bg-line" />
          <Button
            size="sm"
            onClick={() => setMoveModalOpen(true)}
            className="gap-1.5 shadow-md shadow-primary/25"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Move to Batch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted hover:text-ink"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Move Batch Modal */}
      <MoveBatchModal
        open={moveModalOpen}
        studentIds={Array.from(selectedIds)}
        batches={batches}
        onClose={() => setMoveModalOpen(false)}
        onSuccess={() => {
          setSelectedIds(new Set());
          refetch();
          void refreshStudents();
        }}
      />
    </>
  );
}
