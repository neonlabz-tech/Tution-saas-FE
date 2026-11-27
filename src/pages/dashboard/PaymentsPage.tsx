import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileDown,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type {
  PaginationMeta,
  PaymentItem,
  PaymentRecordStatus,
  StudentDetail,
  StudentPaymentStatus,
  StudentPaymentSummary,
  StudentStatus,
} from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/overlays";
import { PeriodFilter, usePeriod } from "@/components/ui/PeriodFilter";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import {
  deletePayment,
  listPayments,
  listPaymentStudents,
  updatePayment,
} from "@/api/payments";
import { createNotification } from "@/api/notifications";
import { getStudentById } from "@/api/students";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { useBatches } from "@/hooks/useBatches";
import {
  RecordPaymentModal,
  type PaymentStudentSummary,
} from "@/components/finance/RecordPaymentModal";
import { cn, formatLkrPrice, formatShortDate, todayISO } from "@/lib/utils";

type Tab = "students" | "history";

function derivePaymentStatus(item: StudentPaymentSummary): StudentPaymentStatus {
  if (item.paymentStatus) return item.paymentStatus;
  if (item.outstanding <= 0) return "paid";
  if (item.paidTotal > 0) return "partial";
  return "unpaid";
}

function StudentPaymentStatusBadge({ status }: { status: StudentPaymentStatus }) {
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "partial") return <Badge tone="amber">Partial</Badge>;
  return <Badge tone="rose">Unpaid</Badge>;
}

function ReceiptStatusBadge({ status }: { status: PaymentRecordStatus }) {
  if (status === "completed") return <Badge tone="green">Completed</Badge>;
  if (status === "refunded") return <Badge tone="amber">Refunded</Badge>;
  return <Badge tone="rose">Void</Badge>;
}

