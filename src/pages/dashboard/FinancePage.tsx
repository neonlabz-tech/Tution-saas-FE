import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import type {
  FinanceChartsResponse,
  FinanceKpis,
  PaginationMeta,
  StudentPaymentStatus,
  StudentPaymentSummary,
  StudentStatus,
  Transaction,
  TxType,
} from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  Switch,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { PeriodFilter, usePeriod } from "@/components/ui/PeriodFilter";
import { useToast } from "@/components/ui/toast";
import {
  deleteTransaction,
  getFinanceCharts,
  getFinanceKpis,
  listStudentPayments,
  listTransactions,
} from "@/api/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { useBatches } from "@/hooks/useBatches";
import { TransactionFormModal } from "@/components/finance/TransactionFormModal";
import { RecordPaymentModal, type PaymentStudentSummary } from "@/components/finance/RecordPaymentModal";
import {
  COLORS,
  ChartLegend,
  ChartTooltip,
  axisTick,
  cursorStyle,
  gridProps,
  moneyTick,
} from "@/components/analytics/chartParts";
import { cn, formatLkrPrice, formatShortDate } from "@/lib/utils";

type Tab = "overview" | "income" | "expenses" | "payments";

function PaymentStatusBadge({ status }: { status?: StudentPaymentStatus }) {
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "partial") return <Badge tone="amber">Partial</Badge>;
  if (status === "unpaid") return <Badge tone="rose">Unpaid</Badge>;
  return null;
}

