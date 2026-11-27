import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin, Video } from "lucide-react";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { useOptionalStudentData } from "@/hooks/useStudentData";
import type { OnlineClass } from "@/types";
import type { PhysicalClass } from "@/types/student";
import { fmtDate, fmtTime, toLocalDT } from "@/lib/utils";

const ONLINE = "#4F46E5";
const PHYSICAL = "#14B8A6";

type Session = { kind: "online"; item: OnlineClass } | { kind: "physical"; item: PhysicalClass };

export function ModuleCalendar({ online, physical }: { online: OnlineClass[]; physical: PhysicalClass[] }) {
  const [open, setOpen] = useState<Session | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);
  const [title, setTitle] = useState("");
  const [currentView, setCurrentView] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "listMonth" : "dayGridMonth"
  );

  const studentData = useOptionalStudentData();
  const instituteName = studentData?.data?.instituteName || "On-site Campus";

  const sessions = useMemo<Session[]>(
    () => [...online.map((item) => ({ kind: "online" as const, item })), ...physical.map((item) => ({ kind: "physical" as const, item }))],
    [online, physical],
  );
  const events = useMemo(() => {
    const now = toLocalDT(new Date());
    return sessions.map((s) => {
      const isPast = s.item.end < now;
      const isCancelled = s.item.status === "cancelled";
      const isCompleted = s.item.status === "completed" || isPast;
      const color = isCancelled || isCompleted ? "#94a3b8" : s.kind === "online" ? ONLINE : PHYSICAL;
      const baseTitle = s.item.title?.trim() || (s.kind === "online" ? "Online" : "On-site");
      return {
        id: `${s.kind}:${s.item.id}`,
        title: isCompleted ? `${baseTitle} (Ended)` : baseTitle,
        start: s.item.start,
        end: s.item.end,
        backgroundColor: color,
        borderColor: color,
        textColor: "#fff",
        classNames: isCancelled
          ? ["opacity-50", "line-through"]
          : isCompleted
            ? ["opacity-50", "filter", "grayscale-[50%]"]
            : [],
      };
    });
  }, [sessions]);
  const upcoming = useMemo(() => {
    const now = toLocalDT(new Date());
    return sessions.filter((s) => s.item.status === "scheduled" && s.item.end >= now).sort((a, b) => a.item.start.localeCompare(b.item.start)).slice(0, 6);
  }, [sessions]);

  const onEvent = (info: EventClickArg) => {
    const [kind, ...rest] = info.event.id.split(":");
    const id = rest.join(":");
    setOpen(sessions.find((s) => s.kind === kind && s.item.id === id) ?? null);
  };

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
    calendarRef.current?.getApi().changeView(newView);
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ONLINE }} />Online class</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PHYSICAL }} />Physical class</span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => calendarRef.current?.getApi().prev()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink hover:bg-surface-2 transition cursor-pointer"
                  aria-label="Previous"
                  title="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => calendarRef.current?.getApi().next()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink hover:bg-surface-2 transition cursor-pointer"
                  aria-label="Next"
                  title="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => calendarRef.current?.getApi().today()}
                className="h-9 px-3 text-xs font-semibold"
              >
                Today
              </Button>
            </div>

            <h2 className="order-first w-full text-center font-heading text-lg font-bold text-ink sm:order-none sm:w-auto">
              {title}
            </h2>

            <div className="w-32">
              <Select
                value={currentView}
                onChange={(e) => handleViewChange(e.target.value)}
                aria-label="Calendar view"
                className="h-9 text-xs font-semibold"
              >
                <option value="dayGridMonth">Month</option>
                <option value="timeGridWeek">Week</option>
                <option value="listMonth">List</option>
              </Select>
            </div>
          </div>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={currentView}
            headerToolbar={false}
            datesSet={(arg: DatesSetArg) => {
              setTitle(arg.view.title);
              setCurrentView(arg.view.type);
            }}
            events={events}
            eventClick={onEvent}
            dayMaxEvents={3}
            nowIndicator
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            firstDay={1}
            noEventsText="No classes scheduled"
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader title="Upcoming sessions" subtitle={`${upcoming.length} next classes`} />
          <div className="space-y-2 p-4">
            {upcoming.length === 0 && <p className="py-6 text-center text-sm text-muted"><CalendarClock className="mx-auto mb-2 h-6 w-6" />No upcoming sessions.</p>}
            {upcoming.map((s) => (
              <button key={`${s.kind}${s.item.id}`} onClick={() => setOpen(s)} className="flex w-full cursor-pointer gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-primary/40 hover:bg-surface-2">
                <span className="w-1 shrink-0 rounded-full" style={{ background: s.kind === "online" ? ONLINE : PHYSICAL }} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm font-bold">{s.item.title.replace(/\s\(on-site\)$/, "")}</span>
                  <span className="num mt-0.5 block text-[11px] text-muted">{fmtDate(s.item.start, false)} · {fmtTime(s.item.start)} – {fmtTime(s.item.end)}</span>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <Badge tone={s.kind === "online" ? "primary" : "teal"}>{s.kind === "online" ? "Online" : "On-site"}</Badge>
                    {s.kind === "physical" && <span className="truncate text-[11px] text-muted">{s.item.location}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        size="sm"
        title={open?.item.title.replace(/\s\(on-site\)$/, "")}
        description={open ? `${open.kind === "online" ? "Online class" : "Physical class"} · ${open.item.status}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
            {open?.kind === "online" && open.item.status === "scheduled" && open.item.end >= toLocalDT(new Date()) && (
              <a href={open.item.link} target="_blank" rel="noreferrer"><Button><Video className="h-4 w-4" /> Join class <ExternalLink className="h-3.5 w-3.5" /></Button></a>
            )}
            {open?.kind === "online" && (open.item.status !== "scheduled" || open.item.end < toLocalDT(new Date())) && (
              <Button variant="secondary" disabled><Clock className="h-4 w-4" /> Class ended</Button>
            )}
          </>
        }
      >
        {open && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><div><p className="font-semibold">{new Date(`${open.item.start.slice(0, 10)}T00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><p className="num text-muted">{fmtTime(open.item.start)} – {fmtTime(open.item.end)}</p></div></div>
            {open.kind === "physical" ? (
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><div><p className="font-semibold">{open.item.location}</p><p className="text-muted">{instituteName}</p></div></div>
            ) : (
              <div className="flex items-start gap-3"><Video className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><p className="text-muted">{open.item.description}</p></div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
