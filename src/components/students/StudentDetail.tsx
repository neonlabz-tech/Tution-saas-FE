import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, Pencil, RotateCw, Trash2 } from "lucide-react";
import type { Module, RotateQrResponse, StudentDetail as StudentDetailType } from "@/types";
import { Drawer } from "@/components/ui/overlays";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  InfoRow,
  ProgressBar,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { StudentQRCard } from "@/components/qr/StudentQRCard";
import { useStudentDetail } from "@/hooks/useStudents";
import { fmtDate, fmtLKR } from "@/lib/utils";

type Tab = "overview" | "attendance" | "payments" | "qr";

export function StudentDetail({
  studentId,
  modulesList = [],
  refreshKey = 0,
  onClose,
  onEdit,
  onDelete,
  onPay,
  onRefresh,
}: {
  studentId: string | null;
  modulesList?: Module[];
  refreshKey?: number;
  onClose: () => void;
  onEdit: (student: StudentDetailType) => void;
  onDelete: (student: StudentDetailType) => void;
  onPay: (student: StudentDetailType) => void;
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { student: s, setStudent, loading, error, refresh } = useStudentDetail(studentId, refreshKey);

  useEffect(() => {
    setTab("overview");
  }, [studentId]);

  const moduleMap = useMemo(() => new Map(modulesList.map((m) => [m.id, m])), [modulesList]);

  const resolvedModules = useMemo(() => {
    if (!s) return [];
    if (s.modules?.length) return s.modules;
    return (s.moduleIds ?? [])
      .map((id) => moduleMap.get(id))
      .filter((m): m is Module => Boolean(m))
      .map((m) => ({ id: m.id, code: m.code, name: m.name, fee: m.fee }));
  }, [s, moduleMap]);

  const handleQrRotated = (rotated: RotateQrResponse) => {
    setStudent((prev) =>
      prev
        ? {
            ...prev,
            ref: rotated.ref,
            qrPayload: rotated.qrPayload,
            qrRotatedAt: rotated.qrRotatedAt,
          }
        : prev,
    );
    refresh();
    onRefresh?.();
  };

  return (
    <Drawer
      open={!!studentId}
      onClose={onClose}
      title="Student profile"
      description={s?.id ?? studentId ?? undefined}
      size="md"
    >
      {loading && !s ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : error && !s ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="font-heading text-base font-bold">Could not load student profile</h4>
          <p className="mt-1 max-w-xs text-sm text-muted">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={refresh}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : (
        s && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={s.fullName} size="xl" />
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-xl font-extrabold">{s.fullName}</h3>
                <p className="text-sm text-muted">{s.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={s.status} />
                  <Badge tone="primary">{s.batch}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="soft" onClick={() => onEdit(s)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="soft" onClick={() => onPay(s)}>
                <CreditCard className="h-3.5 w-3.5" /> Record payment
              </Button>
              <Button size="sm" variant="dangerSoft" onClick={() => onDelete(s)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>

            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: "overview", label: "Overview" },
                { id: "attendance", label: "Attendance" },
                { id: "payments", label: "Payments" },
                { id: "qr", label: "QR Code" },
              ]}
            />

            {tab === "overview" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-line p-4">
                  <InfoRow label="Phone">
                    <span className="num">{s.phone}</span>
                  </InfoRow>
                  <InfoRow label="Date of birth">{fmtDate(s.dob)}</InfoRow>
                  <InfoRow label="Address">{s.address}</InfoRow>
                  <InfoRow label="Guardian">
                    {s.guardianName} · <span className="num">{s.guardianPhone}</span>
                  </InfoRow>
                  <InfoRow label="Enrolled">{fmtDate(s.enrollmentDate)}</InfoRow>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-bold">Registered modules</h4>
                  {resolvedModules.length === 0 ? (
                    <p className="text-sm text-muted">No modules registered.</p>
                  ) : (
                    <div className="space-y-2">
                      {resolvedModules.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
                          <div>
                            <p className="text-sm font-semibold">{m.name}</p>
                            <p className="num text-[11px] text-muted">{m.code}</p>
                          </div>
                          <span className="num text-sm font-semibold">{fmtLKR(m.fee)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-muted">Total fees</p>
                      <p className="num text-sm font-bold">{fmtLKR(s.feeTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">Paid</p>
                      <p className="num text-sm font-bold text-emerald-500">{fmtLKR(s.paidTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">Outstanding</p>
                      <p className="num text-sm font-bold text-rose-500">{fmtLKR(s.outstanding)}</p>
                    </div>
                  </div>
                  <ProgressBar
                    className="mt-3"
                    tone="teal"
                    value={s.feeTotal ? (s.paidTotal / s.feeTotal) * 100 : 0}
                  />
                </div>
              </div>
            )}

            {tab === "attendance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Rate", `${s.attendanceSummary?.rate ?? 0}%`, "text-brand"],
                    ["Present", s.attendanceSummary?.present ?? 0, "text-emerald-500"],
                    ["Late", s.attendanceSummary?.late ?? 0, "text-amber-500"],
                    ["Absent", s.attendanceSummary?.absent ?? 0, "text-rose-500"],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-2xl border border-line p-3 text-center">
                      <p className={`num text-xl font-bold ${c}`}>{v}</p>
                      <p className="text-[11px] text-muted">{l}</p>
                    </div>
                  ))}
                </div>
                {!s.attendanceRecords?.length ? (
                  <EmptyState title="No attendance yet" text="Records appear here once attendance is marked." />
                ) : (
                  <div className="divide-y divide-line/70 rounded-2xl border border-line">
                    {s.attendanceRecords.slice(0, 25).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div>
                          <p className="text-sm font-semibold">
                            {r.moduleName ?? moduleMap.get(r.moduleId)?.name ?? r.moduleId}
                          </p>
                          <p className="text-[11px] text-muted">
                            {fmtDate(r.date)} · {r.method}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "payments" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-rose-500/10 px-4 py-3">
                  <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">Outstanding balance</span>
                  <span className="num text-lg font-bold text-rose-500">{fmtLKR(s.outstanding)}</span>
                </div>
                {!s.payments?.length ? (
                  <EmptyState title="No payments yet" />
                ) : (
                  <div className="divide-y divide-line/70 rounded-2xl border border-line">
                    {s.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.category}</p>
                          <p className="truncate text-[11px] text-muted">
                            {fmtDate(p.date)}
                            {p.method ? ` · ${p.method}` : ""}
                            {p.description ? ` · ${p.description}` : ""}
                          </p>
                        </div>
                        <span className="num text-sm font-bold text-emerald-500">+{fmtLKR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "qr" && <StudentQRCard student={s} onRotated={handleQrRotated} />}
          </div>
        )
      )}
    </Drawer>
  );
}
