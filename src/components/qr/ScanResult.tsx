import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, CreditCard, RefreshCw, UserCheck, X } from "lucide-react";
import type { AttendanceRecord, AttendanceStatus, Student, StudentDetail, StudentListItem } from "@/types";
import { Avatar, Badge, Button, Select, StatusBadge } from "@/components/ui/primitives";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { attendanceApi } from "@/lib/api";
import { fmtLKR, todayISO } from "@/lib/utils";

type ScanStudent = Student | StudentListItem | StudentDetail;

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
  const [owedOverride, setOwedOverride] = useState<number | null>(null);

  const hasServerOutstanding = "outstanding" in student && typeof student.outstanding === "number";
  const owed = owedOverride ?? (hasServerOutstanding ? student.outstanding! : outstanding(student.id));
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

        {/* Outstanding Payment Section */}
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
            owed > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"
          }`}
        >
          <div>
            <span className="text-sm font-semibold">Outstanding payment</span>
            <p className="text-[11px] text-muted">
              {owed > 0 ? "Pending tuition balance" : "All tuition fees up to date"}
            </p>
          </div>
          <span className={`num text-lg font-bold ${owed > 0 ? "text-rose-500" : "text-emerald-500"}`}>
            {owed > 0 ? fmtLKR(owed) : "Settled"}
          </span>
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
          hasServerOutstanding
            ? {
                id: student.id,
                fullName: student.fullName,
                feeTotal: "feeTotal" in student && typeof student.feeTotal === "number" ? student.feeTotal : feeTotal(student.id),
                paidTotal: "paidTotal" in student && typeof student.paidTotal === "number" ? student.paidTotal : paidTotal(student.id),
                outstanding: owed,
              }
            : undefined
        }
        onDone={(res) => setOwedOverride(res.studentSummary.outstanding)}
        onClose={() => setPay(false)}
      />
    </motion.div>
  );
}
