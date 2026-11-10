import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, UserCheck, X } from "lucide-react";
import type { Student } from "@/types";
import { Avatar, Badge, Button, Select, StatusBadge } from "@/components/ui/primitives";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { fmtLKR, todayISO } from "@/lib/utils";

export function ScanResult({ student, onDismiss }: { student: Student; onDismiss: () => void }) {
  const { getModule, outstanding, attendance, markAttendance } = useAppData();
  const toast = useToast();
  const [moduleId, setModuleId] = useState(student.moduleIds[0] ?? "");
  const [pay, setPay] = useState(false);
  const owed = outstanding(student.id);
  const today = todayISO();
  const existing = attendance.find((a) => a.id === `att_${student.id}_${moduleId}_${today}`);

  const mark = () => {
    if (!moduleId) return toast.error("This student has no registered modules.");
    if (existing?.status === "present") return toast.info(`${student.fullName} is already marked present for ${getModule(moduleId)?.name} today.`);
    markAttendance(student.id, moduleId, today, "present", "qr");
    toast.success(`${student.fullName} marked present — ${getModule(moduleId)?.name}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-surface shadow-card">
      <div className="flex items-center justify-between bg-emerald-500/10 px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Student found</span>
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded-lg p-1 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={student.fullName} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate font-heading text-lg font-extrabold">{student.fullName}</h3>
            <p className="num text-sm text-muted">{student.id}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone="primary">{student.batch}</Badge><StatusBadge status={student.status} /></div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Registered modules</p>
          <div className="flex flex-wrap gap-1.5">{student.moduleIds.map((id) => <Badge key={id} tone="teal">{getModule(id)?.name}</Badge>)}</div>
        </div>
        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${owed > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}`}>
          <span className="text-sm font-semibold">Outstanding payment</span>
          <span className={`num text-lg font-bold ${owed > 0 ? "text-rose-500" : "text-emerald-500"}`}>{owed > 0 ? fmtLKR(owed) : "Settled"}</span>
        </div>
        {student.status !== "active" && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">This student is {student.status}. Check with the administrator before marking attendance.</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)} aria-label="Module">
            {student.moduleIds.map((id) => <option key={id} value={id}>{getModule(id)?.name}</option>)}
          </Select>
          <Button onClick={mark}><UserCheck className="h-4 w-4" /> Mark attendance</Button>
          <Button variant="secondary" onClick={() => setPay(true)}><CreditCard className="h-4 w-4" /> Record payment</Button>
        </div>
        {existing && <p className="text-xs text-muted">Today's status for this module: <b className="capitalize text-ink">{existing.status}</b> ({existing.method})</p>}
      </div>
      <RecordPaymentModal open={pay} studentId={student.id} onClose={() => setPay(false)} />
    </motion.div>
  );
}
