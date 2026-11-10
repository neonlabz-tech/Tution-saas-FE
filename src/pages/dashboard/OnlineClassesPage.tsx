import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Plus, Video } from "lucide-react";
import type { OnlineClass } from "@/types";
import { Badge, Button, Card, CardHeader, Field, PageHeader, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { ClassFormModal, type ClassDraft } from "@/components/calendar/ClassFormModal";
import { COLORS } from "@/components/analytics/chartParts";
import { fmtTime, pad, toLocalDT } from "@/lib/utils";

export default function OnlineClassesPage() {
  const { classes, modules, teachers, getModule, getTeacher, patchClass, deleteClass } = useAppData();
  const toast = useToast();
  const [teacher, setTeacher] = useState("all");
  const [moduleId, setModuleId] = useState("all");
  const [batch, setBatch] = useState("all");
  const [form, setForm] = useState<{ open: boolean; item: OnlineClass | null; draft: ClassDraft }>({ open: false, item: null, draft: {} });
  const [delId, setDelId] = useState<string | null>(null);

  const filtered = useMemo(
    () => classes.filter((c) => (teacher === "all" || c.teacherId === teacher) && (moduleId === "all" || c.moduleId === moduleId) && (batch === "all" || c.batch === batch)),
    [classes, teacher, moduleId, batch],
  );
  const events = useMemo(
    () =>
      filtered.map((c) => {
        const color = COLORS[Math.max(0, modules.findIndex((m) => m.id === c.moduleId)) % COLORS.length];
        return { id: c.id, title: c.title, start: c.start, end: c.end, backgroundColor: color, borderColor: color, textColor: "#fff", classNames: c.status === "cancelled" ? ["opacity-50", "line-through"] : [] };
      }),
    [filtered, modules],
  );
  const upcoming = useMemo(() => {
    const now = toLocalDT(new Date());
    return filtered.filter((c) => c.status === "scheduled" && c.end >= now).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 7);
  }, [filtered]);

  const fmtRange = (s: Date, e: Date | null) => ({ start: toLocalDT(s), end: toLocalDT(e ?? new Date(s.getTime() + 90 * 60000)) });
  const onDrop = (info: EventDropArg | EventResizeDoneArg) => {
    const { start, end } = fmtRange(info.event.start!, info.event.end);
    patchClass(info.event.id, { start, end });
    toast.success(`Class moved to ${start.slice(0, 10)} · ${fmtTime(start)}–${fmtTime(end)}`);
  };
  const openNew = (date?: string, startTime?: string, endTime?: string) => setForm({ open: true, item: null, draft: { date, startTime, endTime } });
  const onDateClick = (a: DateClickArg) => {
    const d = a.date;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (a.allDay) openNew(date);
    else openNew(date, `${pad(d.getHours())}:${pad(d.getMinutes())}`, `${pad(new Date(d.getTime() + 90 * 60000).getHours())}:${pad(new Date(d.getTime() + 90 * 60000).getMinutes())}`);
  };
  const delC = delId ? classes.find((c) => c.id === delId) : undefined;
  const initialView = typeof window !== "undefined" && window.innerWidth < 768 ? "listWeek" : "timeGridWeek";

  return (
    <>
      <PageHeader title="Online Classes" description="Schedule live sessions. Drag to reschedule, resize to change duration, click an event to edit." actions={<Button onClick={() => openNew()}><Plus className="h-4 w-4" /> Schedule class</Button>} />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Teacher"><Select value={teacher} onChange={(e) => setTeacher(e.target.value)}><option value="all">All teachers</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>
        <Field label="Module"><Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}><option value="all">All modules</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Batch"><Select value={batch} onChange={(e) => setBatch(e.target.value)}><option value="all">All batches</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="min-w-0 p-4 sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={initialView}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
            buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "List" }}
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
            dateClick={onDateClick}
            eventClick={(info: EventClickArg) => setForm({ open: true, item: classes.find((c) => c.id === info.event.id) ?? null, draft: {} })}
            eventDrop={onDrop}
            eventResize={onDrop}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader title="Upcoming classes" subtitle={`${upcoming.length} next sessions`} />
          <div className="space-y-2 p-4">
            {upcoming.length === 0 && <p className="py-6 text-center text-sm text-muted">No upcoming classes for this filter.</p>}
            {upcoming.map((c) => {
              const idx = Math.max(0, modules.findIndex((m) => m.id === c.moduleId));
              return (
                <button key={c.id} onClick={() => setForm({ open: true, item: c, draft: {} })} className="flex w-full cursor-pointer gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-primary/40 hover:bg-surface-2">
                  <span className="w-1 shrink-0 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm font-bold">{c.title}</span>
                    <span className="num mt-0.5 block text-[11px] text-muted">{c.start.slice(5, 10)} · {fmtTime(c.start)} – {fmtTime(c.end)}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5"><Badge tone="primary">{getModule(c.moduleId)?.code}</Badge><span className="truncate text-[11px] text-muted">{getTeacher(c.teacherId)?.fullName}</span></span>
                  </span>
                  <a href={c.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Join" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand hover:bg-primary/20"><Video className="h-4 w-4" /></a>
                </button>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-2">
              {modules.slice(0, 8).map((m, i) => <span key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{m.code.split("-")[0]}</span>)}
            </div>
          </div>
        </Card>
      </div>

      <ClassFormModal open={form.open} item={form.item} draft={form.draft} onClose={() => setForm((f) => ({ ...f, open: false }))} onDelete={(id) => setDelId(id)} />
      <ConfirmDialog
        open={!!delC}
        onClose={() => setDelId(null)}
        title="Delete online class?"
        text={<><b>{delC?.title}</b> will be removed from the calendar.</>}
        onConfirm={() => { if (delId) { deleteClass(delId); setForm((f) => ({ ...f, open: false })); toast.success("Online class deleted"); } }}
      />
    </>
  );
}
