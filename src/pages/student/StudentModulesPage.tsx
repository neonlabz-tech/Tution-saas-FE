import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock, CalendarDays, ClipboardList, Clock, FolderOpen, MapPin, MonitorPlay, RotateCcw, Video, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchInput, Tabs } from "@/components/ui/primitives";
import { DataGate } from "@/components/student/states";
import { ModuleCalendar } from "@/components/student/module/ModuleCalendar";
import { COLORS } from "@/components/analytics/chartParts";
import { useStudentData } from "@/hooks/useStudentData";
import { fmtDate, fmtTime } from "@/lib/utils";

type TabType = "modules" | "timetable";

export default function StudentModulesPage() {
  const { data, loading, error, reload } = useStudentData();
  const [params, setParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const t = params.get("tab");
    return t === "timetable" ? "timetable" : "modules";
  });

  const [q, setQ] = useState(params.get("q") ?? "");

  const handleTabChange = (t: TabType) => {
    setActiveTab(t);
    const next = new URLSearchParams(params);
    if (t === "timetable") {
      next.set("tab", "timetable");
    } else {
      next.delete("tab");
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) {
      next.set("q", q.trim());
    } else {
      next.delete("q");
    }
    setParams(next, { replace: true });
  }, [q, setParams]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data?.modules ?? [];

    return (data?.modules ?? []).filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        m.code.toLowerCase().includes(s) ||
        (m.description ?? "").toLowerCase().includes(s) ||
        (m.teacher?.fullName ?? "").toLowerCase().includes(s) ||
        (m.teacher?.specialization ?? "").toLowerCase().includes(s) ||
        (m.onlineSchedule ?? "").toLowerCase().includes(s) ||
        (m.physicalSchedule ?? "").toLowerCase().includes(s),
    );
  }, [data?.modules, q]);

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload} cards={3}>
      {data && (
        <>
          <PageHeader
            title="My Modules"
            description={
              activeTab === "timetable"
                ? "Weekly class timetable and scheduled sessions for your registered modules."
                : `You're registered for ${data.modules.length} module${data.modules.length === 1 ? "" : "s"}. Select a module to see its calendar, assignments, materials and recordings.`
            }
            actions={
              <Tabs<TabType>
                value={activeTab}
                onChange={handleTabChange}
                items={[
                  { id: "modules", label: "Modules", icon: <BookOpen className="h-4 w-4" /> },
                  { id: "timetable", label: "Timetable", icon: <CalendarDays className="h-4 w-4" /> },
                ]}
              />
            }
          />

          {activeTab === "timetable" ? (
            <ModuleCalendar online={data.onlineClasses || []} physical={data.physicalClasses || []} />
          ) : (
            <>
              <Card className="mb-6 p-4">
                <SearchInput
                  placeholder="Search modules by name, code, teacher, or topic…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search modules"
                />

                {q.trim() && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-muted">
                    <span>
                      Showing <b className="text-ink">{filtered.length}</b> of {data.modules.length} registered modules
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setQ("")}
                      className="h-6 px-2 text-xs text-muted hover:text-ink"
                    >
                      <X className="h-3 w-3" /> Clear search
                    </Button>
                  </div>
                )}
              </Card>

              {filtered.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<BookOpen className="h-6 w-6" />}
                    title={data.modules.length === 0 ? "No registered modules" : "No modules match"}
                    text={
                      data.modules.length === 0
                        ? "You haven't been enrolled in any modules yet. Contact the front desk to register."
                        : "Try a different search query."
                    }
                    action={
                      q.trim() ? (
                        <Button variant="secondary" onClick={() => setQ("")}>
                          <RotateCcw className="h-4 w-4" /> Clear search
                        </Button>
                      ) : undefined
                    }
                  />
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
                              <div className="flex items-center gap-2"><Badge tone="primary">{m.code}</Badge></div>
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
        </>
      )}
    </DataGate>
  );
}
