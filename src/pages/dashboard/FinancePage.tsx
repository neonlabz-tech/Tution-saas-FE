import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Banknote, CreditCard, Download, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import type { Transaction, TxType } from "@/types";
import { Avatar, Badge, Button, Card, CardHeader, MockNote, PageHeader, Select, Tabs } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { PeriodFilter, usePeriod } from "@/components/ui/PeriodFilter";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/data/mock";
import { TransactionFormModal } from "@/components/finance/TransactionFormModal";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { COLORS, ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps, moneyTick } from "@/components/analytics/chartParts";
import { financeSeries, groupSum, sumBy } from "@/lib/stats";
import { inRange } from "@/lib/period";
import { cn, fmtDate, fmtLKR } from "@/lib/utils";

type Tab = "overview" | "income" | "expenses" | "payments";

export default function FinancePage() {
  const { transactions, students, outstanding, deleteTransaction, getStudent } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("overview");
  const period = usePeriod("year");
  const [category, setCategory] = useState("all");
  const [form, setForm] = useState<{ open: boolean; type: TxType; item: Transaction | null }>({ open: false, type: "income", item: null });
  const [delId, setDelId] = useState<string | null>(null);
  const [pay, setPay] = useState<{ open: boolean; studentId?: string }>({ open: false });

  useEffect(() => {
    if (params.get("tab") === "payments") setTab("payments");
    if (params.get("pay") === "1") { setPay({ open: true }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const filtered = useMemo(
    () => transactions.filter((t) => inRange(t.date, period.range) && (category === "all" || t.category === category)),
    [transactions, period.range, category],
  );
  const income = useMemo(() => filtered.filter((t) => t.type === "income"), [filtered]);
  const expenses = useMemo(() => filtered.filter((t) => t.type === "expense"), [filtered]);
  const payments = useMemo(() => income.filter((t) => t.studentId && t.category === "Tuition fees"), [income]);
  const totalIncome = sumBy(income, (t) => t.amount);
  const totalExpense = sumBy(expenses, (t) => t.amount);
  const totalOutstanding = sumBy(students.filter((s) => s.status !== "graduated"), (s) => outstanding(s.id));
  const series = useMemo(() => financeSeries(filtered, period.range), [filtered, period.range]);
  const owing = useMemo(() => students.map((s) => ({ s, owed: outstanding(s.id) })).filter((x) => x.owed > 0).sort((a, b) => b.owed - a.owed), [students, outstanding]);

  const openForm = (type: TxType, item: Transaction | null = null) => setForm({ open: true, type, item });

  const cols = (type: TxType): Columns<Transaction> => [
    { accessorKey: "date", header: "Date", cell: (c) => <span className="whitespace-nowrap text-sm">{fmtDate(c.getValue() as string)}</span> },
    { accessorKey: "category", header: "Category", cell: (c) => <Badge tone={type === "income" ? "teal" : "amber"}>{c.getValue() as string}</Badge> },
    { accessorKey: "description", header: "Description", cell: (c) => <span className="line-clamp-1 max-w-[280px] text-sm">{c.getValue() as string}</span> },
    { accessorKey: "method", header: "Method", cell: (c) => <span className="text-xs text-muted">{(c.getValue() as string) ?? "—"}</span> },
    { accessorKey: "amount", header: "Amount", cell: (c) => <span className={cn("num whitespace-nowrap text-sm font-bold", type === "income" ? "text-emerald-500" : "text-rose-500")}>{type === "income" ? "+" : "−"}{fmtLKR(c.getValue() as number)}</span> },
    {
      id: "actions", header: "", enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openForm(type, row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];
  const incomeCols = useMemo(() => cols("income"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const expenseCols = useMemo(() => cols("expense"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const payCols = useMemo<Columns<Transaction>>(
    () => [
      { accessorKey: "date", header: "Date", cell: (c) => <span className="whitespace-nowrap text-sm">{fmtDate(c.getValue() as string)}</span> },
      { id: "student", header: "Student", accessorFn: (t) => getStudent(t.studentId ?? "")?.fullName ?? "", cell: ({ row }) => { const s = getStudent(row.original.studentId ?? ""); return s ? <div className="flex items-center gap-2"><Avatar name={s.fullName} size="sm" /><div><p className="text-sm font-semibold">{s.fullName}</p><p className="num text-[11px] text-muted">{s.id}</p></div></div> : <span className="text-muted">—</span>; } },
      { accessorKey: "method", header: "Method", cell: (c) => <span className="text-xs text-muted">{(c.getValue() as string) ?? "—"}</span> },
      { accessorKey: "amount", header: "Amount", cell: (c) => <span className="num text-sm font-bold text-emerald-500">+{fmtLKR(c.getValue() as number)}</span> },
      { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openForm("income", row.original)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(row.original.id)}><Trash2 className="h-4 w-4" /></Button></div> },
    ],
    [getStudent], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exportXlsx = () => {
    const src = tab === "income" ? income : tab === "expenses" ? expenses : tab === "payments" ? payments : filtered;
    if (!src.length) return toast.error("No transactions match the current filters");
    const rows = src.map((t) => ({ Date: t.date, Type: t.type, Category: t.category, Description: t.description, "Student ID": t.studentId ?? "", Method: t.method ?? "", "Amount (LKR)": t.type === "expense" ? -t.amount : t.amount }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transactions");
    const si = sumBy(src.filter((t) => t.type === "income"), (t) => t.amount);
    const se = sumBy(src.filter((t) => t.type === "expense"), (t) => t.amount);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Period: `${period.range.from} to ${period.range.to}`, Category: category, "Total income": si, "Total expenses": se, "Net balance": si - se }]), "Summary");
    XLSX.writeFile(wb, `eduflow_${tab}_${period.range.from}_${period.range.to}.xlsx`);
    toast.success(`Exported ${rows.length} transactions to Excel`);
  };

  const cards = [
    { l: "Total income", v: fmtLKR(totalIncome), i: ArrowUpRight, c: "from-emerald-500 to-teal-500" },
    { l: "Total expenses", v: fmtLKR(totalExpense), i: ArrowDownRight, c: "from-rose-500 to-pink-500" },
    { l: "Net balance", v: fmtLKR(totalIncome - totalExpense), i: Scale, c: totalIncome >= totalExpense ? "from-indigo-500 to-violet-500" : "from-orange-500 to-red-500" },
    { l: "Outstanding payments", v: fmtLKR(totalOutstanding), i: Banknote, c: "from-amber-500 to-orange-500" },
  ];
  const delTx = delId ? transactions.find((t) => t.id === delId) : undefined;
  const donut = (list: Transaction[]) => groupSum(list);

  return (
    <>
      <PageHeader
        title="Income & Expenses"
        description="Track the institute's cash flow, student payments and outstanding fees."
        actions={
          <>
            <Button variant="secondary" onClick={exportXlsx}><Download className="h-4 w-4" /> Export Excel</Button>
            <Button variant="soft" onClick={() => openForm("expense")}><Plus className="h-4 w-4" /> Expense</Button>
            <Button onClick={() => openForm("income")}><Plus className="h-4 w-4" /> Income</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.l} className="relative overflow-hidden p-5">
            <div className={`absolute -right-5 -top-5 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 ${c.c}`} />
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${c.c}`}><c.i className="h-5 w-5" /></div>
            <p className="text-xs font-medium text-muted">{c.l}</p>
            <p className="num mt-1 text-xl font-bold sm:text-2xl">{c.v}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter state={period} />
          <div className="w-52">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
              <option value="all">All categories</option>
              <optgroup label="Income">{INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
              <optgroup label="Expenses">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted">{fmtDate(period.range.from)} – {fmtDate(period.range.to)} · <b className="num text-ink">{filtered.length}</b> transactions</p>
      </Card>

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[{ id: "overview", label: "Overview" }, { id: "income", label: "Income" }, { id: "expenses", label: "Expenses" }, { id: "payments", label: "Student Payments" }]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Income vs expenses" subtitle="Net balance shown as line" action={<ChartLegend items={[{ label: "Income", color: "#14B8A6" }, { label: "Expenses", color: "#F43F5E" }, { label: "Net", color: "#4F46E5" }]} />} />
            <div className="h-72 p-4 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
                  <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                  <Bar dataKey="income" name="Income" fill="#14B8A6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Expenses" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Line dataKey="net" name="Net" type="monotone" stroke="#4F46E5" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            {([["Income by category", donut(income)], ["Expenses by category", donut(expenses)]] as const).map(([title, data]) => (
              <Card key={title}>
                <CardHeader title={title} />
                <div className="flex flex-col items-center gap-4 p-5 sm:flex-row">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3} stroke="none">{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip money />} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full space-y-2">
                    {data.length === 0 && <li className="text-sm text-muted">No data</li>}
                    {data.map((d, i) => (
                      <li key={d.name} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</span><span className="num text-xs font-semibold">{fmtLKR(d.value)}</span></li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title="Latest transactions" className="pb-4" />
            <DataTable data={filtered} columns={[...cols("income").slice(0, 4), { accessorKey: "type", header: "Type", cell: (c) => <Badge tone={c.getValue() === "income" ? "green" : "rose"}>{c.getValue() as string}</Badge> }, { accessorKey: "amount", header: "Amount", cell: ({ row }) => <span className={cn("num whitespace-nowrap text-sm font-bold", row.original.type === "income" ? "text-emerald-500" : "text-rose-500")}>{row.original.type === "income" ? "+" : "−"}{fmtLKR(row.original.amount)}</span> }]} pageSize={8} />
          </Card>
        </div>
      )}

      {tab === "income" && <Card><CardHeader title="Income" subtitle={`${income.length} entries · ${fmtLKR(totalIncome)}`} action={<Button size="sm" onClick={() => openForm("income")}><Plus className="h-3.5 w-3.5" /> Add income</Button>} className="pb-4" /><DataTable data={income} columns={incomeCols} pageSize={10} emptyTitle="No income recorded" /></Card>}
      {tab === "expenses" && <Card><CardHeader title="Expenses" subtitle={`${expenses.length} entries · ${fmtLKR(totalExpense)}`} action={<Button size="sm" onClick={() => openForm("expense")}><Plus className="h-3.5 w-3.5" /> Add expense</Button>} className="pb-4" /><DataTable data={expenses} columns={expenseCols} pageSize={10} emptyTitle="No expenses recorded" /></Card>}

      {tab === "payments" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Payment history" subtitle={`${payments.length} student payments · ${fmtLKR(sumBy(payments, (t) => t.amount))}`} action={<Button size="sm" onClick={() => setPay({ open: true })}><CreditCard className="h-3.5 w-3.5" /> Record payment</Button>} className="pb-4" />
            <DataTable data={payments} columns={payCols} pageSize={8} emptyTitle="No student payments in this period" />
          </Card>
          <Card>
            <CardHeader title="Outstanding balances" subtitle={`${owing.length} students owe ${fmtLKR(sumBy(owing, (x) => x.owed))}`} />
            <div className="max-h-[520px] divide-y divide-line/70 overflow-y-auto p-2">
              {owing.slice(0, 20).map(({ s, owed }) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                  <Avatar name={s.fullName} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.fullName}</p><p className="num text-xs font-semibold text-rose-500">{fmtLKR(owed)}</p></div>
                  <Button size="sm" variant="soft" onClick={() => setPay({ open: true, studentId: s.id })}>Collect</Button>
                </div>
              ))}
            </div>
            <div className="p-4 pt-0"><MockNote>Partial payments are supported. All entries are demo data — no payment gateway is connected.</MockNote></div>
          </Card>
        </div>
      )}

      <TransactionFormModal open={form.open} type={form.type} item={form.item} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      <RecordPaymentModal open={pay.open} studentId={pay.studentId} onClose={() => setPay({ open: false })} />
      <ConfirmDialog
        open={!!delTx}
        onClose={() => setDelId(null)}
        title="Delete transaction?"
        text={<>“{delTx?.description}” ({fmtLKR(delTx?.amount ?? 0)}) will be removed from the ledger and balances recalculated.</>}
        onConfirm={() => { if (delId) { deleteTransaction(delId); toast.success("Transaction deleted"); } }}
      />
    </>
  );
}
