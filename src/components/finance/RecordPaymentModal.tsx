import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/overlays";
import { Badge, Button, Field, Input, MockNote, ProgressBar, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { PAYMENT_METHODS } from "@/data/mock";
import { fmtLKR, todayISO } from "@/lib/utils";

function PaymentForm({ initialStudentId, onClose, onDone }: { initialStudentId?: string; onClose: () => void; onDone?: (amount: number) => void }) {
  const { students, outstanding, feeTotal, paidTotal, recordPayment, getStudent } = useAppData();
  const toast = useToast();
  const [sid, setSid] = useState(initialStudentId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const sorted = useMemo(() => [...students].sort((a, b) => a.fullName.localeCompare(b.fullName)), [students]);
  const owed = sid ? outstanding(sid) : 0;
  const amt = Number(amount) || 0;
  const round = (n: number) => Math.round(n / 500) * 500;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sid) return setError("Select a student first.");
    if (owed <= 0) return setError("This student has no outstanding balance.");
    if (amt <= 0) return setError("Enter a payment amount greater than zero.");
    if (amt > owed) return setError(`Amount exceeds the outstanding balance of ${fmtLKR(owed)}.`);
    recordPayment({ studentId: sid, amount: amt, method, note, date });
    toast.success(`${fmtLKR(amt)} recorded for ${getStudent(sid)?.fullName} (demo entry — no real payment processed)`);
    onDone?.(amt);
    onClose();
  };

  return (
    <form id="payment-form" onSubmit={submit} className="space-y-4">
      <Field label="Student">
        <Select value={sid} onChange={(e) => { setSid(e.target.value); setAmount(""); setError(""); }}>
          <option value="">Select a student…</option>
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>{s.fullName} — {s.id}</option>
          ))}
        </Select>
      </Field>

      {sid && (
        <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-[11px] text-muted">Total fees</p><p className="num text-sm font-semibold">{fmtLKR(feeTotal(sid))}</p></div>
            <div><p className="text-[11px] text-muted">Paid</p><p className="num text-sm font-semibold text-emerald-500">{fmtLKR(paidTotal(sid))}</p></div>
            <div><p className="text-[11px] text-muted">Outstanding</p><p className="num text-sm font-semibold text-rose-500">{fmtLKR(owed)}</p></div>
          </div>
          <ProgressBar className="mt-3" tone="teal" value={feeTotal(sid) ? (paidTotal(sid) / feeTotal(sid)) * 100 : 0} />
        </div>
      )}

      <div>
        <Field label="Amount (LKR)">
          <Input type="number" min={0} step={100} placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className="num" />
        </Field>
        {sid && owed > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted">Quick fill:</span>
            <Button size="sm" variant="soft" onClick={() => setAmount(String(owed))}>Full balance</Button>
            <Button size="sm" variant="soft" onClick={() => setAmount(String(Math.min(owed, round(owed / 2) || owed)))}>50% partial</Button>
            <Button size="sm" variant="soft" onClick={() => setAmount(String(Math.min(owed, 10000)))}>LKR 10,000</Button>
            {amt > 0 && amt <= owed && <Badge tone={amt === owed ? "green" : "amber"}>{amt === owed ? "Settles in full" : `Partial · ${fmtLKR(owed - amt)} remains`}</Badge>}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Instalment 2" /></Field>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">{error}</p>}
      <MockNote>Demo mode: this only adds an entry to local mock data. No payment gateway is connected and no real money is processed.</MockNote>
    </form>
  );
}

export function RecordPaymentModal({ open, onClose, studentId, onDone }: { open: boolean; onClose: () => void; studentId?: string; onDone?: (amount: number) => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record student payment"
      description="Supports full and partial instalments"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form">Record payment</Button>
        </>
      }
    >
      <PaymentForm initialStudentId={studentId} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}
