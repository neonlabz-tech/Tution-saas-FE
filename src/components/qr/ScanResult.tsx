import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, CreditCard, RefreshCw, UserCheck, X } from "lucide-react";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Student,
  StudentDetail,
  StudentListItem,
  StudentPaymentStatus,
} from "@/types";
import { Avatar, Badge, Button, ProgressBar, Select, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { getStudentById } from "@/api/students";
import { attendanceApi } from "@/lib/api";
import { formatLkrPrice, todayISO } from "@/lib/utils";

type ScanStudent = (Student | StudentListItem | StudentDetail) & {
  feeTotal?: number;
  paidTotal?: number;
  outstanding?: number;
  paymentStatus?: StudentPaymentStatus;
};

interface LiveBalance {
  feeTotal: number;
  paidTotal: number;
  outstanding: number;
  paymentStatus: StudentPaymentStatus;
}

function deriveStatus(paidTotal: number, outstanding: number): StudentPaymentStatus {
  if (outstanding <= 0) return "paid";
  if (paidTotal > 0) return "partial";
  return "unpaid";
}

interface ScanResultProps {
  student: ScanStudent;
  initialModuleId?: string;
  alreadyMarked?: boolean;
  existingRecord?: AttendanceRecord;
  verificationMessage?: string;
  onDismiss: () => void;
  onMarkSuccess?: (record: AttendanceRecord) => void;
}

export function ScanResult({
  student,
  initialModuleId,
  alreadyMarked: initialAlreadyMarked,
  existingRecord: initialExistingRecord,
  verificationMessage,
  onDismiss,
  onMarkSuccess,
}: ScanResultProps) {
  const { getModule, outstanding, feeTotal, paidTotal, attendance, markAttendance } = useAppData();
  const toast = useToast();

  const defaultModule = initialModuleId && student.moduleIds.includes(initialModuleId)
    ? initialModuleId
    : (student.moduleIds[0] ?? "");

  const [moduleId, setModuleId] = useState(defaultModule);
  const [pay, setPay] = useState(false);
  const [marking, setMarking] = useState(false);

  const hasInitialServerBalance =
    typeof student.feeTotal === "number" &&
    typeof student.paidTotal === "number" &&
    typeof student.outstanding === "number";

  const [liveBalance, setLiveBalance] = useState<LiveBalance | null>(() =>
    hasInitialServerBalance
      ? {
          feeTotal: student.feeTotal!,
          paidTotal: student.paidTotal!,
          outstanding: student.outstanding!,
          paymentStatus:
            student.paymentStatus ?? deriveStatus(student.paidTotal!, student.outstanding!),
        }
      : null,
  );
  const [loadingBalance, setLoadingBalance] = useState(!hasInitialServerBalance);

  // Sync live balance when student changes, or fetch from backend if not provided on scan
  useEffect(() => {
    if (
      typeof student.feeTotal === "number" &&
      typeof student.paidTotal === "number" &&
      typeof student.outstanding === "number"
    ) {
      setLiveBalance({
        feeTotal: student.feeTotal,
        paidTotal: student.paidTotal,
        outstanding: student.outstanding,
        paymentStatus:
          student.paymentStatus ?? deriveStatus(student.paidTotal, student.outstanding),
      });
      setLoadingBalance(false);
      return;
    }

    const controller = new AbortController();
    setLoadingBalance(true);
    getStudentById(student.id, controller.signal)
      .then((res) => {
        setLiveBalance({
          feeTotal: res.feeTotal,
          paidTotal: res.paidTotal,
          outstanding: res.outstanding,
          paymentStatus: deriveStatus(res.paidTotal, res.outstanding),
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBalance(false);
      });

    return () => controller.abort();
  }, [student.id, student.feeTotal, student.paidTotal, student.outstanding, student.paymentStatus]);

  const resolvedFeeTotal = liveBalance?.feeTotal ?? feeTotal(student.id);
  const resolvedPaidTotal = liveBalance?.paidTotal ?? paidTotal(student.id);
  const owed = liveBalance?.outstanding ?? outstanding(student.id);
  const paymentStatus = liveBalance?.paymentStatus ?? deriveStatus(resolvedPaidTotal, owed);
  const today = todayISO();

  const localExisting = attendance.find((a) => a.id === `att_${student.id}_${moduleId}_${today}`);
  const existing = initialExistingRecord && initialExistingRecord.moduleId === moduleId
    ? initialExistingRecord
    : localExisting;

  const isDuplicate = initialAlreadyMarked || existing?.status === "present";
  const isEnrolledInSelected = !moduleId || student.moduleIds.includes(moduleId);

  const handleMark = async (status: AttendanceStatus = "present") => {
    if (!moduleId) {
      toast.error("This student has no registered modules.");
      return;
    }
    if (!isEnrolledInSelected) {
      toast.error(`${student.fullName} is not enrolled in ${getModule(moduleId)?.name ?? "this module"}.`);
      return;
    }

    setMarking(true);
    try {
      const res = await attendanceApi.markQr({
        code: student.id,
        moduleId,
        date: today,
        status,
      });

      markAttendance(student.id, moduleId, today, status, "qr");

      if (onMarkSuccess && res.record) {
        onMarkSuccess(res.record);
      }

      toast.success(
        res.isNew
          ? `${student.fullName} marked ${status} in ${res.module?.name ?? getModule(moduleId)?.name} (QR scan recorded)`
          : `Updated ${student.fullName} attendance to ${status}`,
      );
    } catch {
      // Offline fallback
      markAttendance(student.id, moduleId, today, status, "qr");
      toast.success(`${student.fullName} marked ${status} — ${getModule(moduleId)?.name}`);
    } finally {
      setMarking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-3xl border shadow-card transition-colors ${
        isDuplicate
          ? "border-amber-500/40 bg-surface dark:border-amber-500/30"
          : "border-emerald-500/40 bg-surface dark:border-emerald-500/30"
      }`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3 ${
          isDuplicate ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {isDuplicate ? (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Duplicate Scan — Already Marked Present Today
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Student Verified & Eligible
            </>
          )}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss and scan next"
          className="rounded-lg p-1 text-muted hover:text-ink transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {/* Student Overview Header */}
        <div className="flex items-center gap-4">
          <Avatar name={student.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-lg font-extrabold">{student.fullName}</h3>
            <p className="num text-sm text-muted">{student.id}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="primary">{student.batch}</Badge>
              <StatusBadge status={student.status} />
              {student.ref && (
                <span className="text-[11px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-md">
                  Ref: {student.ref}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Verification Message if provided */}
        {verificationMessage && (
          <p className="text-xs text-muted bg-surface-2 p-2.5 rounded-xl border border-line">
            {verificationMessage}
          </p>
        )}

        {/* Duplicate / Existing Status Alert */}
        {isDuplicate && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <Clock className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Student already recorded today</p>
              <p className="mt-0.5 opacity-90">
                Marked as <b className="capitalize">{existing?.status ?? "present"}</b> via {existing?.method ?? "qr"} for module{" "}
                <b>{getModule(moduleId)?.name}</b>.
              </p>
            </div>
          </div>
        )}

        {/* Modules Registered */}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Registered modules</p>
          <div className="flex flex-wrap gap-1.5">
            {student.moduleIds.length > 0 ? (
              student.moduleIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModuleId(id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    moduleId === id
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : "bg-surface-2 text-muted hover:text-ink hover:bg-surface-3"
                  }`}
                >
                  {getModule(id)?.name ?? id}
                </button>
              ))
            ) : (
              <span className="text-xs text-rose-500">No modules registered</span>
            )}
          </div>
        </div>

        {/* Module enrollment warning if teacher selected another module */}
        {!isEnrolledInSelected && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Student is not registered for the selected class. Choose one of their registered modules above.</span>
          </div>
        )}

        {/* Live Payment Balance Section */}
        <div
          className={`space-y-3 rounded-2xl border p-4 ${
            owed > 0
              ? "border-rose-500/20 bg-rose-500/10"
              : "border-emerald-500/20 bg-emerald-500/10"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-semibold">Tuition payment status</span>
              <p className="text-[11px] text-muted">
                {owed > 0 ? "Pending tuition balance" : "All tuition fees up to date"}
              </p>
            </div>
            {loadingBalance ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : (
              <Badge
                tone={
                  paymentStatus === "paid"
                    ? "green"
                    : paymentStatus === "partial"
                      ? "amber"
                      : "rose"
                }
              >
                {paymentStatus === "paid"
                  ? "Paid"
                  : paymentStatus === "partial"
                    ? "Partial"
                    : "Unpaid"}
              </Badge>
            )}
          </div>

          {loadingBalance ? (
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface/80 p-2.5 text-center">
                <div>
                  <p className="text-[10px] font-medium text-muted">Total fees</p>
                  <p className="num text-xs font-bold sm:text-sm">{formatLkrPrice(resolvedFeeTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted">Paid</p>
                  <p className="num text-xs font-bold text-emerald-500 sm:text-sm">
                    {formatLkrPrice(resolvedPaidTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted">Balance</p>
                  <p
                    className={`num text-xs font-bold sm:text-sm ${
                      owed > 0 ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {owed > 0 ? formatLkrPrice(owed) : "Settled"}
                  </p>
                </div>
              </div>
              <ProgressBar
                tone="teal"
                value={resolvedFeeTotal ? (resolvedPaidTotal / resolvedFeeTotal) * 100 : 100}
              />
            </>
          )}
        </div>

        {/* Inactive Student Warning */}
        {student.status !== "active" && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            This student is currently {student.status}. Please check with the administrator before admitting to class.
          </p>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-1">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              aria-label="Module to mark"
            >
              {student.moduleIds.map((id) => (
                <option key={id} value={id}>
                  {getModule(id)?.name} ({getModule(id)?.code})
                </option>
              ))}
            </Select>

            <div className="flex gap-2">
              <Button
                onClick={() => handleMark("present")}
                disabled={marking || !moduleId || !isEnrolledInSelected}
                variant={isDuplicate ? "secondary" : "primary"}
              >
                {isDuplicate ? (
                  <>
                    <RefreshCw className={`h-4 w-4 ${marking ? "animate-spin" : ""}`} />
                    Update Present
                  </>
                ) : (
                  <>
                    <UserCheck className={`h-4 w-4 ${marking ? "animate-spin" : ""}`} />
                    Mark Present
                  </>
                )}
              </Button>

              <Button variant="secondary" onClick={() => setPay(true)}>
                <CreditCard className="h-4 w-4" /> Pay
              </Button>
            </div>
          </div>

          {/* Quick status change buttons if already marked or late */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Change:</span>
              {(["late", "excused", "absent"] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={marking || !moduleId}
                  onClick={() => handleMark(st)}
                  className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium capitalize text-ink hover:bg-surface-3 transition active:scale-95 cursor-pointer"
                >
                  {st}
                </button>
              ))}
            </div>

            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Scan Next →
            </Button>
          </div>
        </div>
      </div>

      <RecordPaymentModal
        open={pay}
        studentId={student.id}
        studentSummary={
          liveBalance
            ? {
                id: student.id,
                fullName: student.fullName,
                feeTotal: liveBalance.feeTotal,
                paidTotal: liveBalance.paidTotal,
                outstanding: liveBalance.outstanding,
              }
            : undefined
        }
        onDone={(res) => {
          const s = res.studentSummary;
          setLiveBalance({
            feeTotal: s.feeTotal,
            paidTotal: s.paidTotal,
            outstanding: s.outstanding,
            paymentStatus: s.paymentStatus ?? deriveStatus(s.paidTotal, s.outstanding),
          });
        }}
        onClose={() => setPay(false)}
      />
    </motion.div>
  );
}
