import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarClock, ClipboardList, Clock, FolderOpen, MapPin, MonitorPlay, RotateCcw, Video, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui/primitives";
import { DataGate } from "@/components/student/states";
import { COLORS } from "@/components/analytics/chartParts";
import { useStudentData } from "@/hooks/useStudentData";
import { fmtDate, fmtTime } from "@/lib/utils";

export default function StudentModulesPage() {
  const { data, loading, error, reload } = useStudentData();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "all");

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) {
      next.set("q", q.trim());
    } else {
      next.delete("q");
    }
    if (status && status !== "all") {
      next.set("status", status);
    } else {
      next.delete("status");
    }
    setParams(next, { replace: true });
  }, [q, status, setParams]);

  const counts = useMemo(() => {
    const all = data?.modules ?? [];
    return {
      all: all.length,
      active: all.filter((m) => (m.status ?? "active").toLowerCase() === "active").length,
      upcoming: all.filter((m) => (m.status ?? "").toLowerCase() === "upcoming").length,
      archived: all.filter((m) => (m.status ?? "").toLowerCase() === "archived").length,
    };
  }, [data?.modules]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const st = status.toLowerCase();

    return (data?.modules ?? []).filter((m) => {
      const mStatus = (m.status ?? "active").toLowerCase();
      const statusMatches = st === "all" || mStatus === st;
      if (!statusMatches) return false;

      if (!s) return true;
      return (
        m.name.toLowerCase().includes(s) ||
        m.code.toLowerCase().includes(s) ||
        (m.description ?? "").toLowerCase().includes(s) ||
        (m.teacher?.fullName ?? "").toLowerCase().includes(s) ||
        (m.teacher?.specialization ?? "").toLowerCase().includes(s) ||
        (m.onlineSchedule ?? "").toLowerCase().includes(s) ||
        (m.physicalSchedule ?? "").toLowerCase().includes(s)
      );
    });
  }, [data?.modules, q, status]);

  const handleReset = () => {
    setQ("");
    setStatus("all");
  };

  const hasActiveFilters = Boolean(q.trim() || (status && status !== "all"));

  return (
    <DataGate loading={loading} error={error} linked={data?.linked} data={data} onRetry={reload} cards={3}>
      {data && (
        <>
          <PageHeader
            title="My Modules"
            description={`You're registered for ${data.modules.length} module${data.modules.length === 1 ? "" : "s"}. Select a module to see its calendar, assignments, materials and recordings.`}
          />

          <Card className="mb-6 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <SearchInput
                placeholder="Search modules by name, code, teacher, or topic…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search modules"
              />
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses ({counts.all})</option>
                <option value="active">Active ({counts.active})</option>
                <option value="upcoming">Upcoming ({counts.upcoming})</option>
                <option value="archived">Archived ({counts.archived})</option>
              </Select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "All", count: counts.all },
                    { id: "active", label: "Active", count: counts.active },
                    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
                    { id: "archived", label: "Archived", count: counts.archived },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatus(pill.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                      status === pill.id
                        ? "bg-brand text-white shadow-sm"
                        : "bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-ink"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        status === pill.id
                          ? "bg-white/20 text-white"
                          : "bg-surface text-muted"
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2">
                  <span className="text-muted">
                    Showing <b className="text-ink">{filtered.length}</b> of {data.modules.length}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReset}
                    className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title={data.modules.length === 0 ? "No registered modules" : "No modules match"}
                text={
                  data.modules.length === 0
                    ? "You haven't been enrolled in any modules yet. Contact the front desk to register."
                    : "Try a different search query or change your status filter."
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4" /> Reset filters
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
