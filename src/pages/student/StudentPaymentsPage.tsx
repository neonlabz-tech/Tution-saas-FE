import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, Receipt, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, ProgressBar, SearchInput, Select } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataGate } from "@/components/student/states";
import { DueBadge, PaymentBadge } from "@/components/student/badges";
import { useToast } from "@/components/ui/toast";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentData } from "@/hooks/useStudentData";
import { downloadReceipt } from "@/lib/studentFiles";
import type { StudentPayment } from "@/types/student";
import { fmtDate, fmtLKR } from "@/lib/utils";

export default function StudentPaymentsPage() {
  const { account } = useStudentAuth();
  const { data, loading, error, reload } = useStudentData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.payments ?? []).filter((p) => (status === "all" || p.status === status) && (!s || p.description.toLowerCase().includes(s) || p.receiptNo.toLowerCase().includes(s) || p.method.toLowerCase().includes(s)));
  }, [data, q, status]);

  const columns: Columns<StudentPayment> = useMemo(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="whitespace-nowrap text-xs">{fmtDate(getValue() as string)}</span> },
      { accessorKey: "receiptNo", header: "Receipt no.", cell: ({ getValue }) => <span className="num text-xs text-muted">{getValue() as string}</span> },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row: { original: p } }) => (
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.description}</p>
            <p className="text-[11px] text-muted">{p.category}</p>
          </div>
        ),
      },
      { accessorKey: "method", header: "Method", cell: ({ getValue }) => <span className="whitespace-nowrap text-xs">{getValue() as string}</span> },
      { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="num whitespace-nowrap font-bold">{fmtLKR(getValue() as number)}</span> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <PaymentBadge status={getValue() as StudentPayment["status"]} /> },
      {
        id: "receipt",
        header: "E-receipt",
        enableSorting: false,
        cell: ({ row: { original: p } }) =>
          p.status === "paid" && account && data ? (
            <Button
              size="sm"
              variant="soft"
              aria-label={`Download receipt ${p.receiptNo}`}
              onClick={() => {
                try {
                  downloadReceipt(p, account, data.profile?.id ?? null, data.instituteName);
                  toast.success(`Receipt ${p.receiptNo} downloaded`);
                } catch {
                  toast.error("Could not generate the receipt. Please try again.");
                }
              }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          ) : (
            <span className="text-[11px] text-muted">Available once confirmed</span>
          ),
      },
    ],
    [account, data, toast],
  );

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload}>
      {data && (
        <>
          <PageHeader title="Payments" description="Your full payment history, what's still due, and downloadable e-receipts." />

          {/* Outstanding: prominent */}
          <Card className={`mb-6 overflow-hidden ${data.paymentSummary.overdue > 0 ? "border-rose-500/40" : ""}`}>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className={`p-6 ${data.paymentSummary.outstanding > 0 ? "bg-gradient-to-br from-amber-500/10 to-rose-500/10" : "bg-gradient-to-br from-emerald-500/10 to-teal-500/10"}`}>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  {data.paymentSummary.outstanding > 0 ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  Outstanding balance
                </div>
                <p className="num mt-2 text-4xl font-bold">{fmtLKR(data.paymentSummary.outstanding)}</p>
                {data.paymentSummary.overdue > 0 && <Badge tone="rose" className="mt-2">{fmtLKR(data.paymentSummary.overdue)} overdue</Badge>}
                <ProgressBar className="mt-5" tone={data.paymentSummary.overdue > 0 ? "rose" : "teal"} value={data.paymentSummary.totalFees ? (data.paymentSummary.paid / data.paymentSummary.totalFees) * 100 : 0} />
                <p className="mt-1.5 text-[11px] text-muted">{fmtLKR(data.paymentSummary.paid)} paid of {fmtLKR(data.paymentSummary.totalFees)} total course fees</p>
                {data.paymentSummary.pendingVerification > 0 && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{fmtLKR(data.paymentSummary.pendingVerification)} bank transfer is being verified and isn't deducted yet.</p>
                )}
              </div>
              <div className="p-5">
                <h3 className="mb-3 font-heading text-sm font-bold">Payments due</h3>
                <div className="space-y-2">
                  {data.dues.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.moduleName}</p>
                        <p className="text-[11px] text-muted">Due {fmtDate(d.dueDate)}</p>
                      </div>
                      <span className="num text-sm font-bold">{fmtLKR(d.amount)}</span>
                      <DueBadge status={d.status} />
                    </div>
                  ))}
                  {data.dues.length === 0 && <p className="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">All course fees are settled. Nothing due 🎉</p>}
                </div>
                {data.dues.length > 0 && <p className="mt-3 text-[11px] text-muted">To pay, visit the front desk or transfer to the institute account and upload your slip at the office.</p>}
              </div>
            </div>
          </Card>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} label="Total course fees" value={fmtLKR(data.paymentSummary.totalFees)} icon={Wallet} gradient="from-indigo-500 to-violet-500" color="#6366F1" sub={`${data.modules.length} registered modules`} />
            <StatCard index={1} label="Total paid" value={fmtLKR(data.paymentSummary.paid)} icon={CheckCircle2} gradient="from-teal-500 to-emerald-500" color="#14B8A6" sub={`${data.payments.filter((p) => p.status === "paid").length} confirmed payments`} />
            <StatCard index={2} label="Pending verification" value={fmtLKR(data.paymentSummary.pendingVerification)} icon={Clock3} gradient="from-amber-500 to-orange-500" color="#F59E0B" sub={data.paymentSummary.pendingVerification ? "Awaiting confirmation" : "No pending payments"} />
            <StatCard index={3} label="Overdue" value={fmtLKR(data.paymentSummary.overdue)} icon={AlertTriangle} gradient="from-rose-500 to-pink-500" color="#F43F5E" sub={data.paymentSummary.overdue ? "Please settle soon" : "You're on track"} />
          </div>

          <Card>
            <CardHeader title="Payment history" subtitle={`${data.payments.length} transaction${data.payments.length === 1 ? "" : "s"}`} />
            <div className="grid gap-3 p-5 sm:grid-cols-[1fr_200px]">
              <SearchInput placeholder="Search description, receipt no. or method…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search payments" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </Select>
            </div>
            <DataTable data={rows} columns={columns} pageSize={8} emptyTitle={data.payments.length ? "No payments match" : "No payments yet"} emptyText={data.payments.length ? "Try a different search or status filter." : "Your payments will be listed here once recorded."} />
          </Card>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Receipt className="h-3.5 w-3.5" /> E-receipts are available for every confirmed payment.</p>
        </>
      )}
    </DataGate>
  );
}