function downloadPaymentReceiptPdf(params: {
  payment: PaymentItem;
  studentName?: string;
  studentBatch?: string;
  instituteName?: string;
}) {
  const { payment, studentName, studentBatch } = params;
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 84, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("EduFlow", 32, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const instituteTitle = params.instituteName?.trim()
    ? `${params.instituteName.trim()} · Official Payment Receipt`
    : (import.meta.env.VITE_INSTITUTE_NAME ? `${import.meta.env.VITE_INSTITUTE_NAME} · Official Payment Receipt` : "Official Payment Receipt");
  doc.text(instituteTitle, 32, 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RECEIPT", pageW - 32, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(payment.receiptNo || payment.id || "—", pageW - 32, 52, { align: "right" });
  doc.setFontSize(8);
  doc.text(`Ref: ${payment.id}`, pageW - 32, 65, { align: "right" });

  // Receipt metadata
  let y = 112;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text("DATE", 32, y);
  doc.text("PAYMENT METHOD", pageW / 2 - 20, y);
  doc.text("STATUS", pageW - 32, y, { align: "right" });

  y += 16;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(formatShortDate(payment.date), 32, y);
  doc.text(payment.method || "Cash", pageW / 2 - 20, y);
  doc.text(payment.status.toUpperCase(), pageW - 32, y, { align: "right" });

  // Divider
  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(32, y, pageW - 32, y);

  // Student info
  y += 22;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("RECEIVED FROM", 32, y);

  y += 18;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(studentName || payment.student?.fullName || payment.studentId || "Student", 32, y);

  y += 16;
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subParts = [
    payment.studentId || payment.student?.id,
    studentBatch || payment.student?.batch,
  ].filter(Boolean);
  if (subParts.length) {
    doc.text(subParts.join(" · "), 32, y);
  }

  // Payment details box
  y += 24;
  const boxHeight = payment.discount > 0 ? 114 : 92;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(32, y, pageW - 64, boxHeight, 8, 8, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(32, y, pageW - 64, boxHeight, 8, 8, "S");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text("CATEGORY", 48, y + 24);
  doc.text("DESCRIPTION", 48, y + 52);
  if (payment.discount > 0) {
    doc.text("DISCOUNT", 48, y + 88);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(payment.category || "Tuition fees", 140, y + 24);
  doc.setFont("helvetica", "normal");
  doc.text(payment.description || "Student fee payment", 140, y + 52, {
    maxWidth: pageW - 190,
  });
  if (payment.discount > 0) {
    doc.text(formatLkrPrice(payment.discount), 140, y + 88);
  }

  // Amount highlight
  y += boxHeight + 20;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(32, y, pageW - 64, 54, 8, 8, "F");
  doc.setTextColor(5, 150, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AMOUNT PAID", 48, y + 31);
  doc.setFontSize(18);
  doc.text(formatLkrPrice(payment.amount), pageW - 48, y + 33, { align: "right" });

  if (payment.collectedBy) {
    y += 74;
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Collected by: ${payment.collectedBy}`, 32, y);
  }

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "This is a computer-generated receipt from EduFlow Tuition Management System.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 32,
    { align: "center" },
  );

  const safeId = (payment.receiptNo || payment.id || "receipt").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`eduflow_receipt_${safeId}.pdf`);
}

function EditPaymentModal({
  payment,
  onClose,
  onSaved,
}: {
  payment: PaymentItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PaymentRecordStatus>("completed");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amount ?? ""));
    setDiscount(String(payment.discount ?? 0));
    setMethod(payment.method || PAYMENT_METHODS[0]);
    setCategory(payment.category || INCOME_CATEGORIES[0]);
    setDate(payment.date ? payment.date.slice(0, 10) : todayISO());
    setDescription(payment.description ?? "");
    setStatus(payment.status ?? "completed");
    setError("");
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    const amt = Number(amount);
    const disc = Number(discount) || 0;
    if (!amt || amt <= 0) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }
    if (disc < 0) {
      setError("Discount cannot be negative.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await updatePayment(payment.id, {
        amount: amt,
        discount: disc,
        method,
        category,
        date,
        description: description.trim(),
        status,
      });

      const receiptNo = payment.receiptNo || payment.id;
      const studentName = payment.student?.fullName || payment.studentId;
      try {
        await createNotification({
          type: "payment",
          title: "Payment Updated",
          subtitle: `Receipt ${receiptNo} for ${studentName} updated (${status}, LKR ${amt.toLocaleString()}) by ${user?.fullName || "Admin"}.`,
          link: `/dashboard/payments?q=${encodeURIComponent(receiptNo)}`,
          targetRoles: ["super_admin"],
          actorId: user?.id,
          metadata: { paymentId: payment.id, receiptNo, amount: amt, status },
        });
      } catch {
        // non-blocking
      }

      toast.success(`Payment ${payment.receiptNo || payment.id} updated`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update payment";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(payment)}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={`Edit payment ${payment?.receiptNo ?? ""}`}
      description={
        payment
          ? `${payment.student?.fullName ?? payment.studentId} · ${payment.id} (auto-syncs with Finance)`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-payment-form" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {payment && (
        <form
          id="edit-payment-form"
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4"
        >
          {error && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (LKR)">
              <Input
                type="number"
                min={0}
                step={100}
                value={amount}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                }}
                onChange={(e) => setAmount(e.target.value)}
                className="num"
              />
            </Field>
            <Field label="Discount (LKR)">
              <Input
                type="number"
                min={0}
                step={100}
                value={discount}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                }}
                onChange={(e) => setDiscount(e.target.value)}
                className="num"
              />
            </Field>
            <Field label="Method">
              <Select
                value={method}
                disabled={submitting}
                onChange={(e) => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={category}
                disabled={submitting}
                onChange={(e) => setCategory(e.target.value)}
              >
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
            <Field label="Payment Status">
              <Select
                value={status}
                disabled={submitting}
                onChange={(e) => setStatus(e.target.value as PaymentRecordStatus)}
              >
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
                <option value="void">Void</option>
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input
                value={description}
                disabled={submitting}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Term 1 tuition instalment"
              />
            </Field>
          </div>
          {status !== "completed" && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              Setting status to <b>{status}</b> removes the synced income transaction from Finance
              and restores the student’s outstanding balance.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

function StudentPaymentDrawer({
  studentId,
  refreshKey,
  onClose,
  onCollect,
  onEditPayment,
  onDeletePayment,
}: {
  studentId: string | null;
  refreshKey: number;
  onClose: () => void;
  onCollect: (summary: PaymentStudentSummary) => void;
  onEditPayment: (p: PaymentItem) => void;
  onDeletePayment: (p: PaymentItem) => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [receipts, setReceipts] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!studentId) {
      setDetail(null);
      setReceipts([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getStudentById(studentId, controller.signal),
      listPayments({ studentId, limit: 50 }, controller.signal).catch(() => null),
    ])
      .then(([studentRes, paymentsRes]) => {
        setDetail(studentRes);
        if (paymentsRes && paymentsRes.items.length > 0) {
          setReceipts(paymentsRes.items);
        } else {
          // Backwards-compatible fallback for legacy tuition transactions without payment docs
          const fallback: PaymentItem[] = (studentRes.payments ?? []).map((p) => ({
            id: p.id,
            receiptNo: p.id,
            studentId: p.studentId ?? studentRes.id,
            amount: p.amount,
            discount: 0,
            category: p.category || "Tuition fees",
            method: p.method || "Cash",
            date: p.date,
            description: p.description || "",
            status: "completed",
            student: {
              id: studentRes.id,
              fullName: studentRes.fullName,
              batch: studentRes.batch,
              email: studentRes.email,
            },
          }));
          setReceipts(fallback);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load student payment ledger");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [studentId, refreshKey, retryTick]);

  const status: StudentPaymentStatus = detail
    ? detail.outstanding <= 0
      ? "paid"
      : detail.paidTotal > 0
        ? "partial"
        : "unpaid"
    : "unpaid";

  return (
    <Drawer
      open={Boolean(studentId)}
      onClose={onClose}
      title={detail ? detail.fullName : "Student payment ledger"}
      description={detail ? `${detail.id} · ${detail.batch}` : undefined}
      footer={
        detail && (
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {detail.outstanding > 0 ? (
              <Button
                onClick={() =>
                  onCollect({
                    id: detail.id,
                    fullName: detail.fullName,
                    feeTotal: detail.feeTotal,
                    paidTotal: detail.paidTotal,
                    outstanding: detail.outstanding,
                  })
                }
              >
                <CreditCard className="h-4 w-4" /> Collect payment
              </Button>
            ) : (
              <Badge tone="green">All fees settled</Badge>
            )}
          </div>
        )
      }
    >
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" />
          <p className="text-sm font-semibold">Failed to load student ledger</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => setRetryTick((t) => t + 1)}
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && detail && (
        <div className="space-y-6">
          {/* Student header */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/50 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={detail.fullName} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-bold">{detail.fullName}</p>
                <p className="num text-xs text-muted">
                  {detail.id} · {detail.email}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="primary">{detail.batch}</Badge>
                  <StatusBadge status={detail.status} />
                  <StudentPaymentStatusBadge status={status} />
                </div>
              </div>
            </div>
          </div>

          {/* Fee overview */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] text-muted">Total fees</p>
                <p className="num mt-0.5 text-sm font-bold">{formatLkrPrice(detail.feeTotal)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Paid</p>
                <p className="num mt-0.5 text-sm font-bold text-emerald-500">
                  {formatLkrPrice(detail.paidTotal)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Outstanding</p>
                <p
                  className={cn(
                    "num mt-0.5 text-sm font-bold",
                    detail.outstanding > 0 ? "text-rose-500" : "text-emerald-500",
                  )}
                >
                  {formatLkrPrice(detail.outstanding)}
                </p>
              </div>
            </div>
            <ProgressBar
              className="mt-3"
              tone="teal"
              value={detail.feeTotal ? (detail.paidTotal / detail.feeTotal) * 100 : 100}
            />
          </div>

          {/* Enrolled modules fee breakdown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Enrolled Modules ({detail.modules?.length ?? 0})
            </p>
            {detail.modules && detail.modules.length > 0 ? (
              <div className="divide-y divide-line/70 rounded-2xl border border-line bg-surface">
                {detail.modules.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="num text-[11px] text-muted">{m.code}</p>
                    </div>
                    <span className="num font-semibold">{formatLkrPrice(m.fee)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-line p-4 text-center text-xs text-muted">
                No enrolled modules found.
              </p>
            )}
          </div>

          {/* Student payment receipts list */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Payment Receipts ({receipts.length})
            </p>
            {receipts.length === 0 ? (
              <EmptyState
                icon={<Banknote className="h-6 w-6" />}
                title="No payments recorded"
                text="Use the Collect payment button below to record an instalment."
              />
            ) : (
              <div className="space-y-2">
                {receipts.map((p) => {
                  const isNativePayment = p.id.startsWith("PAY-");
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {p.description || p.category || "Tuition fees"}
                          </p>
                          <ReceiptStatusBadge status={p.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatShortDate(p.date)} · {p.method || "Cash"} ·{" "}
                          <span className="num font-medium">{p.receiptNo || p.id}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span
                          className={cn(
                            "num mr-1.5 text-sm font-bold",
                            p.status === "completed" ? "text-emerald-500" : "text-muted line-through",
                          )}
                        >
                          +{formatLkrPrice(p.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Download receipt"
                          title="Download PDF receipt"
                          onClick={() => {
                            downloadPaymentReceiptPdf({
                              payment: p,
                              studentName: detail.fullName,
                              studentBatch: detail.batch,
                              instituteName: config?.instituteName,
                            });
                            toast.success("Receipt PDF downloaded");
                          }}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {isNativePayment && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit payment"
                              onClick={() => onEditPayment(p)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete payment"
                              className="hover:text-rose-500"
                              onClick={() => onDeletePayment(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function PaymentsPage() {
  const toast = useToast();
  const { user, config } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("students");
  const period = usePeriod("year");
  const [refreshKey, setRefreshKey] = useState(0);
  const { batches: batchOptions } = useBatches();

  // Modals & Drawers
  const [payModal, setPayModal] = useState<{
    open: boolean;
    studentId?: string;
    summary?: PaymentStudentSummary;
  }>({ open: false });
  const [editPaymentItem, setEditPaymentItem] = useState<PaymentItem | null>(null);
  const [delPaymentItem, setDelPaymentItem] = useState<PaymentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Global KPI summary from GET /api/payments/students
  const [kpiLoading, setKpiLoading] = useState(true);
  const [globalSummary, setGlobalSummary] = useState({
    totalStudents: 0,
    debtorCount: 0,
    settledCount: 0,
    totalOutstanding: 0,
    totalCollected: 0,
  });

  // Tab 1: Student Fee Status state (GET /api/payments/students)
  const [studentsList, setStudentsList] = useState<StudentPaymentSummary[]>([]);
  const [studentsPagination, setStudentsPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  // Tab 2: Payment History & Receipts state (GET /api/payments)
  const [historyList, setHistoryList] = useState<PaymentItem[]>([]);
  const [historySummary, setHistorySummary] = useState({ totalCollected: 0, totalCount: 0 });
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistoryQ, setDebouncedHistoryQ] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<string>("all");

  // URL params initialization
  useEffect(() => {
    if (params.get("tab") === "history") setTab("history");
    if (params.get("pay") === "1") {
      setPayModal({ open: true });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Debounce student search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(searchQuery.trim());
      setStudentsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce history search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHistoryQ(historySearch.trim());
      setHistoryPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [historySearch]);

  // Reset history page when period or filters change
  useEffect(() => {
    setHistoryPage(1);
  }, [period.period, period.range.from, period.range.to, methodFilter, receiptStatusFilter]);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  // 1. Fetch global KPI summary from GET /api/payments/students
  useEffect(() => {
    const controller = new AbortController();
    setKpiLoading(true);

    listPaymentStudents({ limit: 1, includeGraduated: false }, controller.signal)
      .then((res) => {
        setGlobalSummary(res.summary);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setKpiLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  // 2. Fetch Student Fee Status table (GET /api/payments/students)
  useEffect(() => {
    if (tab !== "students") return;
    const controller = new AbortController();
    setStudentsLoading(true);
    setStudentsError(null);

    listPaymentStudents(
      {
        q: debouncedQ || undefined,
        batch: batchFilter !== "all" ? batchFilter : undefined,
        status: statusFilter !== "all" ? (statusFilter as StudentStatus) : undefined,
        paymentStatus:
          paymentStatusFilter !== "all"
            ? (paymentStatusFilter as StudentPaymentStatus)
            : undefined,
        includeGraduated: statusFilter === "graduated",
        page: studentsPage,
        limit: 10,
      },
      controller.signal,
    )
      .then((res) => {
        setStudentsList(res.items);
        setStudentsPagination(res.pagination);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStudentsError(err instanceof Error ? err.message : "Failed to load student payments");
      })
      .finally(() => {
        if (!controller.signal.aborted) setStudentsLoading(false);
      });

    return () => controller.abort();
  }, [
    tab,
    debouncedQ,
    batchFilter,
    statusFilter,
    paymentStatusFilter,
    studentsPage,
    refreshKey,
  ]);

  // 3. Fetch Payment History & Receipts table (GET /api/payments)
  useEffect(() => {
    if (tab !== "history") return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);

    listPayments(
      {
        q: debouncedHistoryQ || undefined,
        method: methodFilter !== "all" ? methodFilter : undefined,
        status:
          receiptStatusFilter !== "all"
            ? (receiptStatusFilter as PaymentRecordStatus)
            : undefined,
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        page: historyPage,
        limit: 10,
      },
      controller.signal,
    )
      .then((res) => {
        setHistoryList(res.items);
        setHistorySummary(res.summary);
        setHistoryPagination(res.pagination);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHistoryError(err instanceof Error ? err.message : "Failed to load payment history");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [
    tab,
    debouncedHistoryQ,
    methodFilter,
    receiptStatusFilter,
    period.period,
    period.range.from,
    period.range.to,
    historyPage,
    refreshKey,
  ]);

  const handleDelete = async () => {
    if (!delPaymentItem) return;
    setIsDeleting(true);
    try {
      await deletePayment(delPaymentItem.id);
      const receiptNo = delPaymentItem.receiptNo || delPaymentItem.id;
      try {
        await createNotification({
          type: "payment",
          title: "Payment Deleted",
          subtitle: `Receipt ${receiptNo} has been deleted by ${user?.fullName || "Admin"}.`,
          link: "/dashboard/payments",
          targetRoles: ["super_admin"],
          actorId: user?.id,
          metadata: { paymentId: delPaymentItem.id, receiptNo },
        });
      } catch {
        // non-blocking
      }
      const targetId = delPaymentItem.id;
      const targetAmount = delPaymentItem.amount;
      const targetStudentId = delPaymentItem.studentId;

      setHistoryList((prev) => prev.filter((p) => p.id !== targetId));
      setHistoryPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setStudentsList((prev) =>
        prev.map((s) =>
          s.id === targetStudentId
            ? {
                ...s,
                paidTotal: Math.max(0, s.paidTotal - targetAmount),
                outstanding: s.outstanding + targetAmount,
                paymentStatus: (s.outstanding + targetAmount >= s.feeTotal) ? "unpaid" : "partial",
              }
            : s,
        ),
      );
      setGlobalSummary((prev) => ({
        ...prev,
        totalCollected: Math.max(0, prev.totalCollected - targetAmount),
        totalOutstanding: prev.totalOutstanding + targetAmount,
      }));

      toast.success("Payment deleted and balances recalculated");
      setDelPaymentItem(null);
      if (tab === "history" && historyList.length <= 1 && historyPage > 1) {
        setHistoryPage((p) => p - 1);
      }
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payment");
    } finally {
      setIsDeleting(false);
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      if (tab === "students") {
        const first = await listPaymentStudents({
          q: debouncedQ || undefined,
          batch: batchFilter !== "all" ? batchFilter : undefined,
          status: statusFilter !== "all" ? (statusFilter as StudentStatus) : undefined,
          paymentStatus:
            paymentStatusFilter !== "all"
              ? (paymentStatusFilter as StudentPaymentStatus)
              : undefined,
          includeGraduated: statusFilter === "graduated",
          page: 1,
          limit: 200,
        });
        const all = [...first.items];
        for (let p = 2; p <= Math.min(first.pagination.totalPages, 10); p++) {
          const next = await listPaymentStudents({
            q: debouncedQ || undefined,
            batch: batchFilter !== "all" ? batchFilter : undefined,
            status: statusFilter !== "all" ? (statusFilter as StudentStatus) : undefined,
            paymentStatus:
              paymentStatusFilter !== "all"
                ? (paymentStatusFilter as StudentPaymentStatus)
                : undefined,
            includeGraduated: statusFilter === "graduated",
            page: p,
            limit: 200,
          });
          all.push(...next.items);
        }
        if (!all.length) {
          toast.error("No student payment records match the current filters");
          return;
        }
        const rows = all.map((s) => ({
          "Student ID": s.id,
          "Full Name": s.fullName,
          Batch: s.batch,
          "Student Status": s.status,
          "Payment Status": derivePaymentStatus(s),
          "Total Fees (LKR)": s.feeTotal,
          "Paid (LKR)": s.paidTotal,
          "Outstanding (LKR)": s.outstanding,
          "Last Payment Date": s.lastPaymentDate ?? "",
          "Last Payment Amount (LKR)": s.lastPaymentAmount ?? "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Student Payments");
        XLSX.writeFile(wb, `eduflow_student_payments.xlsx`);
        toast.success(`Exported ${rows.length} student payment summaries`);
      } else {
        const first = await listPayments({
          q: debouncedHistoryQ || undefined,
          method: methodFilter !== "all" ? methodFilter : undefined,
          status:
            receiptStatusFilter !== "all"
              ? (receiptStatusFilter as PaymentRecordStatus)
              : undefined,
          period: period.period,
          from: period.range.from,
          to: period.range.to,
          page: 1,
          limit: 200,
        });
        const all = [...first.items];
        for (let p = 2; p <= Math.min(first.pagination.totalPages, 10); p++) {
          const next = await listPayments({
            q: debouncedHistoryQ || undefined,
            method: methodFilter !== "all" ? methodFilter : undefined,
            status:
              receiptStatusFilter !== "all"
                ? (receiptStatusFilter as PaymentRecordStatus)
                : undefined,
            period: period.period,
            from: period.range.from,
            to: period.range.to,
            page: p,
            limit: 200,
          });
          all.push(...next.items);
        }
        if (!all.length) {
          toast.error("No payment records match the selected filters");
          return;
        }
        const rows = all.map((t) => ({
          "Receipt No": t.receiptNo,
          "Payment ID": t.id,
          Date: t.date,
          "Student ID": t.studentId,
          "Student Name": t.student?.fullName ?? "",
          Category: t.category,
          Description: t.description,
          Method: t.method,
          Status: t.status,
          "Discount (LKR)": t.discount ?? 0,
          "Amount (LKR)": t.amount,
          "Collected By": t.collectedBy ?? "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Payment History");
        XLSX.writeFile(
          wb,
          `eduflow_payment_history_${period.range.from}_${period.range.to}.xlsx`,
        );
        toast.success(`Exported ${rows.length} payment receipts`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export Excel");
    } finally {
      setExporting(false);
    }
  };

  const studentCols = useMemo<Columns<StudentPaymentSummary>>(
    () => [
      {
        accessorKey: "fullName",
        header: "Student",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar name={s.fullName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{s.fullName}</p>
                <p className="num text-[11px] text-muted">
                  {s.id} · {s.batch}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "feeTotal",
        header: "Total Fees",
        cell: (c) => (
          <span className="num whitespace-nowrap text-sm font-medium">
            {formatLkrPrice(c.getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: "paidTotal",
        header: "Paid",
        cell: ({ row }) => {
          const s = row.original;
          const pct = s.feeTotal > 0 ? (s.paidTotal / s.feeTotal) * 100 : 100;
          return (
            <div className="w-32 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="num font-semibold text-emerald-500">
                  {formatLkrPrice(s.paidTotal)}
                </span>
                <span className="num text-[10px] text-muted">{Math.round(pct)}%</span>
              </div>
              <ProgressBar tone="teal" value={pct} />
            </div>
          );
        },
      },
      {
        accessorKey: "outstanding",
        header: "Outstanding",
        cell: (c) => {
          const val = c.getValue() as number;
          return (
            <span
              className={cn(
                "num whitespace-nowrap text-sm font-bold",
                val > 0 ? "text-rose-500" : "text-emerald-500",
              )}
            >
              {val > 0 ? formatLkrPrice(val) : "LKR 0"}
            </span>
          );
        },
      },
      {
        id: "paymentStatus",
        header: "Status",
        cell: ({ row }) => (
          <StudentPaymentStatusBadge status={derivePaymentStatus(row.original)} />
        ),
      },
      {
        accessorKey: "lastPaymentDate",
        header: "Last Payment",
        cell: ({ row }) => {
          const s = row.original;
          if (!s.lastPaymentDate) {
            return <span className="text-xs text-muted">No payments yet</span>;
          }
          return (
            <div className="whitespace-nowrap">
              <p className="text-xs font-medium">{formatShortDate(s.lastPaymentDate)}</p>
              {typeof s.lastPaymentAmount === "number" && (
                <p className="num text-[11px] text-muted">
                  +{formatLkrPrice(s.lastPaymentAmount)}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="View payment ledger"
                title="View payment ledger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerStudentId(s.id);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {s.outstanding > 0 ? (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPayModal({
                      open: true,
                      studentId: s.id,
                      summary: {
                        id: s.id,
                        fullName: s.fullName,
                        feeTotal: s.feeTotal,
                        paidTotal: s.paidTotal,
                        outstanding: s.outstanding,
                      },
                    });
                  }}
                >
                  Collect
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const historyCols = useMemo<Columns<PaymentItem>>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: (c) => (
          <span className="whitespace-nowrap text-sm">
            {formatShortDate(c.getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "receiptNo",
        header: "Receipt No",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="num text-xs font-semibold">{row.original.receiptNo}</p>
            <p className="num text-[10px] text-muted">{row.original.id}</p>
          </div>
        ),
      },
      {
        id: "student",
        header: "Student",
        cell: ({ row }) => {
          const p = row.original;
          const name = p.student?.fullName;
          const sid = p.studentId || p.student?.id;

          if (name) {
            return (
              <button
                type="button"
                onClick={() => sid && setDrawerStudentId(sid)}
                className="flex cursor-pointer items-center gap-2 text-left hover:underline"
              >
                <Avatar name={name} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="num text-[11px] text-muted">
                    {sid}
                    {p.student?.batch ? ` · ${p.student.batch}` : ""}
                  </p>
                </div>
              </button>
            );
          }
          if (!sid) return <span className="text-muted">—</span>;
          return (
            <button
              type="button"
              onClick={() => setDrawerStudentId(sid)}
              className="flex cursor-pointer items-center gap-2 text-left hover:underline"
            >
              <Avatar name={sid} size="sm" />
              <span className="num text-sm font-semibold">{sid}</span>
            </button>
          );
        },
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ row }) => (
          <div>
            <Badge tone="neutral">{row.original.method || "Cash"}</Badge>
            {row.original.description && (
              <p className="mt-1 line-clamp-1 max-w-[180px] text-[11px] text-muted">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (c) => <ReceiptStatusBadge status={c.getValue() as PaymentRecordStatus} />,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <span
              className={cn(
                "num text-sm font-bold",
                row.original.status === "completed"
                  ? "text-emerald-500"
                  : "text-muted line-through",
              )}
            >
              +{formatLkrPrice(row.original.amount)}
            </span>
            {row.original.discount > 0 && (
              <p className="num text-[10px] text-muted">
                Disc: {formatLkrPrice(row.original.discount)}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Download receipt"
                title="Download PDF receipt"
                onClick={() => {
                  downloadPaymentReceiptPdf({
                    payment: p,
                    instituteName: config?.instituteName,
                  });
                  toast.success(`Receipt ${p.receiptNo} downloaded`);
                }}
              >
                <FileDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit payment"
                onClick={() => setEditPaymentItem(p)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete payment"
                className="hover:text-rose-500"
                onClick={() => setDelPaymentItem(p)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [toast],
  );

  const kpiCards = [
    {
      label: "Tuition collected",
      value: formatLkrPrice(globalSummary.totalCollected),
      sub: "Total paid across active students",
      icon: Wallet,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "Total outstanding",
      value: formatLkrPrice(globalSummary.totalOutstanding),
      sub: "Pending tuition balance",
      icon: Banknote,
      color: "from-rose-500 to-pink-500",
    },
    {
      label: "Students owing",
      value: String(globalSummary.debtorCount),
      sub: "Unpaid or partial fees",
      icon: Users,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Fully settled",
      value: String(globalSummary.settledCount),
      sub: `Out of ${globalSummary.totalStudents} students`,
      icon: CheckCircle2,
      color: "from-indigo-500 to-violet-500",
    },
  ];

  return (
    <>
      <PageHeader
        title="Student Payments"
        description="Collect tuition fees, monitor paid and unpaid students, and download official payment receipts."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void exportXlsx()}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
            <Button onClick={() => setPayModal({ open: true })}>
              <CreditCard className="h-4 w-4" /> Record payment
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((c) => (
          <Card key={c.label} className="relative overflow-hidden p-5">
            <div
              className={`absolute -right-5 -top-5 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 ${c.color}`}
            />
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${c.color}`}
            >
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-muted">{c.label}</p>
            {kpiLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <>
                <p className="num mt-1 text-xl font-bold sm:text-2xl">{c.value}</p>
                <p className="mt-1 text-[11px] text-muted">{c.sub}</p>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { id: "students", label: "Student Fee Status" },
          { id: "history", label: "Payment History & Receipts" },
        ]}
      />

      {/* Tab 1: Student Fee Status */}
      {tab === "students" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name, ID, or email…"
                  className="pl-9"
                />
              </div>

              <div className="w-44">
                <Select
                  value={batchFilter}
                  onChange={(e) => {
                    setBatchFilter(e.target.value);
                    setStudentsPage(1);
                  }}
                  aria-label="Filter by batch"
                >
                  <option value="all">All batches</option>
                  {batchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-44">
                <Select
                  value={paymentStatusFilter}
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value);
                    setStudentsPage(1);
                  }}
                  aria-label="Filter by payment status"
                >
                  <option value="all">All payment statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>

              <div className="w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setStudentsPage(1);
                  }}
                  aria-label="Filter by student status"
                >
                  <option value="all">All student statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Student Fee Status"
              subtitle={`${studentsPagination.total} students matching filters · click any row to view full payment ledger`}
              className="pb-4"
            />
            <DataTable
              data={studentsList}
              columns={studentCols}
              pageSize={10}
              manualPagination
              pageIndex={studentsPage - 1}
              total={studentsPagination.total}
              totalPages={studentsPagination.totalPages}
              onPaginationChange={(p) => setStudentsPage(p.pageIndex + 1)}
              onRowClick={(row) => setDrawerStudentId(row.id)}
              loading={studentsLoading}
              error={studentsError}
              onRetry={triggerRefresh}
              emptyTitle="No student payment records found"
              emptyText="Try adjusting your search or filter dropdowns."
            />
          </Card>
        </div>
      )}

      {/* Tab 2: Payment History & Receipts */}
      {tab === "history" && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeriodFilter state={period} />
              <p className="text-xs text-muted">
                {formatShortDate(period.range.from)} – {formatShortDate(period.range.to)} ·{" "}
                <b className="num text-ink">{historySummary.totalCount}</b> receipts ·{" "}
                <b className="num text-emerald-500">{formatLkrPrice(historySummary.totalCollected)}</b>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search receipt no, payment ID, student name or ID…"
                  className="pl-9"
                />
              </div>

              <div className="w-44">
                <Select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  aria-label="Filter by payment method"
                >
                  <option value="all">All methods</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-40">
                <Select
                  value={receiptStatusFilter}
                  onChange={(e) => setReceiptStatusFilter(e.target.value)}
                  aria-label="Filter by receipt status"
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="refunded">Refunded</option>
                  <option value="void">Void</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Payment History & Receipts"
              subtitle="Download official PDF receipts, edit entries, or record a new fee payment"
              action={
                <Button size="sm" onClick={() => setPayModal({ open: true })}>
                  <CreditCard className="h-3.5 w-3.5" /> Record payment
                </Button>
              }
              className="pb-4"
            />
            <DataTable
              data={historyList}
              columns={historyCols}
              pageSize={10}
              manualPagination
              pageIndex={historyPage - 1}
              total={historyPagination.total}
              totalPages={historyPagination.totalPages}
              onPaginationChange={(p) => setHistoryPage(p.pageIndex + 1)}
              loading={historyLoading}
              error={historyError}
              onRetry={triggerRefresh}
              emptyTitle="No payment receipts found"
              emptyText="Try adjusting your date range or filters, or record a new student payment."
            />
          </Card>
        </div>
      )}

      {/* Student Ledger Drawer */}
      <StudentPaymentDrawer
        studentId={drawerStudentId}
        refreshKey={refreshKey}
        onClose={() => setDrawerStudentId(null)}
        onCollect={(summary) =>
          setPayModal({
            open: true,
            studentId: summary.id,
            summary,
          })
        }
        onEditPayment={(p) => setEditPaymentItem(p)}
        onDeletePayment={(p) => setDelPaymentItem(p)}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={payModal.open}
        studentId={payModal.studentId}
        studentSummary={payModal.summary}
        onClose={() => setPayModal({ open: false })}
        onDone={(res) => {
          if (res?.payment) {
            setHistoryList((prev) => [res.payment, ...prev.filter((p) => p.id !== res.payment.id)]);
            setHistoryPagination((prev) => ({ ...prev, total: prev.total + 1 }));
          }
          if (res?.studentSummary) {
            const summary = res.studentSummary;
            setStudentsList((prev) =>
              prev.map((s) =>
                s.id === summary.id
                  ? {
                      ...s,
                      feeTotal: summary.feeTotal,
                      paidTotal: summary.paidTotal,
                      outstanding: summary.outstanding,
                      paymentStatus: summary.paymentStatus,
                    }
                  : s,
              ),
            );
            setGlobalSummary((prev) => ({
              ...prev,
              totalCollected: prev.totalCollected + (res.payment?.amount ?? 0),
              totalOutstanding: Math.max(0, prev.totalOutstanding - (res.payment?.amount ?? 0)),
            }));
          }
          triggerRefresh();
        }}
      />

      {/* Edit Payment Modal (PATCH /api/payments/:id) */}
      <EditPaymentModal
        payment={editPaymentItem}
        onClose={() => setEditPaymentItem(null)}
        onSaved={triggerRefresh}
      />

      {/* Delete Payment Confirmation (DELETE /api/payments/:id) */}
      <ConfirmDialog
        open={Boolean(delPaymentItem)}
        onClose={() => {
          if (!isDeleting) setDelPaymentItem(null);
        }}
        title="Delete payment receipt?"
        text={
          <>
            Receipt <b>{delPaymentItem?.receiptNo}</b> ({formatLkrPrice(delPaymentItem?.amount ?? 0)})
            will be removed from Payments and Finance, and the student’s outstanding balance will
            be recalculated.
          </>
        }
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
