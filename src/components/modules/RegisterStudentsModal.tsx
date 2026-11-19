import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import type {
  ModuleDetail,
  ModuleEnrolledStudent,
  ModuleListItem,
  StudentListItem,
  UpdateModuleEnrollmentsResponse,
} from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Avatar, Button, SearchInput, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getModuleById, setModuleEnrollments } from "@/api/modules";
import { listStudents } from "@/api/students";

const CANDIDATE_LIMIT = 100;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function RegisterStudentsModal({
  open,
  module,
  initialEnrolled,
  onClose,
  onSaved,
}: {
  open: boolean;
  module: ModuleListItem | ModuleDetail | null;
  initialEnrolled?: ModuleEnrolledStudent[];
  onClose: () => void;
  onSaved: (res: UpdateModuleEnrollmentsResponse) => void;
}) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [candidates, setCandidates] = useState<StudentListItem[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const moduleId = module?.id ?? null;

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === debouncedQ) return;
    const timer = window.setTimeout(() => setDebouncedQ(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [q, debouncedQ]);

  const loadInitialEnrollment = useCallback(
    (signal?: AbortSignal) => {
      if (!moduleId) return;
      if (initialEnrolled) {
        setSel(initialEnrolled.filter((s) => s.status !== "graduated").map((s) => s.id));
        setInitLoading(false);
        setInitError(null);
        return;
      }
      setInitLoading(true);
      setInitError(null);
      getModuleById(moduleId, signal)
        .then((detail) => {
          if (signal?.aborted) return;
          setSel(
            detail.enrolledStudents
              .filter((s) => s.status !== "graduated")
              .map((s) => s.id),
          );
          setInitLoading(false);
        })
        .catch((err: unknown) => {
          if (isAbortError(err) || signal?.aborted) return;
          setInitError(err instanceof Error ? err.message : "Could not load current enrollments");
          setInitLoading(false);
        });
    },
    [moduleId, initialEnrolled],
  );

  useEffect(() => {
    if (!open || !moduleId) {
      setCandidates([]);
      setSel([]);
      setInitError(null);
      setStudentsError(null);
      return;
    }
    setQ("");
    setDebouncedQ("");
    const controller = new AbortController();
    loadInitialEnrollment(controller.signal);
    return () => controller.abort();
  }, [open, moduleId, loadInitialEnrollment]);

  useEffect(() => {
    if (!open || !moduleId) return;
    const controller = new AbortController();
    setStudentsLoading(true);
    setStudentsError(null);

    listStudents(
      {
        q: debouncedQ || undefined,
        limit: CANDIDATE_LIMIT,
        sortBy: "fullName",
        sortOrder: "asc",
      },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        const eligible = res.items.filter((s) => s.status !== "graduated");
        setCandidates(eligible);
        setTotalMatches(res.pagination.total);
        setStudentsLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setStudentsError(err instanceof Error ? err.message : "Failed to load students");
        setStudentsLoading(false);
      });

    return () => controller.abort();
  }, [open, moduleId, debouncedQ, reloadTick]);

  const toggle = (id: string) => {
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!module) return;
    setSaving(true);
    try {
      const res = await setModuleEnrollments(module.id, sel);
      toast.success(`Enrollment updated for ${module.name}`);
      onSaved(res);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update enrollment");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || initLoading;

  return (
    <Modal
      open={open && !!module}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Register students — ${module?.name ?? ""}`}
      description={initLoading ? "Loading current enrollment…" : `${sel.length} selected · graduated students excluded`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || !!initError}>
            {saving ? "Saving…" : "Save enrollment"}
          </Button>
        </>
      }
    >
      <SearchInput
        placeholder="Search students by name, ID or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />

      {initError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line px-6 py-10 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-ink">Could not load current enrollments</p>
          <p className="mt-1 text-xs text-muted">{initError}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => loadInitialEnrollment()}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : studentsError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line px-6 py-10 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-ink">Could not load students</p>
          <p className="mt-1 text-xs text-muted">{studentsError}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setReloadTick((t) => t + 1)}
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : (
        <>
          <div
            className={`max-h-[50vh] divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line transition-opacity ${
              studentsLoading && candidates.length > 0 ? "opacity-60" : ""
            }`}
          >
            {initLoading || (studentsLoading && candidates.length === 0) ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No eligible students match your search.
              </p>
            ) : (
              candidates.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={sel.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    disabled={saving}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <Avatar name={s.fullName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.fullName}</span>
                    <span className="num block truncate text-[11px] text-muted">
                      {s.id} · {s.batch}
                    </span>
                  </span>
                  <StatusBadge status={s.status} />
                </label>
              ))
            )}
          </div>
          {totalMatches > CANDIDATE_LIMIT && (
            <p className="mt-2 text-[11px] text-muted">
              Showing first {CANDIDATE_LIMIT} matches — use search above to narrow down students.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
