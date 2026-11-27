import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import {
  AlertCircle,
  CalendarDays,
  List,
  MapPin,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  Video,
} from "lucide-react";
import type { ClassStatus, ModuleListItem, OnlineClassItem } from "@/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { listModules } from "@/api/modules";
import { deleteOnlineClass, updateOnlineClass } from "@/api/onlineClasses";
import { useOnlineClasses } from "@/hooks/useOnlineClasses";
import { teachersApi, type TeacherListItem } from "@/lib/api";
import { useBatches } from "@/hooks/useBatches";
import { ClassDetailDrawer } from "@/components/calendar/ClassDetailDrawer";
import { ClassFormModal, type ClassDraft } from "@/components/calendar/ClassFormModal";
import { COLORS } from "@/components/analytics/chartParts";
import { cn, formatShortDate, formatTime, pad, toISO, toLocalDT } from "@/lib/utils";

export default function OnlineClassesPage() {
  const toast = useToast();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [teacher, setTeacher] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const [calendarRange, setCalendarRange] = useState<{ from: string; to: string } | null>(null);

  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const { batches: batchOptions } = useBatches();

  const [form, setForm] = useState<{ open: boolean; item: OnlineClassItem | null; draft: ClassDraft }>({
    open: false,
    item: null,
    draft: {},
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [delTarget, setDelTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listModules({}, controller.signal)
      .then(setModules)
      .catch(() => {
        /* ignore offline dropdown */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    teachersApi
      .list()
      .then((res) => {
        if (active) setTeachers(res.data ?? []);
      })
      .catch(() => {
        /* ignore offline dropdown */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === debouncedQ) return;
    const timer = window.setTimeout(() => setDebouncedQ(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [q, debouncedQ]);

  const {
    data: classes,
    setData: setClasses,
    loading,
    error,
    refetch,
  } = useOnlineClasses({
    teacherId: teacher,
    moduleId,
    batch,
    status: status as ClassStatus | "all",
    from: view === "calendar" ? calendarRange?.from : undefined,
    to: view === "calendar" ? calendarRange?.to : undefined,
    q: debouncedQ || undefined,
  });

  useEffect(() => {
    if (view !== "calendar") return;
    const timer = setTimeout(() => {
      const prevBtn = document.querySelector(".fc-prev-button");
      const nextBtn = document.querySelector(".fc-next-button");
      if (prevBtn) {
        prevBtn.setAttribute("aria-label", "Previous");
        prevBtn.setAttribute("title", "Previous");
      }
      if (nextBtn) {
        nextBtn.setAttribute("aria-label", "Next");
        nextBtn.setAttribute("title", "Next");
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [view, calendarRange]);

  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const moduleIndexMap = useMemo(() => new Map(modules.map((m, idx) => [m.id, idx])), [modules]);

  const resolveModuleCode = useCallback(
    (c: OnlineClassItem) => c.module?.code ?? c.moduleCode ?? moduleMap.get(c.moduleId)?.code ?? "—",
    [moduleMap],
  );
  const resolveTeacherName = useCallback(
    (c: OnlineClassItem) =>
      c.teacher?.fullName ?? c.teacherName ?? teacherMap.get(c.teacherId)?.fullName ?? "—",
    [teacherMap],
  );

  const events = useMemo(() => {
    const now = toLocalDT(new Date());
    return classes.map((c) => {
      const idx = moduleIndexMap.get(c.moduleId) ?? 0;
      const baseColor = COLORS[idx % COLORS.length];
      const isPast = c.end < now;
      const isCancelled = c.status === "cancelled";
      const isCompleted = c.status === "completed";
      const isEnded = isPast || isCompleted;
      const editable = !isPast && !isCancelled && !isCompleted;

      return {
        id: c.id,
        title: isCancelled
          ? `${c.title} (Cancelled)`
          : isEnded
            ? `${c.title} (Ended)`
            : c.title,
        start: c.start,
        end: c.end,
        backgroundColor: isCancelled || isEnded ? "#94a3b8" : baseColor,
        borderColor: isCancelled || isEnded ? "#64748b" : baseColor,
        textColor: "#fff",
        editable,
        startEditable: editable,
        durationEditable: editable,
        classNames: isCancelled
          ? ["opacity-45", "line-through", "!cursor-default"]
          : isEnded
            ? ["opacity-50", "filter", "grayscale-[50%]", "!cursor-default"]
            : [],
      };
    });
  }, [classes, moduleIndexMap]);

  const upcoming = useMemo(() => {
    const now = toLocalDT(new Date());
    return classes
      .filter((c) => c.status === "scheduled" && c.end >= now)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 7);
  }, [classes]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const from = toISO(arg.start);
    const to = toISO(arg.end);
    setCalendarRange((prev) =>
      prev && prev.from === from && prev.to === to ? prev : { from, to },
    );
  }, []);

  const fmtRange = (s: Date, e: Date | null) => ({
    start: toLocalDT(s),
    end: toLocalDT(e ?? new Date(s.getTime() + 90 * 60000)),
  });

  const onDrop = async (info: EventDropArg | EventResizeDoneArg) => {
    if (!info.event.start) return;
    const now = toLocalDT(new Date());
    const existing = classes.find((c) => c.id === info.event.id);
    if (existing && (existing.end < now || existing.status !== "scheduled")) {
      info.revert();
      toast.error("Past or completed classes cannot be rescheduled");
      return;
    }
    const { start, end } = fmtRange(info.event.start, info.event.end);
    if (end < now) {
      info.revert();
      toast.error("Cannot move class to a past time");
      return;
    }
    const id = info.event.id;
    const prevClasses = classes;

    setClasses((cur) => cur.map((c) => (c.id === id ? { ...c, start, end } : c)));
    try {
      const updated = await updateOnlineClass(id, { start, end });
      setClasses((cur) => cur.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      if (detailId === id) setDetailRefreshKey((k) => k + 1);
      toast.success(`Class moved to ${start.slice(0, 10)} · ${formatTime(start)}–${formatTime(end)}`);
    } catch (err: unknown) {
      info.revert();
      setClasses(prevClasses);
      toast.error(err instanceof Error ? err.message : "Could not reschedule class");
    }
  };

  const openNew = (date?: string, startTime?: string, endTime?: string) =>
    setForm({ open: true, item: null, draft: { date, startTime, endTime } });

  const onDateClick = (a: DateClickArg) => {
    const d = a.date;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (a.allDay) {
      openNew(date);
    } else {
      const endD = new Date(d.getTime() + 90 * 60000);
      openNew(
        date,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        `${pad(endD.getHours())}:${pad(endD.getMinutes())}`,
      );
    }
  };

  const columns = useMemo<Columns<OnlineClassItem>>(
    () => [
      {
        id: "title",
        header: "Class",
        accessorFn: (c) => c.title,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.original.title}</p>
            <p className="text-[11px] text-muted">{row.original.batch}</p>
          </div>
        ),
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (c) => resolveModuleCode(c),
        cell: (c) => <Badge tone="primary">{c.getValue() as string}</Badge>,
      },
      {
        id: "teacher",
        header: "Teacher",
        accessorFn: (c) => resolveTeacherName(c),
        cell: (c) => <span className="text-sm">{c.getValue() as string}</span>,
      },
      {
        id: "schedule",
        header: "Schedule",
        accessorFn: (c) => c.start,
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{formatShortDate(row.original.start)}</p>
            <p className="num text-[11px] text-muted">
              {formatTime(row.original.start)} – {formatTime(row.original.end)}
            </p>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (c) => c.classType ?? (c.hall ? "physical" : "online"),
        cell: ({ row }) => {
          const isPhysical =
            row.original.classType === "physical" || (!!row.original.hall && !row.original.link);
          return isPhysical ? (
            <Badge tone="teal" className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {row.original.hall || "Physical"}
            </Badge>
          ) : (
            <Badge tone="primary" className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              Online
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const now = toLocalDT(new Date());
          const isPast = row.original.end < now;
          if (row.original.status === "scheduled" && isPast) {
            return (
              <Badge tone="neutral">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Ended
              </Badge>
            );
          }
          return <StatusBadge status={row.original.status} />;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const now = toLocalDT(new Date());
          const isPast = row.original.end < now;
          const isEnded = isPast || row.original.status === "completed";
          const isCancelled = row.original.status === "cancelled";

          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {row.original.link ? (
                isCancelled ? (
                  <span
                    title="Class is cancelled"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted opacity-40 cursor-not-allowed"
                  >
                    <Video className="h-4 w-4" />
                  </span>
                ) : isEnded ? (
                  <span
                    title="Class has ended"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted opacity-40 cursor-not-allowed"
                  >
                    <Video className="h-4 w-4" />
                  </span>
                ) : (
                  <a
                    href={row.original.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Join class"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-brand hover:bg-primary/10"
                  >
                    <Video className="h-4 w-4" />
                  </a>
                )
              ) : row.original.hall ? (
                <span
                  title={`Hall: ${row.original.hall}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-teal-600 dark:text-teal-400"
                >
                  <MapPin className="h-4 w-4" />
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit"
                onClick={() => setForm({ open: true, item: row.original, draft: {} })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                className="hover:text-rose-500"
                onClick={() => setDelTarget({ id: row.original.id, title: row.original.title })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [resolveModuleCode, resolveTeacherName],
  );

  const handleDeleteConfirm = async () => {
    if (!delTarget) return;
    const targetId = delTarget.id;
    try {
      await deleteOnlineClass(targetId);
      setForm((f) => (f.item?.id === targetId ? { ...f, open: false } : f));
      if (detailId === targetId) setDetailId(null);
      toast.success("Class deleted");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete class");
      throw err;
    }
  };

  const initialView =
    typeof window !== "undefined" && window.innerWidth < 768 ? "listWeek" : "timeGridWeek";

  return (
    <>
      <PageHeader
        title="Classes"
        description="Schedule online and physical classes. Drag to reschedule, resize to change duration, click a session for details."
        actions={
          <>
            <Tabs
              value={view}
              onChange={setView}
              items={[
                { id: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" /> },
                { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
              ]}
            />
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Schedule class
            </Button>
          </>
        }
      />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search">
          <SearchInput
            placeholder="Search title or topic…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Field label="Teacher">
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="all">All teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Module">
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Batch">
          <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="all">All batches</option>
            {batchOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
      </Card>

      {error && view === "calendar" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {view === "list" ? (
        <Card>
          <DataTable
            data={classes}
            columns={columns}
            pageSize={10}
            loading={loading}
            error={error}
            onRetry={refetch}
            onRowClick={(c) => setDetailId(c.id)}
            emptyTitle="No online classes found"
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <Card className="relative min-w-0 p-4 sm:p-5">
            {loading && (
              <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-full bg-surface-2/90 px-3 py-1 text-xs font-semibold text-muted shadow-sm backdrop-blur">
                Syncing classes…
              </div>
            )}
            <div className={cn("transition-opacity", loading && "opacity-75")}>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                initialView={initialView}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                }}
                buttonText={{
                  today: "Today",
                  month: "Month",
                  week: "Week",
                  day: "Day",
                  list: "List",
                  prev: "Previous",
                  next: "Next",
                }}
                buttonHints={{
                  prev: "Previous",
                  next: "Next",
                  today: "Today",
                }}
                events={events}
                editable
                eventResizableFromStart
                selectable={false}
                dayMaxEvents={3}
                nowIndicator
                height="auto"
                contentHeight={640}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                firstDay={1}
                eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
                datesSet={handleDatesSet}
                dateClick={onDateClick}
                eventClick={(info: EventClickArg) => setDetailId(info.event.id)}
                eventDrop={(info) => void onDrop(info)}
                eventResize={(info) => void onDrop(info)}
              />
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Upcoming classes" subtitle={`${upcoming.length} next sessions`} />
            <div className="space-y-2 p-4">
              {loading && classes.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No upcoming classes for this filter.
                </p>
              ) : (
                upcoming.map((c) => {
                  const idx = moduleIndexMap.get(c.moduleId) ?? 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDetailId(c.id)}
                      className="flex w-full cursor-pointer gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-primary/40 hover:bg-surface-2"
                    >
                      <span
                        className="w-1 shrink-0 rounded-full"
                        style={{ background: COLORS[idx % COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-sm font-bold">{c.title}</span>
                        <span className="num mt-0.5 block text-[11px] text-muted">
                          {c.start.slice(5, 10)} · {formatTime(c.start)} – {formatTime(c.end)}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone="primary">{resolveModuleCode(c)}</Badge>
                          <span className="truncate text-[11px] text-muted">
                            {resolveTeacherName(c)}
                          </span>
                        </span>
                      </span>
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Join"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand hover:bg-primary/20"
                      >
                        <Video className="h-4 w-4" />
                      </a>
                    </button>
                  );
                })
              )}
              {modules.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {modules.slice(0, 8).map((m, i) => (
                    <span key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      {m.code.split("-")[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <ClassDetailDrawer
        classId={detailId}
        refreshKey={detailRefreshKey}
        moduleMap={moduleMap}
        teacherMap={teacherMap}
        onClose={() => setDetailId(null)}
        onEdit={(item) => setForm({ open: true, item, draft: {} })}
        onDelete={(target) => setDelTarget(target)}
        onUpdated={(updated) => {
          setClasses((cur) => cur.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
          refetch();
        }}
      />

      <ClassFormModal
        open={form.open}
        item={form.item}
        draft={form.draft}
        modules={modules}
        teachers={teachers}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onDelete={(target) => setDelTarget(target)}
        onSaved={(saved) => {
          refetch();
          if (detailId && detailId === saved.id) {
            setDetailRefreshKey((k) => k + 1);
          }
        }}
      />

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Delete online class?"
        text={
          <>
            <b>{delTarget?.title}</b> will be removed from the calendar.
          </>
        }
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
