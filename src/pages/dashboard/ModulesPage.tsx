import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Clock,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { BatchItem, ModuleEnrolledStudent, ModuleListItem, ModuleStatus } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoRow,
  MultiSelect,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { deleteModule, setModuleEnrollments, updateModule } from "@/api/modules";
import { deleteBatch, listBatches } from "@/api/batches";
import { useModuleDetail, useModules } from "@/hooks/useModules";
import { teachersApi, type TeacherListItem } from "@/lib/api";
import { ModuleFormModal } from "@/components/modules/ModuleFormModal";
import { BatchFormModal } from "@/components/modules/BatchFormModal";
import { RegisterStudentsModal } from "@/components/modules/RegisterStudentsModal";
import { cn, formatLkrPrice } from "@/lib/utils";

const GRADS = [
  "from-indigo-500 to-violet-500",
  "from-teal-500 to-emerald-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-indigo-500",
  "from-fuchsia-500 to-purple-500",
];

export default function ModulesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const lastUrlQRef = useRef<string | null>(params.get("q"));

  const [mainTab, setMainTab] = useState<"modules" | "batches">(
    params.get("tab") === "batches" ? "batches" : "modules",
  );
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchQ, setBatchQ] = useState("");
  const [debouncedBatchQ, setDebouncedBatchQ] = useState("");
  const [batchModal, setBatchModal] = useState<{ open: boolean; item: BatchItem | null }>({
    open: false,
    item: null,
  });
  const [batchDelTarget, setBatchDelTarget] = useState<BatchItem | null>(null);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ.trim());
  const [teacher, setTeacher] = useState<string>("all");
  const [batch, setBatch] = useState<string>("all");

  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [form, setForm] = useState<{ open: boolean; item: ModuleListItem | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [delTarget, setDelTarget] = useState<{ id: string; name: string } | null>(null);
  const [regState, setRegState] = useState<{
    module: ModuleListItem | null;
    initialEnrolled?: ModuleEnrolledStudent[];
  }>({ module: null });
  const [patchingField, setPatchingField] = useState<"teacher" | "batches" | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    teachersApi
      .list()
      .then((res) => {
        if (active) setTeachers(res.data ?? []);
      })
      .catch(() => {
        /* teacher filter remains gracefully empty if offline */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = batchQ.trim();
    if (trimmed === debouncedBatchQ) return;
    const timer = window.setTimeout(() => setDebouncedBatchQ(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [batchQ, debouncedBatchQ]);

  const fetchBatches = async (searchTerm?: string) => {
    setLoadingBatches(true);
    setBatchError(null);
    try {
      const data = await listBatches({ q: searchTerm });
      setBatches(data);
    } catch (err: unknown) {
      setBatchError(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches(debouncedBatchQ || undefined);
  }, [debouncedBatchQ]);

  const handleTabChange = (nextTab: "modules" | "batches") => {
    setMainTab(nextTab);
    const nextParams = new URLSearchParams(params);
    if (nextTab === "batches") {
      nextParams.set("tab", "batches");
    } else {
      nextParams.delete("tab");
    }
    setParams(nextParams, { replace: true });
  };

  const availableBatchNames = useMemo(() => {
    return Array.from(new Set(batches.map((b) => b.name))).sort((a, b) => a.localeCompare(b));
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const qTrim = batchQ.trim().toLowerCase();
    if (!qTrim) return batches;

    // Tokenized multi-word search so "2026 Morning" or "2026-A" or "al" matches
    const tokens = qTrim.split(/[\s,]+/).filter(Boolean);

    return batches.filter((b) => {
      const name = String(b.name || "").toLowerCase();
      const code = String(b.code || "").toLowerCase();
      const year = String(b.year || "").toLowerCase();
      const desc = String(b.description || "").toLowerCase();
      const status = String(b.status || "").toLowerCase();

      const combined = `${name} ${code} ${year} ${desc} ${status}`;
      const combinedClean = combined.replace(/[-/_]/g, " ");

      return tokens.every(
        (token) =>
          combined.includes(token) ||
          combinedClean.includes(token.replace(/[-/_]/g, " ")),
      );
    });
  }, [batches, batchQ]);

  const handleDeleteBatch = async () => {
    if (!batchDelTarget) return;
    try {
      await deleteBatch(batchDelTarget.id);
      toast.success(`Batch "${batchDelTarget.name}" deleted successfully`);
      setBatchDelTarget(null);
      await fetchBatches(debouncedBatchQ || undefined);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete batch");
      throw err;
    }
  };

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
    }
  }, [params, setParams]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === debouncedQ) return;
    const timer = window.setTimeout(() => setDebouncedQ(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [q, debouncedQ]);

  const {
    data: modules,
    loading,
    error,
    refetch,
  } = useModules({
    q: debouncedQ || undefined,
    status: "all",
    teacherId: teacher,
    batch,
  });

  const {
    module: detail,
    setModule: setDetail,
    loading: detailLoading,
    error: detailError,
    refresh: refreshDetail,
  } = useModuleDetail(detailId, detailRefreshKey);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const resolveTeacherName = (m: ModuleListItem): string | null => {
    if (m.teacher?.fullName) return m.teacher.fullName;
    if (m.teacherId) return teacherMap.get(m.teacherId)?.fullName ?? null;
    return null;
  };

  const columns = useMemo<Columns<ModuleListItem>>(
    () => [
      {
        id: "name",
        header: "Module",
        accessorFn: (m) => m.name,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.name}</p>
            <p className="num text-[11px] text-muted">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: "teacher",
        header: "Teacher",
        accessorFn: (m) => resolveTeacherName(m) ?? "—",
        cell: (c) => <span className="text-sm">{c.getValue() as string}</span>,
      },
      { accessorKey: "duration", header: "Duration" },
      {
        id: "fee",
        header: "Fee",
        accessorFn: (m) => m.fee,
        cell: (c) => <span className="num text-sm font-semibold">{formatLkrPrice(c.getValue() as number)}</span>,
      },
      {
        id: "enrolled",
        header: "Enrolled",
        accessorFn: (m) => m.enrolledCount ?? 0,
        cell: (c) => <span className="num font-semibold">{c.getValue() as number}</span>,
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
            <Button
              variant="ghost"
              size="icon"
              aria-label="Register students"
              onClick={() => setRegState({ module: row.original })}
            >
              <UserPlus className="h-4 w-4" />
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
              onClick={() => setDelTarget({ id: row.original.id, name: row.original.name })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teacherMap],
  );

  const handleInlineTeacherChange = async (nextTeacherId: string) => {
    if (!detail || patchingField) return;
    const targetTeacherId = nextTeacherId || null;
    if (targetTeacherId === detail.teacherId) return;

    const prev = detail;
    const nextTeacherObj = targetTeacherId
      ? { id: targetTeacherId, fullName: teacherMap.get(targetTeacherId)?.fullName ?? "Assigned teacher" }
      : null;

    setPatchingField("teacher");
    setDetail({ ...detail, teacherId: targetTeacherId, teacher: nextTeacherObj });
    try {
      await updateModule(detail.id, { teacherId: targetTeacherId });
      toast.success("Teacher assignment updated");
      refetch();
      refreshDetail();
    } catch (err: unknown) {
      setDetail(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update teacher assignment");
    } finally {
      setPatchingField(null);
    }
  };

  const handleInlineBatchesChange = async (nextBatches: string[]) => {
    if (!detail || patchingField) return;
    if (nextBatches.length === 0) {
      toast.error("A module needs at least one batch");
      return;
    }

    const prev = detail;
    setPatchingField("batches");
    setDetail({ ...detail, batches: nextBatches });
    try {
      await updateModule(detail.id, { batches: nextBatches });
      toast.success("Assigned batches updated");
      refetch();
    } catch (err: unknown) {
      setDetail(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update batches");
    } finally {
      setPatchingField(null);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!detail || removingStudentId) return;
    const nextIds = detail.enrolledStudents.filter((x) => x.id !== studentId).map((x) => x.id);
    setRemovingStudentId(studentId);
    try {
      const res = await setModuleEnrollments(detail.id, nextIds);
      setDetail((cur) =>
        cur && cur.id === detail.id
          ? {
              ...cur,
              enrolledCount: res.enrolledCount,
              enrolledStudents: res.enrolledStudents,
              revenuePotential: cur.fee * res.enrolledCount,
            }
          : cur,
      );
      refetch();
      toast.success("Student removed from module");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove student");
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!delTarget) return;
    const targetId = delTarget.id;
    try {
      await deleteModule(targetId);
      if (detailId === targetId) setDetailId(null);
      toast.success("Module deleted");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete module");
      throw err;
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <Tabs
            value={mainTab}
            onChange={(tab) => handleTabChange(tab as "modules" | "batches")}
            items={[
              { id: "modules", label: "Modules", icon: <BookOpen className="h-4 w-4" /> },
              { id: "batches", label: "Batches", icon: <Layers className="h-4 w-4" /> },
            ]}
          />
        </div>

        {mainTab === "modules" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={view}
              onChange={setView}
              items={[
                { id: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
                { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
              ]}
            />
            <Button onClick={() => setForm({ open: true, item: null })}>
              <Plus className="h-4 w-4" /> Create module
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={() => setBatchModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" /> Create batch
            </Button>
          </div>
        )}
      </div>

      {mainTab === "modules" ? (
        <>
          <PageHeader
            title="Modules"
            description="Courses offered by the institute — fees, teachers, batches and enrollments."
          />

          <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <SearchInput placeholder="Search modules…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher">
              <option value="all">All teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
            <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch">
              <option value="all">All batches</option>
              {availableBatchNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Card>

      {view === "list" ? (
        <Card>
          <DataTable
            data={modules}
            columns={columns}
            pageSize={8}
            loading={loading}
            error={error}
            onRetry={refetch}
            onRowClick={(m) => setDetailId(m.id)}
            emptyTitle="No modules found"
          />
        </Card>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="font-heading text-base font-bold">Could not load modules</h4>
          <p className="mt-1 max-w-sm text-sm text-muted">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={refetch}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </Card>
      ) : loading && modules.length === 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-24 w-full rounded-none" />
              <div className="space-y-3 p-5">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-40" />
              </div>
            </Card>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No modules found"
            text="Adjust your filters or create a new module."
          />
        </Card>
      ) : (
        <div className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {modules.map((m, i) => {
            const teacherName = resolveTeacherName(m);
            const enrolledCount = m.enrolledCount ?? 0;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
              >
                <Card className="group flex h-full cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop">
                  <div onClick={() => setDetailId(m.id)} className="flex flex-1 flex-col">
                    <div className={`relative h-24 bg-gradient-to-br ${GRADS[i % GRADS.length]} p-4 text-white`}>
                      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" />
                      <div className="absolute bottom-0 right-10 h-14 w-14 rounded-full bg-white/10" />
                      <p className="num relative text-xs font-semibold opacity-90">{m.code}</p>
                      <h3 className="relative mt-1 font-heading text-lg font-extrabold leading-tight">{m.name}</h3>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <StatusBadge status={m.status} />
                        <span className="num text-base font-bold">{formatLkrPrice(m.fee)}</span>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted">{m.description}</p>
                      <div className="mt-4 flex items-center gap-2">
                        {teacherName ? (
                          <Avatar name={teacherName} size="sm" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-surface-2 text-muted">
                            <Users className="h-4 w-4" />
                          </div>
                        )}
                        <span className="truncate text-xs font-semibold">
                          {teacherName ?? "No teacher assigned"}
                        </span>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <b className="num text-ink">{enrolledCount}</b> students
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {m.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 border-t border-line px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => setRegState({ module: m })}>
                      <UserPlus className="h-3.5 w-3.5" /> Register
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                      onClick={() => setForm({ open: true, item: m })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      className="hover:text-rose-500"
                      onClick={() => setDelTarget({ id: m.id, name: m.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  ) : (
    <>
      <PageHeader
        title="Batches"
        description="Manage academic cohorts, session intakes, and track student group enrollments."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <SearchInput
            placeholder="Search batches by name, code, year…"
            value={batchQ}
            onChange={(e) => setBatchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setBatchQ("");
            }}
          />
          {batchQ && (
            <button
              type="button"
              onClick={() => setBatchQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink transition"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center text-xs text-muted">
          <span className="rounded-xl border border-line bg-surface px-3.5 py-2 font-medium shadow-xs">
            Showing <b className="text-ink">{filteredBatches.length}</b> of <b className="text-ink">{batches.length}</b> batches
          </span>
        </div>
      </div>

      {loadingBatches && batches.length === 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : batchError ? (
        <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="font-heading text-base font-bold">Could not load batches</h4>
          <p className="mt-1 max-w-sm text-sm text-muted">{batchError}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void fetchBatches()}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </Card>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No batches found"
            text={
              batchQ
                ? "No batches matched your current search."
                : "Get started by adding your first academic batch."
            }
            action={
              <Button onClick={() => setBatchModal({ open: true, item: null })}>
                <Plus className="h-4 w-4" /> Create batch
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredBatches.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
            >
              <Card className="group flex h-full flex-col justify-between overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-brand">
                          {b.code || "BATCH"}
                        </span>
                        {b.category === "grade" ? (
                          <span className="rounded-md bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-secondary">
                            Grade 6–11
                          </span>
                        ) : (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            A/L Cohort
                          </span>
                        )}
                        {b.year && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <Calendar className="h-3 w-3" />
                            {b.year}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-heading text-lg font-bold text-ink leading-snug">
                        {b.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                        title={`Edit ${b.category === "grade" ? "grade" : "batch"} ${b.name}`}
                        aria-label={`Edit ${b.category === "grade" ? "grade" : "batch"} ${b.name}`}
                        onClick={() => setBatchModal({ open: true, item: b })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                        title={`Delete ${b.category === "grade" ? "grade" : "batch"} ${b.name}`}
                        aria-label={`Delete ${b.category === "grade" ? "grade" : "batch"} ${b.name}`}
                        onClick={() => setBatchDelTarget(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted line-clamp-2">
                    {b.description || "No description provided for this academic batch."}
                  </p>
                </div>

                <div className="mt-5 border-t border-line/60 pt-4 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-ink/80">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{b.studentCount ?? 0} Students</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink/80">
                    <BookOpen className="h-4 w-4 text-secondary" />
                    <span>{b.moduleCount ?? 0} Modules</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  )}

      <ModuleFormModal
        open={form.open}
        item={form.item}
        teachers={teachers}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={(saved) => {
          refetch();
          if (detailId && detailId === saved.id) {
            setDetailRefreshKey((k) => k + 1);
          }
        }}
      />

      <RegisterStudentsModal
        open={!!regState.module}
        module={regState.module}
        initialEnrolled={regState.initialEnrolled}
        onClose={() => setRegState({ module: null })}
        onSaved={(res) => {
          refetch();
          if (detail && detail.id === res.moduleId) {
            setDetail((cur) =>
              cur && cur.id === res.moduleId
                ? {
                    ...cur,
                    enrolledCount: res.enrolledCount,
                    enrolledStudents: res.enrolledStudents,
                    revenuePotential: cur.fee * res.enrolledCount,
                  }
                : cur,
            );
          }
        }}
      />

      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? "Module details"}
        description={detail?.code ?? detailId ?? undefined}
      >
        {detailLoading && !detail ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detailError && !detail ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="font-heading text-sm font-bold">Could not load module details</p>
            <p className="mt-1 text-xs text-muted">{detailError}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={refreshDetail}>
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : (
          detail && (
            <div className="space-y-5">
              <p className="text-sm text-muted">{detail.description}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-surface-2 p-3 text-center">
                  <p className="num text-lg font-bold">{formatLkrPrice(detail.fee).replace("LKR ", "")}</p>
                  <p className="text-[11px] text-muted">Fee (LKR)</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3 text-center">
                  <p className="num text-lg font-bold">{detail.enrolledCount}</p>
                  <p className="text-[11px] text-muted">Enrolled</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3 text-center">
                  <p className="text-lg font-bold">{detail.duration}</p>
                  <p className="text-[11px] text-muted">Duration</p>
                </div>
              </div>
              <div className="rounded-2xl border border-line p-4">
                <InfoRow label="Status">
                  <StatusBadge status={detail.status} />
                </InfoRow>
                <InfoRow label="Revenue potential">
                  <span className="num">{formatLkrPrice(detail.revenuePotential)}</span>
                </InfoRow>
              </div>
              <Field label="Assigned teacher">
                <Select
                  value={detail.teacherId ?? ""}
                  disabled={patchingField === "teacher"}
                  onChange={(e) => void handleInlineTeacherChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assigned batches">
                <div className={cn(patchingField === "batches" && "pointer-events-none opacity-60")}>
                  <MultiSelect
                    value={detail.batches}
                    options={availableBatchNames.map((b) => ({ value: b, label: b }))}
                    onChange={(v) => void handleInlineBatchesChange(v)}
                  />
                </div>
              </Field>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold">Enrolled students</h4>
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() =>
                      setRegState({ module: detail, initialEnrolled: detail.enrolledStudents })
                    }
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Register students
                  </Button>
                </div>
                {detail.enrolledStudents.length === 0 ? (
                  <p className="text-sm text-muted">No students registered yet.</p>
                ) : (
                  <div className="max-h-72 divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line">
                    {detail.enrolledStudents.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                        <Avatar name={s.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.fullName}</p>
                          <p className="num text-[11px] text-muted">{s.id}</p>
                        </div>
                        <Badge tone="neutral">{s.batch}</Badge>
                        {s.status && s.status !== "active" && <StatusBadge status={s.status} />}
                        <button
                          type="button"
                          aria-label="Remove"
                          disabled={removingStudentId === s.id}
                          onClick={() => void handleRemoveStudent(s.id)}
                          className="rounded-lg p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => setForm({ open: true, item: detail })}>
                  <Pencil className="h-4 w-4" /> Edit module
                </Button>
                <Button
                  variant="dangerSoft"
                  onClick={() => setDelTarget({ id: detail.id, name: detail.name })}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )
        )}
      </Drawer>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Delete module?"
        text={
          <>
            <b>{delTarget?.name}</b> will be removed from all students, along with its online classes and
            attendance records.
          </>
        }
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleDeleteConfirm}
      />

      <BatchFormModal
        open={batchModal.open}
        item={batchModal.item}
        onClose={() => setBatchModal({ open: false, item: null })}
        onSaved={() => {
          fetchBatches();
          refetch();
        }}
      />

      <ConfirmDialog
        open={!!batchDelTarget}
        onClose={() => setBatchDelTarget(null)}
        title={batchDelTarget?.category === "grade" ? `Delete grade "${batchDelTarget?.name}"?` : `Delete batch "${batchDelTarget?.name}"?`}
        text={
          <div className="space-y-2 text-sm">
            <p>
              Are you sure you want to permanently delete {batchDelTarget?.category === "grade" ? "grade" : "batch"} <b>{batchDelTarget?.name}</b>?
            </p>
            {((batchDelTarget?.studentCount ?? 0) > 0 || (batchDelTarget?.moduleCount ?? 0) > 0) && (
              <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-500">
                Warning: This {batchDelTarget?.category === "grade" ? "grade" : "batch"} currently has {batchDelTarget?.studentCount ?? 0} enrolled student(s) and {batchDelTarget?.moduleCount ?? 0} associated module(s). Deleting it will remove the association.
              </p>
            )}
          </div>
        }
        confirmLabel={batchDelTarget?.category === "grade" ? "Delete grade" : "Delete batch"}
        confirmLoadingLabel="Deleting…"
        confirmVariant="danger"
        onConfirm={handleDeleteBatch}
      />
    </>
  );
}
