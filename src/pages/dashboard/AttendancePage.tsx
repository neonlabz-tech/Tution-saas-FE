import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  ScanLine,
  Trash2,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus, Module, Student } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps } from "@/components/analytics/chartParts";
import { attendanceCounts, attendanceRate, attendanceSeries } from "@/lib/stats";
import {
  attendanceApi,
  type DailyRosterEntry,
  type StudentAttendanceSummary,
  type StudentHistoryResponse,
} from "@/lib/api";
import { addDays, cn, fmtDate, startOfWeek, toISO, todayISO } from "@/lib/utils";

type View = "daily" | "weekly" | "monthly" | "records";
const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const ST_COLOR: Record<AttendanceStatus, string> = {
  present: "#7D41AB",
  late: "#A771CF",
  absent: "#4D1882",
  excused: "#BC99D9",
};
const ST_ACTIVE: Record<AttendanceStatus, string> = {
  present: "bg-[#7D41AB] text-white shadow-sm shadow-[#7D41AB]/30",
  absent: "bg-[#4D1882] text-white shadow-sm shadow-[#4D1882]/30",
  late: "bg-[#A771CF] text-white shadow-sm shadow-[#A771CF]/30",
  excused: "bg-[#BC99D9] text-white shadow-sm shadow-[#BC99D9]/30",
};

interface Row {
  key: string;
  student: Student;
  module: Module;
  record?: AttendanceRecord;
}

