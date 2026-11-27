import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, Clock, Download, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { StatCard } from "@/components/dashboard/StatCard";
import { useToast } from "@/components/ui/toast";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { listSalary, periodLabel } from "@/lib/teacherApi";
import { downloadSalaryReceipt } from "@/lib/teacherFiles";
import { fmtDate, fmtLKR } from "@/lib/utils";
import type { SalaryPayment } from "@/types/teacher";

export default function TeacherPaymentsPage() {
  const { actor, profile, instituteName } = useTeacherPortal();
  const nav = useNavigate();
  const toast = useToast();
  const all = useMemo(() => (actor ? listSalary(actor) : []), [actor]);
  const years = useMemo(() => [...new Set(all.map((p) => p.period.slice(0, 4)))].sort().reverse(), [all]);
  const [year, setYear] = useState<string>(years[0] ?? String(new Date().getFullYear()));
  const inYear = all.filter((p) => p.period.startsWith(year)).sort((a, b) => b.period.localeCompare(a.period));
  const paid = inYear.filter((p) => p.status === "paid");
  const total = paid.reduce((s, p) => s + p.net, 0);
  const pending = inYear.filter((p) => p.status === "pending").reduce((s, p) => s + p.net, 0);
  const receipt = (p: SalaryPayment) => { if (!profile) return; try { downloadSalaryReceipt(p, profile, instituteName); toast.success("Receipt downloaded"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the receipt."); } };

  const columns: Columns<SalaryPayment> = [
    { id: "period", header: "Month", accessorFn: (p) => p.period, cell: ({ row: { original: p } }) => <span className="font-semibold">{periodLabel(p.period)}</span> },
    { accessorKey: "net", header: "Net salary", cell: ({ row: { original: p } }) => <span className="num font-semibold">{fmtLKR(p.net)}</span> },
    { accessorKey: "paymentDate", header: "Paid on", cell: ({ row: { original: p } }) => <span className="text-xs text-muted">{p.paymentDate ? fmtDate(p.paymentDate) : "—"}</span> },
    { accessorKey: "reference", header: "Reference", cell: ({ getValue }) => <span className="num text-xs">{getValue() as string}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row: { original: p } }) => <Badge tone={p.status === "paid" ? "green" : "amber"}>{p.status}</Badge> },
    { id: "actions", header: "", enableSorting: false, cell: ({ row: { original: p } }) => p.status === "paid" ? <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="secondary" onClick={() => receipt(p)} aria-label={`Download receipt for ${periodLabel(p.period)}`}><Download className="h-3.5 w-3.5" /> Receipt</Button></div> : null },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Read-only. Salary is managed by the institute’s administration.</p>
        <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" className="w-32">{(years.length ? years : [year]).map((y) => <option key={y}>{y}</option>)}</Select>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label={`Paid in ${year}`} value={fmtLKR(total)} icon={Wallet} gradient="from-emerald-500 to-teal-500" color="#10b981" index={0} />
        <StatCard label="Monthly average" value={fmtLKR(paid.length ? total / paid.length : 0)} icon={Banknote} gradient="from-indigo-500 to-violet-500" color="#6366f1" sub={`${paid.length} payment${paid.length === 1 ? "" : "s"}`} index={1} />
        <StatCard label="Pending" value={fmtLKR(pending)} icon={Clock} gradient="from-amber-500 to-orange-500" color="#f59e0b" index={2} />
      </div>
      <Card>
        <CardHeader title="Payment history" subtitle={`${inYear.length} month${inYear.length === 1 ? "" : "s"} in ${year}`} />
        <DataTable columns={columns} data={inYear} pageSize={12} onRowClick={(p) => nav(p.id)} emptyTitle="No salary records for this year" />
      </Card>
    </>
  );
}
