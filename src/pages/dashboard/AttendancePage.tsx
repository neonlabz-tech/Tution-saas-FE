import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCheck, Download, History, QrCode, ScanLine } from "lucide-react";
import type { AttendanceRecord, AttendanceStatus, Module, Student } from "@/types";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, ProgressBar, SearchInput, Select, StatusBadge, Tabs } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { ChartLegend, ChartTooltip, axisTick, cursorStyle, gridProps } from "@/components/analytics/chartParts";
import { attendanceCounts, attendanceRate, attendanceSeries } from "@/lib/stats";
import { addDays, cn, fmtDate, parseQrPayload, startOfWeek, toISO, todayISO } from "@/lib/utils";

type View = "daily" | "weekly" | "monthly" | "records";
const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const ST_COLOR: Record<AttendanceStatus, string> = { present: "#10B981", late: "#F59E0B", absent: "#F43F5E", excused: "#6366F1" };
const ST_ACTIVE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  absent: "bg-rose-500 text-white",
  late: "bg-amber-500 text-white",
  excused: "bg-indigo-500 text-white",
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
  const recs = attendance.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const c = attendanceCounts(recs);
  return (
    <Modal open onClose={onClose} title={`${student.fullName} — attendance history`} description={`${student.id} · overall ${attendanceRate(recs)}%`}>
      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-xl bg-surface-2 p-2.5"><p className="num text-lg font-bold" style={{ color: ST_COLOR[s] }}>{c[s]}</p><p className="text-[11px] capitalize text-muted">{s}</p></div>
        ))}
      </div>
      <div className="max-h-[45vh] divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line">
        {recs.slice(0, 60).map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
            <div><p className="text-sm font-semibold">{getModule(r.moduleId)?.name}</p><p className="text-[11px] text-muted">{fmtDate(r.date)} · {r.method}</p></div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function AttendancePage() {
  const { students, modules, attendance, markAttendance, getModule, getStudent } = useAppData();
  const toast = useToast();
  const [view, setView] = useState<View>("daily");
  const [date, setDate] = useState(todayISO());
  const [batch, setBatch] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [q, setQ] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [qrModule, setQrModule] = useState(modules[0]?.id ?? "");
  const [qrCode, setQrCode] = useState("");

  const range = useMemo(() => {
    if (view === "daily") return { from: date, to: date };
    if (view === "weekly") { const s = startOfWeek(date); return { from: s, to: toISO(addDays(s, 6)) }; }
    const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
    return { from: `${date.slice(0, 7)}-01`, to: toISO(new Date(y, m, 0)) };
  }, [view, date]);

  const scope = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter(
      (x) =>
        (batch === "all" || x.batch === batch) &&
        (studentId === "all" || x.id === studentId) &&
        (moduleId === "all" || x.moduleIds.includes(moduleId)) &&
        (!s || x.fullName.toLowerCase().includes(s) || x.id.toLowerCase().includes(s)),
    );
  }, [students, batch, studentId, moduleId, q]);
  const scopeIds = useMemo(() => new Set(scope.map((s) => s.id)), [scope]);

  const recs = useMemo(
    () => attendance.filter((a) => a.date >= range.from && a.date <= range.to && scopeIds.has(a.studentId) && (moduleId === "all" || a.moduleId === moduleId)),
    [attendance, range, scopeIds, moduleId],
  );
  const counts = attendanceCounts(recs);

  /* Daily roster rows */
  const rows = useMemo<Row[]>(() => {
    if (view !== "daily") return [];
    const map = new Map(attendance.filter((a) => a.date === date).map((a) => [a.id, a]));
    const out: Row[] = [];
    scope.forEach((s) => {
      if (s.status !== "active") return;
      s.moduleIds.forEach((mid) => {
        if (moduleId !== "all" && mid !== moduleId) return;
        const module = modules.find((m) => m.id === mid);
        if (!module) return;
        out.push({ key: `${s.id}_${mid}`, student: s, module, record: map.get(`att_${s.id}_${mid}_${date}`) });
      });
    });
    return out;
  }, [view, attendance, date, scope, moduleId, modules]);
  const unmarked = rows.filter((r) => !r.record).length;

  const mark = (s: Student, mid: string, status: AttendanceStatus, method: "manual" | "qr" = "manual") => {
    const res = markAttendance(s.id, mid, date, status, method);
    toast.success(`${s.fullName} marked ${status} in ${getModule(mid)?.code} (${res === "created" ? "new record" : "record updated"})`);
  };
  const markAll = () => {
    rows.filter((r) => !r.record).forEach((r) => markAttendance(r.student.id, r.module.id, date, "present"));
    toast.success(`${unmarked} unmarked students marked present`);
  };

  const summaries = useMemo<Summary[]>(() => {
    const map = new Map<string, AttendanceRecord[]>();
    recs.forEach((r) => map.set(r.studentId, [...(map.get(r.studentId) ?? []), r]));
    return [...map.entries()].map(([id, list]) => ({ student: getStudent(id)!, ...attendanceCounts(list), total: list.length, rate: attendanceRate(list) })).filter((x) => x.student);
  }, [recs, getStudent]);

  /* Charts */
  const dayChart = useMemo(() => {
    if (view === "weekly") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = toISO(addDays(range.from, i));
        const c = attendanceCounts(recs.filter((r) => r.date === d));
        return { label: addDays(range.from, i).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }), ...c };
      });
    }
    return modules
      .map((m) => ({ label: m.code.split("-")[0], ...attendanceCounts(recs.filter((r) => r.moduleId === m.id)) }))
      .filter((x) => x.present + x.absent + x.late + x.excused > 0);
  }, [view, range, recs, modules]);
  const trend = useMemo(() => attendanceSeries(recs, range), [recs, range]);

  /* Columns */
  const dailyCols = useMemo<Columns<Row>>(
    () => [
      { id: "student", header: "Student", accessorFn: (r) => r.student.fullName, cell: ({ row }) => (
        <div className="flex items-center gap-3"><Avatar name={row.original.student.fullName} size="sm" /><div className="min-w-0"><p className="truncate font-semibold">{row.original.student.fullName}</p><p className="num text-[11px] text-muted">{row.original.student.id}</p></div></div>
      ) },
      { id: "module", header: "Module", accessorFn: (r) => r.module.name, cell: ({ row }) => <Badge tone="primary">{row.original.module.code}</Badge> },
      { id: "status", header: "Status", enableSorting: false, cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => mark(row.original.student, row.original.module.id, s)} className={cn("cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition active:scale-95", row.original.record?.status === s ? ST_ACTIVE[s] : "bg-surface-2 text-muted hover:text-ink")}>{s}</button>
          ))}
        </div>
      ) },
      { id: "method", header: "Source", accessorFn: (r) => r.record?.method ?? "—", cell: (c) => <span className="text-xs capitalize text-muted">{c.getValue() as string}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, attendance],
  );
  const summaryCols = useMemo<Columns<Summary>>(
    () => [
      { id: "student", header: "Student", accessorFn: (r) => r.student.fullName, cell: ({ row }) => (
        <div className="flex items-center gap-3"><Avatar name={row.original.student.fullName} size="sm" /><div><p className="font-semibold">{row.original.student.fullName}</p><p className="num text-[11px] text-muted">{row.original.student.batch}</p></div></div>
      ) },
      { accessorKey: "present", header: "Present", cell: (c) => <span className="num font-semibold text-emerald-500">{c.getValue() as number}</span> },
      { accessorKey: "late", header: "Late", cell: (c) => <span className="num font-semibold text-amber-500">{c.getValue() as number}</span> },
      { accessorKey: "absent", header: "Absent", cell: (c) => <span className="num font-semibold text-rose-500">{c.getValue() as number}</span> },
      { accessorKey: "excused", header: "Excused", cell: (c) => <span className="num font-semibold text-indigo-500">{c.getValue() as number}</span> },
      { accessorKey: "rate", header: "Rate", cell: (c) => { const v = c.getValue() as number; return <div className="flex min-w-[120px] items-center gap-2"><ProgressBar value={v} tone={v >= 85 ? "teal" : v >= 70 ? "amber" : "rose"} /><span className="num w-12 text-xs font-bold">{v}%</span></div>; } },
      { id: "h", header: "", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => setHistoryId(row.original.student.id)}><History className="h-3.5 w-3.5" /> History</Button> },
    ],
    [],
  );
  const recordCols = useMemo<Columns<AttendanceRecord>>(
    () => [
      { accessorKey: "date", header: "Date", cell: (c) => <span className="text-sm">{fmtDate(c.getValue() as string)}</span> },
      { id: "student", header: "Student", accessorFn: (r) => getStudent(r.studentId)?.fullName ?? "", cell: (c) => <span className="font-semibold">{c.getValue() as string}</span> },
      { id: "module", header: "Module", accessorFn: (r) => getModule(r.moduleId)?.name ?? "", cell: (c) => <span className="text-sm">{c.getValue() as string}</span> },
      { accessorKey: "method", header: "Source", cell: (c) => <span className="text-xs capitalize text-muted">{c.getValue() as string}</span> },
      { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => (
        <div className="w-32"><Select value={row.original.status} aria-label="Change status" className="h-8 text-xs capitalize" onChange={(e) => { markAttendance(row.original.studentId, row.original.moduleId, row.original.date, e.target.value as AttendanceStatus); toast.success("Attendance status updated"); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select></div>
      ) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, modules],
  );
  const sortedRecs = useMemo(() => [...recs].sort((a, b) => b.date.localeCompare(a.date)), [recs]);

  const exportXlsx = () => {
    const data = sortedRecs.map((r) => {
      const s = getStudent(r.studentId);
      return { Date: r.date, "Student ID": r.studentId, Student: s?.fullName, Batch: s?.batch, Module: getModule(r.moduleId)?.name, Status: r.status, Source: r.method };
    });
    if (!data.length) return toast.error("No attendance records to export for this selection");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${range.from}_to_${range.to}.xlsx`);
    toast.success(`Exported ${data.length} attendance records`);
  };

  const qrMark = () => {
    const code = parseQrPayload(qrCode);
    const s = students.find((x) => x.id.toLowerCase() === code.toLowerCase() || x.ref === code);
    if (!s) return toast.error("No student matches that code");
    if (!s.moduleIds.includes(qrModule)) return toast.error(`${s.fullName} is not registered in ${getModule(qrModule)?.name}`);
    markAttendance(s.id, qrModule, date, "present", "qr");
    toast.success(`${s.fullName} marked present via QR code`);
    setQrCode("");
  };

  const summaryCards = [
    { l: "Present", v: counts.present, c: "text-emerald-500", bg: "bg-emerald-500/10" },
    { l: "Absent", v: counts.absent, c: "text-rose-500", bg: "bg-rose-500/10" },
    { l: "Late", v: counts.late, c: "text-amber-500", bg: "bg-amber-500/10" },
    { l: "Excused", v: counts.excused, c: "text-indigo-500", bg: "bg-indigo-500/10" },
    { l: "Attendance rate", v: `${attendanceRate(recs)}%`, c: "text-brand", bg: "bg-primary/10" },
  ];
  const historyStudent = historyId ? getStudent(historyId) : undefined;

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark attendance manually or by QR, review trends and export reports."
        actions={<><Link to="/dashboard/qr-scanner"><Button variant="secondary"><ScanLine className="h-4 w-4" /> QR scanner</Button></Link><Button onClick={exportXlsx}><Download className="h-4 w-4" /> Export report</Button></>}
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Date"><Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Field label="Batch"><Select value={batch} onChange={(e) => setBatch(e.target.value)}><option value="all">All batches</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Module / class"><Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}><option value="all">All modules</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
          <Field label="Student"><Select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="all">All students</option>{[...students].sort((a, b) => a.fullName.localeCompare(b.fullName)).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</Select></Field>
          <Field label="Search" className="sm:col-span-2"><SearchInput placeholder="Name or ID…" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
        {studentId !== "all" && <div className="mt-3"><Button size="sm" variant="soft" onClick={() => setHistoryId(studentId)}><History className="h-3.5 w-3.5" /> View attendance history</Button></div>}
      </Card>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onChange={setView} items={[{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }, { id: "records", label: "Records" }]} />
        <p className="text-xs font-medium text-muted">{view === "daily" ? fmtDate(date) : `${fmtDate(range.from, false)} – ${fmtDate(range.to)}`}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((c) => (
          <Card key={c.l} className="p-4"><div className={`mb-2 inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${c.bg} ${c.c}`}>{c.l}</div><p className={`num text-3xl font-bold ${c.c}`}>{c.v}</p></Card>
        ))}
      </div>

      {view !== "records" && (
        <div className={cn("mb-6 grid gap-6", view === "daily" && "xl:grid-cols-3")}>
          <Card className={cn(view === "daily" && "xl:col-span-2")}>
            <CardHeader title={view === "monthly" ? "Daily attendance rate" : view === "weekly" ? "Attendance by day" : "Attendance by module"} subtitle={view === "monthly" ? "Present + late share of marked students" : "Stacked by status"} action={view !== "monthly" ? <ChartLegend items={STATUSES.map((s) => ({ label: s, color: ST_COLOR[s] }))} /> : undefined} />
            <div className="h-64 p-4 pt-2">
              {(view === "monthly" ? trend.length : dayChart.length) === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">No attendance data for this selection</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {view === "monthly" ? (
                    <AreaChart data={trend} margin={{ left: -15, right: 8, top: 8 }}>
                      <defs><linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip content={<ChartTooltip suffix="%" />} />
                      <Area type="monotone" dataKey="rate" name="Rate" stroke="#4F46E5" strokeWidth={2.5} fill="url(#rateFill)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={dayChart} margin={{ left: -15, right: 8, top: 8 }}>
                      <CartesianGrid {...gridProps} /><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={cursorStyle} />
                      {STATUSES.map((s, i) => <Bar key={s} dataKey={s} name={s} stackId="a" fill={ST_COLOR[s]} radius={i === STATUSES.length - 1 ? [6, 6, 0, 0] : 0} />)}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {view === "daily" && (
            <Card className="bg-gradient-to-br from-primary/[0.07] to-secondary/[0.07]">
              <CardHeader title={<span className="flex items-center gap-2"><QrCode className="h-4 w-4 text-brand" /> QR attendance</span>} subtitle={`Marks present on ${fmtDate(date)}`} />
              <div className="space-y-3 p-5">
                <Field label="Module"><Select value={qrModule} onChange={(e) => setQrModule(e.target.value)}>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
                <Field label="Scanned code or Student ID" hint="Use a handheld scanner, or paste a student ID such as STU-2025-001."><Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && qrMark()} placeholder="Scan or type code…" className="num" /></Field>
                <Button className="w-full" onClick={qrMark} disabled={!qrCode.trim()}><QrCode className="h-4 w-4" /> Mark present</Button>
                <Link to="/dashboard/qr-scanner" className="block text-center text-xs font-semibold text-brand hover:underline">Open camera scanner →</Link>
              </div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader
          title={view === "daily" ? "Mark attendance" : view === "records" ? "Attendance records" : "Student summary"}
          subtitle={view === "daily" ? `${rows.length} class entries · ${unmarked} unmarked` : view === "records" ? `${recs.length} records in ${range.from.slice(0, 7)}` : `${summaries.length} students in range`}
          action={view === "daily" && unmarked > 0 ? <Button size="sm" variant="soft" onClick={markAll}><CheckCheck className="h-3.5 w-3.5" /> Mark {unmarked} unmarked present</Button> : undefined}
          className="pb-4"
        />
        {view === "daily" && <DataTable data={rows} columns={dailyCols} pageSize={10} emptyTitle="No class entries" emptyText="No active students are registered for this selection." />}
        {(view === "weekly" || view === "monthly") && <DataTable data={summaries} columns={summaryCols} pageSize={10} emptyTitle="No attendance data" emptyText="No records exist for this period and filter." />}
        {view === "records" && <DataTable data={sortedRecs} columns={recordCols} pageSize={10} emptyTitle="No records" />}
      </Card>

      {historyStudent && <HistoryModal key={historyStudent.id} student={historyStudent} onClose={() => setHistoryId(null)} />}
    </>
  );
}
