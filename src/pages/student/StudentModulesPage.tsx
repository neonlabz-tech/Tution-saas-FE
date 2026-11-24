import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock, ClipboardList, Clock, FolderOpen, MapPin, MonitorPlay, Video } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui/primitives";
import { DataGate } from "@/components/student/states";
import { COLORS } from "@/components/analytics/chartParts";
import { useStudentData } from "@/hooks/useStudentData";
import { fmtDate, fmtTime } from "@/lib/utils";

export default function StudentModulesPage() {
  const { data, loading, error, reload } = useStudentData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.modules ?? []).filter((m) => (status === "all" || m.status === status) && (!s || m.name.toLowerCase().includes(s) || m.code.toLowerCase().includes(s) || (m.teacher?.fullName ?? "").toLowerCase().includes(s)));
  }, [data, q, status]);

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload} cards={3}>
      {data && (
        <>
          <PageHeader title="My Modules" description={`You're registered for ${data.modules.length} module${data.modules.length === 1 ? "" : "s"}. Select a module to see its calendar, assignments, materials and recordings.`} />

          <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
            <SearchInput placeholder="Search by module, code or teacher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search modules" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="archived">Archived</option>
            </Select>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState icon={<BookOpen className="h-6 w-6" />} title={data.modules.length === 0 ? "No registered modules" : "No modules match"} text={data.modules.length === 0 ? "You haven't been enrolled in any modules yet. Contact the front desk to register." : "Try a different search or status filter."} />
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => {
                const color = COLORS[data.modules.findIndex((x) => x.id === m.id) % COLORS.length];
                return (
                  <Link key={m.id} to={`/student/modules/${m.id}`} aria-label={`Open ${m.name}`} className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <Card className="flex h-full flex-col overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
                      <div className="h-1.5" style={{ background: color }} />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: color }}><BookOpen className="h-5 w-5" /></div>
                          <div className="flex items-center gap-2"><Badge tone="primary">{m.code}</Badge><StatusBadge status={m.status} /></div>
                        </div>
                        <h3 className="mt-4 font-heading text-lg font-bold leading-snug">{m.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description}</p>

                        <div className="mt-4 flex items-center gap-2.5">
                          {m.teacher ? <Avatar name={m.teacher.fullName} size="sm" /> : null}
                          <div className="min-w-0 text-xs leading-tight">
                            <p className="truncate font-semibold">{m.teacher?.fullName ?? "Teacher to be announced"}</p>
                            <p className="truncate text-muted">{m.teacher?.specialization ?? ""}</p>
                          </div>
                        </div>

                        <ul className="mt-4 space-y-1.5 text-xs text-muted">
                          <li className="flex items-center gap-2"><Video className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.onlineSchedule}</span></li>
                          <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.physicalSchedule}</span></li>
                          <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" />Duration {m.duration}</li>
                        </ul>

                        <div className="mt-auto pt-4">
                          <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-[11px] font-semibold text-muted">
                            <span className="flex items-center gap-1" title="Open assignments"><ClipboardList className="h-3.5 w-3.5" />{m.openAssignments} open</span>
                            <span className="flex items-center gap-1" title="Study materials"><FolderOpen className="h-3.5 w-3.5" />{m.materialsCount} files</span>
                            <span className="flex items-center gap-1" title="Recordings"><MonitorPlay className="h-3.5 w-3.5" />{m.recordingsCount} recordings</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 text-muted">
                              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{m.nextSession ? `Next: ${fmtDate(m.nextSession.start, false)}, ${fmtTime(m.nextSession.start)}` : "No upcoming class"}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 font-semibold text-brand">View <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </DataGate>
  );
}