export default function FinancePage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("overview");
  const period = usePeriod("year");
  const [category, setCategory] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const { batches: batchOptions } = useBatches();

  // Form modals state
  const [form, setForm] = useState<{
    open: boolean;
    type: TxType;
    item: Transaction | null;
  }>({ open: false, type: "income", item: null });
  const [delTx, setDelTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pay, setPay] = useState<{
    open: boolean;
    studentId?: string;
    summary?: PaymentStudentSummary;
  }>({ open: false });
  const [exporting, setExporting] = useState(false);

  // KPIs & Charts state
  const [kpis, setKpis] = useState<FinanceKpis>({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    totalOutstanding: 0,
    totalCount: 0,
  });
  const [kpisLoading, setKpisLoading] = useState(true);
  const [charts, setCharts] = useState<FinanceChartsResponse>({
    period: { period: "year", from: "", to: "" },
    granularity: "monthly",
    series: [],
    incomeByCategory: [],
    expenseByCategory: [],
  });
  const [chartsLoading, setChartsLoading] = useState(true);

  // Transactions tables state
  const [overviewList, setOverviewList] = useState<Transaction[]>([]);
  const [overviewPagination, setOverviewPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 8,
    totalPages: 1,
  });
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [incomeList, setIncomeList] = useState<Transaction[]>([]);
  const [incomePagination, setIncomePagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [incomePage, setIncomePage] = useState(1);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  const [expenseList, setExpenseList] = useState<Transaction[]>([]);
  const [expensePagination, setExpensePagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [expensePage, setExpensePage] = useState(1);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Payment History state
  const [historyList, setHistoryList] = useState<Transaction[]>([]);
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 8,
    totalPages: 1,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Student Payments / Debtors state
  const [debtorsList, setDebtorsList] = useState<StudentPaymentSummary[]>([]);
  const [debtorsSummary, setDebtorsSummary] = useState({
    debtorCount: 0,
    totalOutstanding: 0,
  });
  const [debtorsPagination, setDebtorsPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [debtorsPage, setDebtorsPage] = useState(1);
  const [debtorsLoading, setDebtorsLoading] = useState(false);
  const [debtorsError, setDebtorsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debtorsOnly, setDebtorsOnly] = useState(true);
  const [includeGraduated, setIncludeGraduated] = useState(false);

  // URL params initialization
  useEffect(() => {
    if (params.get("tab") === "payments") setTab("payments");
    if (params.get("pay") === "1") {
      setPay({ open: true });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(searchQuery.trim());
      setDebtorsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setOverviewPage(1);
    setIncomePage(1);
    setExpensePage(1);
    setHistoryPage(1);
  }, [period.period, period.range.from, period.range.to, category]);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  // 1. Fetch KPIs & Charts
  useEffect(() => {
    const controller = new AbortController();
    setKpisLoading(true);
    setChartsLoading(true);

    getFinanceKpis(
      {
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category,
      },
      controller.signal,
    )
      .then((res) => {
        setKpis(res.kpis);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setKpisLoading(false);
      });

    getFinanceCharts(
      {
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category,
      },
      controller.signal,
    )
      .then((res) => {
        setCharts(res);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setChartsLoading(false);
      });

    return () => controller.abort();
  }, [period.period, period.range.from, period.range.to, category, refreshKey]);

  // 2. Fetch Overview transactions
  useEffect(() => {
    if (tab !== "overview") return;
    const controller = new AbortController();
    setOverviewLoading(true);
    setOverviewError(null);

    listTransactions(
      {
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category,
        page: overviewPage,
        limit: 8,
      },
      controller.signal,
    )
      .then((res) => {
        setOverviewList(res.items);
        setOverviewPagination(res.pagination);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOverviewError(err instanceof Error ? err.message : "Failed to load transactions");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [tab, period.period, period.range.from, period.range.to, category, overviewPage, refreshKey]);

  // 3. Fetch Income transactions
  useEffect(() => {
    if (tab !== "income") return;
    const controller = new AbortController();
    setIncomeLoading(true);
    setIncomeError(null);

    listTransactions(
      {
        type: "income",
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category,
        page: incomePage,
        limit: 10,
      },
      controller.signal,
    )
      .then((res) => {
        setIncomeList(res.items);
        setIncomePagination(res.pagination);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setIncomeError(err instanceof Error ? err.message : "Failed to load income");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIncomeLoading(false);
      });

    return () => controller.abort();
  }, [tab, period.period, period.range.from, period.range.to, category, incomePage, refreshKey]);

  // 4. Fetch Expenses transactions
  useEffect(() => {
    if (tab !== "expenses") return;
    const controller = new AbortController();
    setExpenseLoading(true);
    setExpenseError(null);

    listTransactions(
      {
        type: "expense",
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category,
        page: expensePage,
        limit: 10,
      },
      controller.signal,
    )
      .then((res) => {
        setExpenseList(res.items);
        setExpensePagination(res.pagination);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setExpenseError(err instanceof Error ? err.message : "Failed to load expenses");
      })
      .finally(() => {
        if (!controller.signal.aborted) setExpenseLoading(false);
      });

    return () => controller.abort();
  }, [tab, period.period, period.range.from, period.range.to, category, expensePage, refreshKey]);

  // 5. Fetch Payment history transactions
  useEffect(() => {
    if (tab !== "payments") return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);

    listTransactions(
      {
        type: "income",
        category: "Tuition fees",
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        page: historyPage,
        limit: 8,
      },
      controller.signal,
    )
      .then((res) => {
        setHistoryList(res.items);
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
  }, [tab, period.period, period.range.from, period.range.to, historyPage, refreshKey]);

  // 6. Fetch Student Payments / Debtors
  useEffect(() => {
    if (tab !== "payments") return;
    const controller = new AbortController();
    setDebtorsLoading(true);
    setDebtorsError(null);

    listStudentPayments(
      {
        q: debouncedQ || undefined,
        batch: batchFilter !== "all" ? batchFilter : undefined,
        status: statusFilter !== "all" ? (statusFilter as StudentStatus) : undefined,
        debtorsOnly,
        includeGraduated,
        page: debtorsPage,
        limit: 10,
      },
      controller.signal,
    )
      .then((res) => {
        setDebtorsList(res.items);
        setDebtorsPagination(res.pagination);
        setDebtorsSummary(res.summary);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDebtorsError(err instanceof Error ? err.message : "Failed to load debtors");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDebtorsLoading(false);
      });

    return () => controller.abort();
  }, [
    tab,
    debouncedQ,
    batchFilter,
    statusFilter,
    debtorsOnly,
    includeGraduated,
    debtorsPage,
    refreshKey,
  ]);

  const openForm = (type: TxType, item: Transaction | null = null) =>
    setForm({ open: true, type, item });

  const handleDelete = async () => {
    if (!delTx) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(delTx.id);
      toast.success("Transaction deleted");
      setDelTx(null);

      // Step back page if last item deleted
      if (tab === "overview" && overviewList.length <= 1 && overviewPage > 1) {
        setOverviewPage((p) => p - 1);
      } else if (tab === "income" && incomeList.length <= 1 && incomePage > 1) {
        setIncomePage((p) => p - 1);
      } else if (tab === "expenses" && expenseList.length <= 1 && expensePage > 1) {
        setExpensePage((p) => p - 1);
      } else if (tab === "payments" && historyList.length <= 1 && historyPage > 1) {
        setHistoryPage((p) => p - 1);
      }
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setIsDeleting(false);
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const typeFilter =
        tab === "income" ? "income" : tab === "expenses" ? "expense" : undefined;
      const catFilter = tab === "payments" ? "Tuition fees" : category;

      const firstPage = await listTransactions({
        period: period.period,
        from: period.range.from,
        to: period.range.to,
        category: catFilter,
        type: typeFilter,
        page: 1,
        limit: 200,
      });

      const allItems = [...firstPage.items];
      const totalPages = firstPage.pagination.totalPages;
      if (totalPages > 1) {
        for (let p = 2; p <= Math.min(totalPages, 10); p++) {
          const next = await listTransactions({
            period: period.period,
            from: period.range.from,
            to: period.range.to,
            category: catFilter,
            type: typeFilter,
            page: p,
            limit: 200,
          });
          allItems.push(...next.items);
        }
      }

      if (!allItems.length) {
        toast.error("No transactions match the current filters");
        return;
      }

      const rows = allItems.map((t) => ({
        Date: t.date,
        Type: t.type,
        Category: t.category,
        Description: t.description,
        "Student ID": t.studentId ?? "",
        Method: t.method ?? "",
        "Amount (LKR)": t.type === "expense" ? -t.amount : t.amount,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transactions");
      const si = allItems
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const se = allItems
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([
          {
            Period: `${period.range.from} to ${period.range.to}`,
            Category: catFilter,
            "Total income": si,
            "Total expenses": se,
            "Net balance": si - se,
          },
        ]),
        "Summary",
      );
      XLSX.writeFile(wb, `eduflow_${tab}_${period.range.from}_${period.range.to}.xlsx`);
      toast.success(`Exported ${rows.length} transactions to Excel`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export Excel");
    } finally {
      setExporting(false);
    }
  };

  const cols = (type: TxType): Columns<Transaction> => [
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
      accessorKey: "category",
      header: "Category",
      cell: (c) => (
        <Badge tone={type === "income" ? "teal" : "amber"}>
          {c.getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (c) => (
        <span className="line-clamp-1 max-w-[280px] text-sm">
          {c.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: (c) => (
        <span className="text-xs text-muted">
          {(c.getValue() as string) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (c) => (
        <span
          className={cn(
            "num whitespace-nowrap text-sm font-bold",
            type === "income" ? "text-emerald-500" : "text-rose-500",
          )}
        >
          {type === "income" ? "+" : "−"}
          {formatLkrPrice(c.getValue() as number)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit"
            onClick={() => openForm(type, row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            className="hover:text-rose-500"
            onClick={() => setDelTx(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const incomeCols = useMemo(() => cols("income"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const expenseCols = useMemo(() => cols("expense"), []); // eslint-disable-line react-hooks/exhaustive-deps

  const payCols = useMemo<Columns<Transaction>>(
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
        id: "student",
        header: "Student",
        cell: ({ row }) => {
          const s = row.original.student;
          const sid = row.original.studentId;
          if (s?.fullName) {
            return (
              <div className="flex items-center gap-2">
                <Avatar name={s.fullName} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{s.fullName}</p>
                  <p className="num text-[11px] text-muted">{sid || s.id}</p>
                </div>
              </div>
            );
          }
          if (sid) {
            return (
              <div className="flex items-center gap-2">
                <Avatar name={sid} size="sm" />
                <span className="num text-sm font-semibold">{sid}</span>
              </div>
            );
          }
          return <span className="text-muted">—</span>;
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: (c) => (
          <span className="line-clamp-1 max-w-[200px] text-sm">
            {(c.getValue() as string) || "Tuition fee"}
          </span>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: (c) => (
          <span className="text-xs text-muted">
            {(c.getValue() as string) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: (c) => (
          <span className="num text-sm font-bold text-emerald-500">
            +{formatLkrPrice(c.getValue() as number)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => openForm("income", row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              className="hover:text-rose-500"
              onClick={() => setDelTx(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const overviewCols = useMemo<Columns<Transaction>>(
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
        accessorKey: "type",
        header: "Type",
        cell: (c) => (
          <Badge tone={c.getValue() === "income" ? "green" : "rose"}>
            {c.getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge tone={row.original.type === "income" ? "teal" : "amber"}>
            {row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: (c) => (
          <span className="line-clamp-1 max-w-[280px] text-sm">
            {c.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: (c) => (
          <span className="text-xs text-muted">
            {(c.getValue() as string) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span
            className={cn(
              "num whitespace-nowrap text-sm font-bold",
              row.original.type === "income" ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {row.original.type === "income" ? "+" : "−"}
            {formatLkrPrice(row.original.amount)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => openForm(row.original.type, row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              className="hover:text-rose-500"
              onClick={() => setDelTx(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cards = [
    {
      l: "Total income",
      v: formatLkrPrice(kpis.totalIncome),
      i: ArrowUpRight,
      c: "from-emerald-500 to-teal-500",
    },
    {
      l: "Total expenses",
      v: formatLkrPrice(kpis.totalExpense),
      i: ArrowDownRight,
      c: "from-rose-500 to-pink-500",
    },
    {
      l: "Net balance",
      v: formatLkrPrice(kpis.netBalance),
      i: Scale,
      c:
        kpis.netBalance >= 0
          ? "from-indigo-500 to-violet-500"
          : "from-orange-500 to-red-500",
    },
    {
      l: "Outstanding payments",
      v: formatLkrPrice(kpis.totalOutstanding),
      i: Banknote,
      c: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <>
      <PageHeader
        title="Income & Expenses"
        description="Track the institute's cash flow, student payments and outstanding fees."
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
            <Button variant="soft" onClick={() => openForm("expense")}>
              <Plus className="h-4 w-4" /> Expense
            </Button>
            <Button onClick={() => openForm("income")}>
              <Plus className="h-4 w-4" /> Income
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.l} className="relative overflow-hidden p-5">
            <div
              className={`absolute -right-5 -top-5 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 ${c.c}`}
            />
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${c.c}`}
            >
              <c.i className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-muted">{c.l}</p>
            {kpisLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <p className="num mt-1 text-xl font-bold sm:text-2xl">{c.v}</p>
            )}
          </Card>
        ))}
      </div>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter state={period} />
          <div className="w-52">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category filter"
            >
              <option value="all">All categories</option>
              <optgroup label="Income">
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </optgroup>
              <optgroup label="Expenses">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </optgroup>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted">
          {formatShortDate(period.range.from)} – {formatShortDate(period.range.to)} ·{" "}
          <b className="num text-ink">
            {kpisLoading ? "…" : kpis.totalCount}
          </b>{" "}
          transactions
        </p>
      </Card>

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: "Overview" },
          { id: "income", label: "Income" },
          { id: "expenses", label: "Expenses" },
          { id: "payments", label: "Student Payments" },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Income vs expenses"
              subtitle="Net balance shown as line"
              action={
                <ChartLegend
                  items={[
                    { label: "Income", color: "#7D41AB" },
                    { label: "Expenses", color: "#4D1882" },
                    { label: "Net", color: "#A771CF" },
                  ]}
                />
              }
            />
            {chartsLoading ? (
              <div className="p-4 pt-2">
                <Skeleton className="h-72 w-full rounded-2xl" />
              </div>
            ) : charts.series.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted">
                No financial data in this period
              </div>
            ) : (
              <div className="h-72 p-4 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={charts.series}
                    margin={{ left: -8, right: 8, top: 8 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      dataKey="label"
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={moneyTick}
                    />
                    <Tooltip content={<ChartTooltip money />} cursor={cursorStyle} />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#7D41AB"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expenses"
                      fill="#4D1882"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      dataKey="net"
                      name="Net"
                      type="monotone"
                      stroke="#A771CF"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {([
              ["Income by category", charts.incomeByCategory],
              ["Expenses by category", charts.expenseByCategory],
            ] as const).map(([title, data]) => (
              <Card key={title}>
                <CardHeader title={title} />
                {chartsLoading ? (
                  <div className="flex items-center gap-4 p-5">
                    <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
                    <div className="w-full space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 p-5 sm:flex-row">
                    <div className="h-44 w-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={80}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {data.map((_, i) => (
                              <Cell
                                key={i}
                                fill={COLORS[i % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip money />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="w-full space-y-2">
                      {data.length === 0 && (
                        <li className="text-sm text-muted">No data</li>
                      )}
                      {data.map((d, i) => (
                        <li
                          key={d.name}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {d.name}
                          </span>
                          <span className="num text-xs font-semibold">
                            {formatLkrPrice(d.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Latest transactions" className="pb-4" />
            <DataTable
              data={overviewList}
              columns={overviewCols}
              pageSize={8}
              manualPagination
              pageIndex={overviewPage - 1}
              total={overviewPagination.total}
              totalPages={overviewPagination.totalPages}
              onPaginationChange={(p) => setOverviewPage(p.pageIndex + 1)}
              loading={overviewLoading}
              error={overviewError}
              onRetry={triggerRefresh}
              emptyTitle="No transactions found"
            />
          </Card>
        </div>
      )}

      {tab === "income" && (
        <Card>
          <CardHeader
            title="Income"
            subtitle={`${incomePagination.total} entries · ${formatLkrPrice(kpis.totalIncome)}`}
            action={
              <Button size="sm" onClick={() => openForm("income")}>
                <Plus className="h-3.5 w-3.5" /> Add income
              </Button>
            }
            className="pb-4"
          />
          <DataTable
            data={incomeList}
            columns={incomeCols}
            pageSize={10}
            manualPagination
            pageIndex={incomePage - 1}
            total={incomePagination.total}
            totalPages={incomePagination.totalPages}
            onPaginationChange={(p) => setIncomePage(p.pageIndex + 1)}
            loading={incomeLoading}
            error={incomeError}
            onRetry={triggerRefresh}
            emptyTitle="No income recorded"
          />
        </Card>
      )}

      {tab === "expenses" && (
        <Card>
          <CardHeader
            title="Expenses"
            subtitle={`${expensePagination.total} entries · ${formatLkrPrice(kpis.totalExpense)}`}
            action={
              <Button size="sm" onClick={() => openForm("expense")}>
                <Plus className="h-3.5 w-3.5" /> Add expense
              </Button>
            }
            className="pb-4"
          />
          <DataTable
            data={expenseList}
            columns={expenseCols}
            pageSize={10}
            manualPagination
            pageIndex={expensePage - 1}
            total={expensePagination.total}
            totalPages={expensePagination.totalPages}
            onPaginationChange={(p) => setExpensePage(p.pageIndex + 1)}
            loading={expenseLoading}
            error={expenseError}
            onRetry={triggerRefresh}
            emptyTitle="No expenses recorded"
          />
        </Card>
      )}

      {tab === "payments" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Payment history"
              subtitle={`${historyPagination.total} student payments recorded`}
              action={
                <Button size="sm" onClick={() => setPay({ open: true })}>
                  <CreditCard className="h-3.5 w-3.5" /> Record payment
                </Button>
              }
              className="pb-4"
            />
            <DataTable
              data={historyList}
              columns={payCols}
              pageSize={8}
              manualPagination
              pageIndex={historyPage - 1}
              total={historyPagination.total}
              totalPages={historyPagination.totalPages}
              onPaginationChange={(p) => setHistoryPage(p.pageIndex + 1)}
              loading={historyLoading}
              error={historyError}
              onRetry={triggerRefresh}
              emptyTitle="No student payments in this period"
            />
          </Card>

          <Card>
            <CardHeader
              title="Outstanding balances"
              subtitle={
                debtorsLoading
                  ? "Loading balances…"
                  : `${debtorsSummary.debtorCount} students owe ${formatLkrPrice(debtorsSummary.totalOutstanding)}`
              }
            />
            <div className="space-y-3 p-4 pt-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or ID…"
                  className="pl-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={batchFilter}
                  onChange={(e) => {
                    setBatchFilter(e.target.value);
                    setDebtorsPage(1);
                  }}
                  className="text-xs"
                >
                  <option value="all">All batches</option>
                  {batchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setDebtorsPage(1);
                  }}
                  className="text-xs"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/60 p-2 text-xs">
                <Switch
                  checked={debtorsOnly}
                  onChange={(v) => {
                    setDebtorsOnly(v);
                    setDebtorsPage(1);
                  }}
                  label="Debtors only"
                />
                <Switch
                  checked={includeGraduated}
                  onChange={(v) => {
                    setIncludeGraduated(v);
                    setDebtorsPage(1);
                  }}
                  label="Graduated"
                />
              </div>
            </div>

            <div className="max-h-[500px] divide-y divide-line/70 overflow-y-auto px-4 pb-2">
              {debtorsLoading ? (
                <div className="space-y-3 py-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                      <Skeleton className="h-7 w-16 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : debtorsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  {debtorsError ? (
                    <div className="space-y-2">
                      <p className="text-rose-500">{debtorsError}</p>
                      <Button size="sm" variant="secondary" onClick={triggerRefresh}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    "No students match the criteria."
                  )}
                </div>
              ) : (
                debtorsList.map((item) => (
                  <div key={item.id} className="space-y-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={item.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{item.fullName}</p>
                          <p className="num text-[11px] text-muted">
                            {item.id} · {item.batch}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "num text-xs font-bold",
                            item.outstanding > 0 ? "text-rose-500" : "text-emerald-500",
                          )}
                        >
                          {item.outstanding > 0 ? formatLkrPrice(item.outstanding) : "Settled"}
                        </p>
                        <div className="mt-0.5 flex justify-end gap-1">
                          {item.paymentStatus && (
                            <PaymentStatusBadge status={item.paymentStatus} />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted">
                        <span>Paid: {formatLkrPrice(item.paidTotal)}</span>
                        <span>Total: {formatLkrPrice(item.feeTotal)}</span>
                      </div>
                      <ProgressBar
                        tone="teal"
                        value={item.feeTotal ? (item.paidTotal / item.feeTotal) * 100 : 100}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted">
                        {item.lastPaymentDate
                          ? `Last: ${formatShortDate(item.lastPaymentDate)}`
                          : "No payments yet"}
                      </span>
                      {item.outstanding > 0 && (
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() =>
                            setPay({
                              open: true,
                              studentId: item.id,
                              summary: {
                                id: item.id,
                                fullName: item.fullName,
                                feeTotal: item.feeTotal,
                                paidTotal: item.paidTotal,
                                outstanding: item.outstanding,
                              },
                            })
                          }
                        >
                          Collect
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {debtorsPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs">
                <span className="text-muted">
                  Page {debtorsPage} of {debtorsPagination.totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={debtorsPage <= 1 || debtorsLoading}
                    onClick={() => setDebtorsPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      debtorsPage >= debtorsPagination.totalPages || debtorsLoading
                    }
                    onClick={() => setDebtorsPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <TransactionFormModal
        open={form.open}
        type={form.type}
        item={form.item}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={triggerRefresh}
      />
      <RecordPaymentModal
        open={pay.open}
        studentId={pay.studentId}
        studentSummary={pay.summary}
        onClose={() => setPay({ open: false })}
        onDone={triggerRefresh}
      />
      <ConfirmDialog
        open={!!delTx}
        onClose={() => {
          if (!isDeleting) setDelTx(null);
        }}
        title="Delete transaction?"
        text={
          <>
            “{delTx?.description}” ({formatLkrPrice(delTx?.amount ?? 0)}) will be removed from the ledger and balances recalculated.
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
