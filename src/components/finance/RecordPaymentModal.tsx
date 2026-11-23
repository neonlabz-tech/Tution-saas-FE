import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import { Avatar, Badge, Button, Field, Input, ProgressBar, Select, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createPayment, listPaymentStudents } from "@/api/payments";
import { createNotification } from "@/api/notifications";
import { getStudentById } from "@/api/students";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { cn, fmtLKR, todayISO } from "@/lib/utils";
import type { RecordStudentPaymentResponse } from "@/types";

export interface PaymentStudentSummary {
  id: string;
  fullName: string;
  feeTotal: number;
  paidTotal: number;
  outstanding: number;
}

function PaymentForm({
  initialStudentId,
  initialSummary,
  onClose,
  onDone,
  onSubmittingChange,
}: {
  initialStudentId?: string;
  initialSummary?: PaymentStudentSummary;
  onClose: () => void;
  onDone?: (result: RecordStudentPaymentResponse) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const toast = useToast();
  const [sid, setSid] = useState(initialStudentId ?? "");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const [students, setStudents] = useState<PaymentStudentSummary[]>(() =>
    initialSummary ? [initialSummary] : [],
  );
  const [loadingList, setLoadingList] = useState(!initialStudentId);
  const [selectedDetail, setSelectedDetail] = useState<PaymentStudentSummary | null>(
    initialSummary && initialSummary.id === initialStudentId ? initialSummary : null,
  );
  const [loadingStudent, setLoadingStudent] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounce server search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Close dropdown on click outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Query students from backend matching search text
  useEffect(() => {
    const controller = new AbortController();
    setLoadingList(true);
    listPaymentStudents(
      {
        q: debouncedSearch || undefined,
        limit: 50,
        includeGraduated: true,
      },
      controller.signal,
    )
      .then((res) => {
        const list = res.items.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          feeTotal: item.feeTotal,
          paidTotal: item.paidTotal,
          outstanding: item.outstanding,
        }));
        setStudents(list);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false);
      });
    return () => controller.abort();
  }, [debouncedSearch]);

  // Load selected student detail if not already available
  useEffect(() => {
    if (!sid) {
      setSelectedDetail(null);
      return;
    }
    if (initialSummary && initialSummary.id === sid) {
      setSelectedDetail(initialSummary);
      return;
    }
    const fromList = students.find((s) => s.id === sid);
    if (fromList) {
      setSelectedDetail(fromList);
      return;
    }
    const controller = new AbortController();
    setLoadingStudent(true);
    getStudentById(sid, controller.signal)
      .then((s) => {
        const summary: PaymentStudentSummary = {
          id: s.id,
          fullName: s.fullName,
          feeTotal: s.feeTotal,
          paidTotal: s.paidTotal,
          outstanding: s.outstanding,
        };
        setSelectedDetail(summary);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load student balance");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStudent(false);
      });
    return () => controller.abort();
  }, [sid, initialSummary, students]);

  const filteredStudents = useMemo(() => {
    const map = new Map<string, PaymentStudentSummary>();
    for (const s of students) map.set(s.id, s);
    if (initialSummary) map.set(initialSummary.id, initialSummary);
    if (selectedDetail) map.set(selectedDetail.id, selectedDetail);
    const list = [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));

    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [students, initialSummary, selectedDetail, searchText]);

  const activeStudent = selectedDetail ?? filteredStudents.find((s) => s.id === sid) ?? null;
  const totalFee = activeStudent?.feeTotal ?? 0;
  const totalPaid = activeStudent?.paidTotal ?? 0;
  const owed = activeStudent?.outstanding ?? 0;
  const amt = Number(amount) || 0;
  const round = (n: number) => Math.round(n / 500) * 500;

  const selectStudent = (s: PaymentStudentSummary) => {
    setSid(s.id);
    setSelectedDetail(s);
    setSearchText("");
    setDropdownOpen(false);
    setAmount("");
    setError("");
  };

  const clearStudent = () => {
    setSid("");
    setSelectedDetail(null);
    setSearchText("");
    setAmount("");
    setError("");
    setDropdownOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sid) return setError("Search and select a student first.");
    if (owed <= 0) return setError("This student has no outstanding balance.");
    if (amt <= 0) return setError("Enter a payment amount greater than zero.");
    if (amt > owed) return setError(`Amount exceeds the outstanding balance of ${fmtLKR(owed)}.`);

    setError("");
    setSubmitting(true);
    onSubmittingChange(true);
    try {
      const result = await createPayment({
        studentId: sid,
        amount: amt,
        method,
        category,
        date,
        ...(description.trim() ? { description: description.trim() } : {}),
      });

      const receiptNo = result.payment?.receiptNo || result.payment?.id || "Receipt";
      const studentName = activeStudent?.fullName ?? sid;

      try {
        await createNotification({
          type: "payment",
          title: "Payment Received",
          subtitle: `LKR ${amt.toLocaleString()} collected for ${studentName} (${receiptNo}).`,
          link: `/dashboard/payments?q=${encodeURIComponent(receiptNo)}`,
          metadata: { paymentId: result.payment?.id, receiptNo, studentId: sid, amount: amt },
        });
      } catch {
        // non-blocking
      }

      const receiptSuffix = result.payment?.receiptNo ? ` · Receipt ${result.payment.receiptNo}` : "";
      toast.success(`${fmtLKR(amt)} payment recorded for ${activeStudent?.fullName ?? sid}${receiptSuffix}`);
      onDone?.(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payment";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      onSubmittingChange(false);
    }
  };

  return (
    <form id="payment-form" onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label="Student">
        {sid && activeStudent ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={activeStudent.fullName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeStudent.fullName}</p>
                <p className="num text-[11px] text-muted">{activeStudent.id}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={clearStudent}
              aria-label="Change student"
              title="Change student"
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface hover:text-ink disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Change
            </button>
          </div>
        ) : (
          <div ref={comboRef} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchText}
              disabled={submitting}
              placeholder="Search student by name or ID…"
              className="pl-9 pr-9"
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setSearchText(e.target.value);
                setDropdownOpen(true);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDropdownOpen(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredStudents.length > 0) {
                    selectStudent(filteredStudents[0]);
                  }
                }
              }}
            />
            {loadingList ? (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
            ) : searchText ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
                {loadingList && filteredStudents.length === 0 ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-9 w-full rounded-xl" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted">
                    No students found{searchText ? ` for “${searchText}”` : ""}
                  </p>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectStudent(s);
                      }}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={s.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.fullName}</p>
                          <p className="num text-[11px] text-muted">{s.id}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "num shrink-0 text-xs font-semibold",
                          s.outstanding > 0 ? "text-rose-500" : "text-emerald-500",
                        )}
                      >
                        {s.outstanding > 0 ? fmtLKR(s.outstanding) : "Settled"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Field>

      {sid && (
        <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
          {loadingStudent ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <Skeleton className="h-2" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[11px] text-muted">Total fees</p>
                  <p className="num text-sm font-semibold">{fmtLKR(totalFee)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Paid</p>
                  <p className="num text-sm font-semibold text-emerald-500">{fmtLKR(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Outstanding</p>
                  <p className="num text-sm font-semibold text-rose-500">{fmtLKR(owed)}</p>
                </div>
              </div>
              <ProgressBar className="mt-3" tone="teal" value={totalFee ? (totalPaid / totalFee) * 100 : 0} />
            </>
          )}
        </div>
      )}

      <div>
        <Field label="Amount (LKR)">
          <Input
            type="number"
            min={0}
            step={100}
            placeholder="0"
            value={amount}
            disabled={submitting}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            className="num"
          />
        </Field>
        {sid && owed > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted">Quick fill:</span>
            <Button size="sm" variant="soft" disabled={submitting} onClick={() => setAmount(String(owed))}>
              Full balance
            </Button>
            <Button
              size="sm"
              variant="soft"
              disabled={submitting}
              onClick={() => setAmount(String(Math.min(owed, round(owed / 2) || owed)))}
            >
              50% partial
            </Button>
            <Button size="sm" variant="soft" disabled={submitting} onClick={() => setAmount(String(Math.min(owed, 10000)))}>
              LKR 10,000
            </Button>
            {amt > 0 && amt <= owed && (
              <Badge tone={amt === owed ? "green" : "amber"}>
                {amt === owed ? "Settles in full" : `Partial · ${fmtLKR(owed - amt)} remains`}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Method">
          <Select value={method} disabled={submitting} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={category} disabled={submitting} onChange={(e) => setCategory(e.target.value)}>
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={date}
            max={todayISO()}
            disabled={submitting}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Description (optional)">
        <Input
          value={description}
          disabled={submitting}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Instalment 2"
        />
      </Field>

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">{error}</p>}
    </form>
  );
}

export function RecordPaymentModal({
  open,
  onClose,
  studentId,
  studentSummary,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  studentId?: string;
  studentSummary?: PaymentStudentSummary;
  onDone?: (result: RecordStudentPaymentResponse) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Record student payment"
      description="Supports full and partial instalments"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={submitting}>
            {submitting ? "Recording…" : "Record payment"}
          </Button>
        </>
      }
    >
      {open && (
        <PaymentForm
          key={studentId ?? "any"}
          initialStudentId={studentId}
          initialSummary={studentSummary}
          onClose={onClose}
          onDone={onDone}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
