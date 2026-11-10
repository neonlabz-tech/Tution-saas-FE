import { useMemo, useState } from "react";
import { CreditCard, Pencil, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/overlays";
import { Avatar, Badge, Button, EmptyState, InfoRow, ProgressBar, StatusBadge, Tabs } from "@/components/ui/primitives";
import { StudentQRCard } from "@/components/qr/StudentQRCard";
import { useAppData } from "@/hooks/useAppData";
import { attendanceCounts, attendanceRate } from "@/lib/stats";
import { fmtDate, fmtLKR } from "@/lib/utils";

type Tab = "overview" | "attendance" | "payments" | "qr";

export function StudentDetail({
  studentId,
  onClose,
  onEdit,
  onDelete,
  onPay,
}: {
  studentId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPay: (id: string) => void;
}) {
  const { getStudent, getModule, attendance, transactions, feeTotal, paidTotal, outstanding } = useAppData();
  const [tab, setTab] = useState<Tab>("overview");
  const s = studentId ? getStudent(studentId) : undefined;
  const records = useMemo(() => (s ? attendance.filter((a) => a.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)) : []), [attendance, s]);
  const payments = useMemo(() => (s ? transactions.filter((t) => t.studentId === s.id) : []), [transactions, s]);
  const counts = attendanceCounts(records);

  return (
    <Drawer open={!!studentId && !!s} onClose={onClose} title="Student profile" description={s?.id} size="md">
      {s && (
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
            <Button size="sm" variant="soft" onClick={() => onEdit(s.id)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            <Button size="sm" variant="soft" onClick={() => onPay(s.id)}><CreditCard className="h-3.5 w-3.5" /> Record payment</Button>
            <Button size="sm" variant="dangerSoft" onClick={() => onDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
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
                <InfoRow label="Phone"><span className="num">{s.phone}</span></InfoRow>
                <InfoRow label="Date of birth">{fmtDate(s.dob)}</InfoRow>
                <InfoRow label="Address">{s.address}</InfoRow>
                <InfoRow label="Guardian">{s.guardianName} · <span className="num">{s.guardianPhone}</span></InfoRow>
                <InfoRow label="Enrolled">{fmtDate(s.enrollmentDate)}</InfoRow>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-bold">Registered modules</h4>
                <div className="space-y-2">
                  {s.moduleIds.map((id) => {
                    const m = getModule(id);
                    return m ? (
                      <div key={id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
                        <div><p className="text-sm font-semibold">{m.name}</p><p className="num text-[11px] text-muted">{m.code}</p></div>
                        <span className="num text-sm font-semibold">{fmtLKR(m.fee)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[11px] text-muted">Total fees</p><p className="num text-sm font-bold">{fmtLKR(feeTotal(s.id))}</p></div>
                  <div><p className="text-[11px] text-muted">Paid</p><p className="num text-sm font-bold text-emerald-500">{fmtLKR(paidTotal(s.id))}</p></div>
                  <div><p className="text-[11px] text-muted">Outstanding</p><p className="num text-sm font-bold text-rose-500">{fmtLKR(outstanding(s.id))}</p></div>
                </div>
                <ProgressBar className="mt-3" tone="teal" value={feeTotal(s.id) ? (paidTotal(s.id) / feeTotal(s.id)) * 100 : 0} />
              </div>
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Rate", `${attendanceRate(records)}%`, "text-brand"], ["Present", counts.present, "text-emerald-500"], ["Late", counts.late, "text-amber-500"], ["Absent", counts.absent, "text-rose-500"]].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-2xl border border-line p-3 text-center">
                    <p className={`num text-xl font-bold ${c}`}>{v}</p>
                    <p className="text-[11px] text-muted">{l}</p>
                  </div>
                ))}
              </div>
              {records.length === 0 ? (
                <EmptyState title="No attendance yet" text="Records appear here once attendance is marked." />
              ) : (
                <div className="divide-y divide-line/70 rounded-2xl border border-line">
                  {records.slice(0, 25).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div><p className="text-sm font-semibold">{getModule(r.moduleId)?.name}</p><p className="text-[11px] text-muted">{fmtDate(r.date)}</p></div>
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
                <span className="num text-lg font-bold text-rose-500">{fmtLKR(outstanding(s.id))}</span>
              </div>
              {payments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <div className="divide-y divide-line/70 rounded-2xl border border-line">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.category}</p><p className="text-[11px] text-muted">{fmtDate(p.date)} · {p.method}</p></div>
                      <span className="num text-sm font-bold text-emerald-500">+{fmtLKR(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "qr" && <StudentQRCard student={s} />}
        </div>
      )}
    </Drawer>
  );
}