interface Summary {
  student: Student;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

function HistoryModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { attendance, getModule } = useAppData();
  const [historyData, setHistoryData] = useState<StudentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    attendanceApi
      .getStudentHistory(student.id)
      .then((res) => {
        if (active) {
          setHistoryData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [student.id]);

  // Fallback to local records if server call is pending or offline
  const localRecs = useMemo(
    () => attendance.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, student.id],
  );
  const localCounts = useMemo(() => attendanceCounts(localRecs), [localRecs]);
  const counts = historyData?.counts ?? localCounts;
  const rate = historyData?.overallRate ?? attendanceRate(localRecs);
  const records = historyData?.records ?? localRecs;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${student.fullName} — Attendance History`}
      description={`${student.id} · Batch ${student.batch} · Overall Attendance ${rate}%`}
    >
      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-xl bg-surface-2 p-2.5 border border-line">
            <p className="num text-xl font-bold" style={{ color: ST_COLOR[s] }}>
              {counts[s] ?? 0}
            </p>
            <p className="text-[11px] capitalize text-muted font-medium">{s}</p>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>Timeline of records ({records.length})</span>
        {loading && <span className="animate-pulse text-brand">Syncing history…</span>}
      </div>

      <div className="max-h-[48vh] divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line">
        {records.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted">No attendance entries recorded for this student yet.</div>
        ) : (
          records.slice(0, 80).map((r) => {
            const modName =
              "module" in r && r.module && typeof r.module === "object" && "name" in r.module
                ? String((r.module as { name: string }).name)
                : getModule(r.moduleId)?.name ?? r.moduleId;
            const remarks = "remarks" in r ? String((r as { remarks?: string }).remarks ?? "") : "";
            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2/40 transition">
                <div>
                  <p className="text-sm font-semibold">{modName}</p>
                  <p className="text-[11px] text-muted flex items-center gap-1.5">
                    <span>{fmtDate(r.date)}</span>
                    <span>·</span>
                    <span className="capitalize">{r.method}</span>
                    {remarks && <span className="italic opacity-80">({remarks})</span>}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

export default function AttendancePage() {
  const {
    students,
    modules,
    attendance,
    markAttendance,
    bulkMarkAttendance,
    deleteAttendanceRecord,
    getModule,
    getStudent,
    refreshStudents,
    refreshAttendance,
  } = useAppData();
  const toast = useToast();

  const [view, setView] = useState<View>("daily");
  const [date, setDate] = useState(todayISO());
  const [batch, setBatch] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [q, setQ] = useState("");

  const [historyId, setHistoryId] = useState<string | null>(null);

  const [bulkActing, setBulkActing] = useState(false);
  const [delTarget, setDelTarget] = useState<AttendanceRecord | null>(null);

  // Server state sync
  const [serverRoster, setServerRoster] = useState<DailyRosterEntry[] | null>(null);
  const [serverSummaries, setServerSummaries] = useState<StudentAttendanceSummary[] | null>(null);

  const range = useMemo(() => {
    if (view === "daily") return { from: date, to: date };
    if (view === "weekly") {
      const s = startOfWeek(date);
      return { from: s, to: toISO(addDays(s, 6)) };
    }
    const y = Number(date.slice(0, 4)),
      m = Number(date.slice(5, 7));
    return { from: `${date.slice(0, 7)}-01`, to: toISO(new Date(y, m, 0)) };
  }, [view, date]);

  // Refresh students and attendance from MongoDB on mount
  useEffect(() => {
    void Promise.allSettled([refreshStudents(), refreshAttendance()]);
  }, [refreshStudents, refreshAttendance]);

  // Sync Daily Roster from server when date/filters change
  useEffect(() => {
    if (view !== "daily") return;
    let active = true;
    attendanceApi
      .getDailyRoster({
        date,
        moduleId: moduleId !== "all" ? moduleId : undefined,
        batch: batch !== "all" ? batch : undefined,
        search: q.trim() || undefined,
      })
      .then((res) => {
        if (active && res?.rows) {
          setServerRoster(res.rows);
        }
      })
      .catch(() => {
        if (active) setServerRoster(null);
      });
    return () => {
      active = false;
    };
  }, [view, date, moduleId, batch, q]);

  // Sync Summaries from server when weekly or monthly view is active
  useEffect(() => {
    if (view !== "weekly" && view !== "monthly") return;
    let active = true;
    attendanceApi
      .getSummaries({
        from: range.from,
        to: range.to,
        moduleId: moduleId !== "all" ? moduleId : undefined,
        batch: batch !== "all" ? batch : undefined,
        search: q.trim() || undefined,
      })
      .then((res) => {
        if (active && res?.summaries) {
          setServerSummaries(res.summaries);
        }
      })
      .catch(() => {
        if (active) setServerSummaries(null);
      });
    return () => {
      active = false;
    };
  }, [view, range.from, range.to, moduleId, batch, q]);

  const scope = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => {
      if (batch !== "all" && x.batch !== batch) return false;
      if (moduleId !== "all" && !x.moduleIds.includes(moduleId)) return false;
      if (!s) return true;
      const matchesStudent = x.fullName.toLowerCase().includes(s) || x.id.toLowerCase().includes(s);
      if (matchesStudent) return true;
      return x.moduleIds.some((mid) => {
        const m = modules.find((mod) => mod.id === mid);
        return m && (m.name.toLowerCase().includes(s) || m.code.toLowerCase().includes(s));
      });
    });
  }, [students, batch, moduleId, q, modules]);
  const scopeIds = useMemo(() => new Set(scope.map((s) => s.id)), [scope]);

  const recs = useMemo(
    () =>
      attendance.filter((a) => {
        if (a.date < range.from || a.date > range.to) return false;
        if (moduleId !== "all" && a.moduleId !== moduleId) return false;
        if (!scopeIds.has(a.studentId)) return false;
        const query = q.trim().toLowerCase();
        if (!query) return true;
        const student = getStudent(a.studentId);
        const mod = getModule(a.moduleId);
        const matchStudent =
          student?.fullName?.toLowerCase().includes(query) ||
          student?.id?.toLowerCase().includes(query) ||
          a.studentId.toLowerCase().includes(query);
        const matchMod =
          mod?.name?.toLowerCase().includes(query) ||
          mod?.code?.toLowerCase().includes(query) ||
          a.moduleId.toLowerCase().includes(query);
        return matchStudent || matchMod;
      }),
    [attendance, range, scopeIds, moduleId, q, getStudent, getModule],
  );

  /* Daily roster rows */
  const rows = useMemo<Row[]>(() => {
    if (view !== "daily") return [];
    const map = new Map(attendance.filter((a) => a.date === date).map((a) => [a.id, a]));
    const raw: Row[] = [];

    // Use server roster entries if available
    if (serverRoster !== null) {
      serverRoster.forEach((entry) => {
        const studentObj = students.find((s) => s.id === entry.student.id) ?? {
          id: entry.student.id,
          fullName: entry.student.fullName,
          batch: entry.student.batch ?? "2026",
          email: entry.student.email ?? "",
          phone: entry.student.phone ?? "",
          dob: "2006-01-01",
          address: "Colombo",
          guardianName: "Parent",
          guardianPhone: "",
          ref: entry.student.id,
          moduleIds: [entry.module.id],
          enrollmentDate: date,
          status: "active" as const,
        };
        const moduleObj = modules.find((m) => m.id === entry.module.id) ?? {
          id: entry.module.id,
          code: entry.module.code,
          name: entry.module.name,
          description: "",
          fee: 5000,
          duration: "3 months",
          teacherId: "",
          batches: [],
          status: "active" as const,
        };
        const rec = map.get(`att_${studentObj.id}_${moduleObj.id}_${date}`) ?? (entry.record ?? undefined);
        raw.push({
          key: `${studentObj.id}_${moduleObj.id}`,
          student: studentObj,
          module: moduleObj,
          record: rec,
        });
      });
    } else {
      // Local calculation fallback
      scope.forEach((s) => {
        if (s.status !== "active") return;
        s.moduleIds.forEach((mid) => {
          if (moduleId !== "all" && mid !== moduleId) return;
          const module = modules.find((m) => m.id === mid);
          if (!module) return;
          raw.push({
            key: `${s.id}_${mid}`,
            student: s,
            module,
            record: map.get(`att_${s.id}_${mid}_${date}`),
          });
        });
      });
    }

    const query = q.trim().toLowerCase();
    if (!query) return raw;

    return raw.filter((r) => {
      const matchName = r.student.fullName?.toLowerCase().includes(query);
      const matchId = r.student.id?.toLowerCase().includes(query);
      const matchEmail = r.student.email?.toLowerCase().includes(query);
      const matchBatch = r.student.batch?.toLowerCase().includes(query);
      const matchModuleName = r.module.name?.toLowerCase().includes(query);
      const matchModuleCode = r.module.code?.toLowerCase().includes(query);
      return matchName || matchId || matchEmail || matchBatch || matchModuleName || matchModuleCode;
    });
  }, [view, attendance, date, serverRoster, students, modules, scope, moduleId, q]);

  const unmarked = rows.filter((r) => !r.record).length;

  /* Mark single attendance */
  const mark = (s: Student, mid: string, status: AttendanceStatus, method: "manual" | "qr" = "manual") => {
    const res = markAttendance(s.id, mid, date, status, method);
    toast.success(
      `${s.fullName} marked ${status} in ${getModule(mid)?.code ?? "module"} (${
        res === "created" ? "new record" : "updated"
      })`,
    );
  };

  /* Bulk mark all unmarked present */
  const markAllUnmarked = async () => {
    setBulkActing(true);
    try {
      const serverMarked = await bulkMarkAttendance(
        date,
        moduleId !== "all" ? moduleId : undefined,
        batch !== "all" ? batch : undefined,
        "present",
      );

      // Local update as backup/optimistic
      rows.filter((r) => !r.record).forEach((r) => markAttendance(r.student.id, r.module.id, date, "present"));
      toast.success(
        `Marked ${serverMarked > 0 ? serverMarked : unmarked} unmarked students present for ${fmtDate(date)}`,
      );
    } finally {
      setBulkActing(false);
    }
  };

  /* Summaries for Weekly/Monthly tabs */
  const summaries = useMemo<Summary[]>(() => {
    let base: Summary[] = [];
    if (serverSummaries && serverSummaries.length > 0) {
      base = serverSummaries
        .map((s) => {
          const existing = students.find((st) => st.id === s.student.id);
          const studentObj = existing ?? {
            id: s.student.id,
            fullName: s.student.fullName,
            batch: s.student.batch ?? "2026",
            email: s.student.email ?? "",
            phone: s.student.phone ?? "",
            dob: "2006-01-01",
            address: "",
            guardianName: "",
            guardianPhone: "",
            ref: s.student.id,
            moduleIds: (s.student as unknown as { moduleIds?: string[] }).moduleIds ?? [],
            enrollmentDate: date,
            status: "active" as const,
          };
          return {
            student: studentObj,
            present: s.present,
            absent: s.absent,
            late: s.late,
            excused: s.excused,
            total: s.total,
            rate: s.rate,
          };
        })
        .filter((x) => x.student);
    } else {
      const map = new Map<string, AttendanceRecord[]>();
      recs.forEach((r) => map.set(r.studentId, [...(map.get(r.studentId) ?? []), r]));
      base = [...map.entries()]
        .map(([id, list]) => ({
          student: getStudent(id)!,
          ...attendanceCounts(list),
          total: list.length,
          rate: attendanceRate(list),
        }))
        .filter((x) => x.student);
    }

    const query = q.trim().toLowerCase();
    if (!query) return base;

    return base.filter((item) => {
      const matchName = item.student.fullName?.toLowerCase().includes(query);
      const matchId = item.student.id?.toLowerCase().includes(query);
      const matchBatch = item.student.batch?.toLowerCase().includes(query);
      const matchModule = item.student.moduleIds?.some((mid) => {
        const m = modules.find((mod) => mod.id === mid);
        return (
          m &&
          (m.name.toLowerCase().includes(query) ||
            m.code.toLowerCase().includes(query) ||
            m.id.toLowerCase().includes(query))
        );
      });
      return matchName || matchId || matchBatch || matchModule;
    });
  }, [serverSummaries, students, modules, recs, getStudent, date, q]);

  /* Charts */
  const dayChart = useMemo(() => {
    if (view === "weekly") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = toISO(addDays(range.from, i));
        const c = attendanceCounts(recs.filter((r) => r.date === d));
        return {
          label: addDays(range.from, i).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
          ...c,
        };
      });
    }

    // In daily view, aggregate attendance statuses directly from active daily roster rows
    const map = new Map<string, { label: string; present: number; absent: number; late: number; excused: number }>();

    rows.forEach((r) => {
      if (!r.record?.status) return;
      const label = r.module.code ? r.module.code.split("-")[0] : r.module.name;
      const key = r.module.id || label;
      let entry = map.get(key);
      if (!entry) {
        entry = { label, present: 0, absent: 0, late: 0, excused: 0 };
        map.set(key, entry);
      }
      const st = r.record.status;
      if (st in entry) {
        entry[st as AttendanceStatus] += 1;
      }
    });

    return Array.from(map.values()).filter((x) => x.present + x.absent + x.late + x.excused > 0);
  }, [view, range, recs, rows]);

  const trend = useMemo(() => attendanceSeries(recs, range), [recs, range]);

  /* Daily Table Columns */
  const dailyCols = useMemo<Columns<Row>>(
    () => [
      {
        id: "student",
        header: "Student",
        accessorFn: (r) => r.student.fullName,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar name={row.original.student.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.student.fullName}</p>
              <p className="num text-[11px] text-muted flex items-center gap-1.5">
                <span>{row.original.student.id}</span>
                <span>·</span>
                <span className="font-normal">{row.original.student.batch}</span>
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (r) => r.module.name,
        cell: ({ row }) => <Badge tone="primary">{row.original.module.code}</Badge>,
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => mark(row.original.student, row.original.module.id, s)}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition active:scale-95 select-none",
                  row.original.record?.status === s ? ST_ACTIVE[s] : "bg-surface-2 text-muted hover:text-ink hover:bg-surface-3",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: "method",
        header: "Source",
        accessorFn: (r) => r.record?.method ?? "—",
        cell: ({ row }) => {
          const method = row.original.record?.method;
          if (!method) return <span className="text-xs text-muted">—</span>;
          return (
            <span className="inline-flex items-center gap-1 text-xs capitalize text-muted bg-surface-2 px-2 py-0.5 rounded-md">
              {method === "qr" && <ScanLine className="h-3 w-3 text-brand" />}
              {method}
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, attendance, rows],
  );

  /* Summary Table Columns */
  const summaryCols = useMemo<Columns<Summary>>(
    () => [
      {
        id: "student",
        header: "Student",
        accessorFn: (r) => r.student.fullName,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar name={row.original.student.fullName} size="sm" />
            <div>
              <p className="font-semibold">{row.original.student.fullName}</p>
              <p className="num text-[11px] text-muted">
                {row.original.student.id} · {row.original.student.batch}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "present",
        header: "Present",
        cell: (c) => <span className="num font-semibold text-[#7D41AB]">{c.getValue() as number}</span>,
      },
      {
        accessorKey: "late",
        header: "Late",
        cell: (c) => <span className="num font-semibold text-[#A771CF]">{c.getValue() as number}</span>,
      },
      {
        accessorKey: "absent",
        header: "Absent",
        cell: (c) => <span className="num font-semibold text-[#4D1882]">{c.getValue() as number}</span>,
      },
      {
        accessorKey: "excused",
        header: "Excused",
        cell: (c) => <span className="num font-semibold text-[#BC99D9]">{c.getValue() as number}</span>,
      },
      {
        accessorKey: "rate",
        header: "Rate",
        cell: (c) => {
          const v = c.getValue() as number;
          return (
            <div className="flex min-w-[120px] items-center gap-2">
              <ProgressBar value={v} tone={v >= 85 ? "teal" : v >= 70 ? "amber" : "rose"} />
              <span className="num w-12 text-xs font-bold">{v}%</span>
            </div>
          );
        },
      },
      {
        id: "h",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button size="sm" variant="ghost" onClick={() => setHistoryId(row.original.student.id)}>
            <History className="h-3.5 w-3.5" /> History
          </Button>
        ),
      },
    ],
    [],
  );

  /* Records Table Columns */
  const recordCols = useMemo<Columns<AttendanceRecord>>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: (c) => <span className="text-sm font-medium">{fmtDate(c.getValue() as string)}</span>,
      },
      {
        id: "student",
        header: "Student",
        accessorFn: (r) => getStudent(r.studentId)?.fullName ?? r.studentId,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{getStudent(row.original.studentId)?.fullName ?? row.original.studentId}</p>
            <p className="num text-[11px] text-muted">{row.original.studentId}</p>
          </div>
        ),
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (r) => getModule(r.moduleId)?.name ?? r.moduleId,
        cell: ({ row }) => (
          <Badge tone="primary">{getModule(row.original.moduleId)?.code ?? row.original.moduleId}</Badge>
        ),
      },
      {
        accessorKey: "method",
        header: "Source",
        cell: (c) => (
          <span className="inline-flex items-center gap-1 text-xs capitalize text-muted bg-surface-2 px-2 py-0.5 rounded-md">
            {(c.getValue() as string) === "qr" && <ScanLine className="h-3 w-3 text-brand" />}
            {c.getValue() as string}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.status,
        cell: ({ row }) => (
          <div className="w-32">
            <Select
              value={row.original.status}
              aria-label="Change status"
              className="h-8 text-xs capitalize"
              onChange={(e) => {
                markAttendance(
                  row.original.studentId,
                  row.original.moduleId,
                  row.original.date,
                  e.target.value as AttendanceStatus,
                );
                toast.success("Attendance status updated");
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={() => setDelTarget(row.original)}
            aria-label="Delete attendance record"
            className="rounded-lg p-1 text-muted hover:text-rose-500 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, modules],
  );

  const sortedRecs = useMemo(() => [...recs].sort((a, b) => b.date.localeCompare(a.date)), [recs]);

  /* Export XLSX */
  const exportXlsx = () => {
    const data = sortedRecs.map((r) => {
      const s = getStudent(r.studentId);
      return {
        Date: r.date,
        "Student ID": r.studentId,
        Student: s?.fullName,
        Batch: s?.batch,
        Module: getModule(r.moduleId)?.name,
        Status: r.status,
        Source: r.method,
      };
    });
    if (!data.length) return toast.error("No attendance records to export for this selection");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${range.from}_to_${range.to}.xlsx`);
    toast.success(`Exported ${data.length} attendance records`);
  };

  const historyStudent = historyId ? getStudent(historyId) : undefined;

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily roster, batch marking, student verification and real-time attendance analytics."
        actions={
          <>
            <Link to="/dashboard/qr-scanner">
              <Button variant="secondary">
                <ScanLine className="h-4 w-4" /> QR Scanner
              </Button>
            </Link>
            <Button onClick={exportXlsx}>
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </>
        }
      />

      {/* Date Navigation & Filters Toolbar */}
      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <Field label="Date">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDate(toISO(addDays(date, -1)))}
                aria-label="Previous day"
                className="h-9 w-8 shrink-0 flex items-center justify-center rounded-xl bg-surface-2 text-muted hover:text-ink hover:bg-surface-3 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-full text-center font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setDate(toISO(addDays(date, 1)))}
                disabled={date >= todayISO()}
                aria-label="Next day"
                className="h-9 w-8 shrink-0 flex items-center justify-center rounded-xl bg-surface-2 text-muted hover:text-ink hover:bg-surface-3 transition disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Field>

          <Field label="Batch">
            <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="all">All batches</option>
              {BATCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>

          <Field label="Module / class">
            <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="all">All modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Search" className="sm:col-span-2 lg:col-span-2">
            <SearchInput placeholder="Name, ID, or subject…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Tabs & View switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { id: "daily", label: "Daily Roster" },
            { id: "weekly", label: "Weekly Summary" },
            { id: "monthly", label: "Monthly Trends" },
            { id: "records", label: "All Records" },
          ]}
        />
        <p className="text-xs font-semibold text-muted bg-surface-2 px-3 py-1 rounded-xl border border-line">
          {view === "daily" ? fmtDate(date) : `${fmtDate(range.from, false)} – ${fmtDate(range.to)}`}
        </p>
      </div>

      {/* Charts */}
      {view !== "records" && (
        <div className="mb-6">
          <Card>
            <CardHeader
              title={
                view === "monthly"
                  ? "Daily attendance rate"
                  : view === "weekly"
                  ? "Attendance by day"
                  : "Attendance by module"
              }
              subtitle={
                view === "monthly"
                  ? "Present + late share of marked students"
                  : "Stacked by status across active modules"
              }
              action={
                view !== "monthly" ? (
                  <ChartLegend items={STATUSES.map((s) => ({ label: s, color: ST_COLOR[s] }))} />
                ) : undefined
              }
            />
            <div className="h-64 p-4 pt-2">
              {(view === "monthly" ? trend.length : dayChart.length) === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  No attendance data for this selection
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {view === "monthly" ? (
                    <AreaChart data={trend} margin={{ left: -15, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7D41AB" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#BC99D9" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip content={<ChartTooltip suffix="%" />} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        name="Rate"
                        stroke="#7D41AB"
                        strokeWidth={2.5}
                        fill="url(#rateFill)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={dayChart} margin={{ left: -15, right: 8, top: 8 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={cursorStyle} />
                      {STATUSES.map((s, i) => (
                        <Bar
                          key={s}
                          dataKey={s}
                          name={s}
                          stackId="a"
                          fill={ST_COLOR[s]}
                          radius={i === STATUSES.length - 1 ? [6, 6, 0, 0] : 0}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        <CardHeader
          title={
            view === "daily"
              ? "Mark attendance"
              : view === "records"
              ? "Attendance records"
              : "Student attendance summary"
          }
          subtitle={
            view === "daily"
              ? `${rows.length} class entries · ${unmarked} unmarked`
              : view === "records"
              ? `${recs.length} total records`
              : `${summaries.length} enrolled students in range`
          }
          action={
            view === "daily" && unmarked > 0 ? (
              <Button size="sm" variant="soft" onClick={markAllUnmarked} disabled={bulkActing}>
                <CheckCheck className="h-3.5 w-3.5" />
                {bulkActing ? "Marking…" : `Mark ${unmarked} unmarked present`}
              </Button>
            ) : undefined
          }
          className="pb-4"
        />

        {view === "daily" && (
          <DataTable
            data={rows}
            columns={dailyCols}
            pageSize={10}
            emptyTitle="No class entries"
            emptyText="No active students are registered for this selection."
          />
        )}

        {(view === "weekly" || view === "monthly") && (
          <DataTable
            data={summaries}
            columns={summaryCols}
            pageSize={10}
            emptyTitle="No attendance data"
            emptyText="No records exist for this period and filter."
          />
        )}

        {view === "records" && (
          <DataTable data={sortedRecs} columns={recordCols} pageSize={10} emptyTitle="No attendance records" />
        )}
      </Card>

      {/* Student History Modal */}
      {historyStudent && (
        <HistoryModal key={historyStudent.id} student={historyStudent} onClose={() => setHistoryId(null)} />
      )}

      {/* Delete Record Confirmation */}
      <ConfirmDialog
        open={!!delTarget}
        title="Delete attendance record?"
        text={`This will undo the ${delTarget?.status} record for student ${delTarget?.studentId} on ${delTarget?.date}.`}
        confirmLabel="Delete record"
        confirmVariant="danger"
        onConfirm={async () => {
          if (delTarget) {
            await deleteAttendanceRecord(delTarget.id);
            toast.success("Attendance record removed");
            setDelTarget(null);
          }
        }}
        onClose={() => setDelTarget(null)}
      />
    </>
  );
}
