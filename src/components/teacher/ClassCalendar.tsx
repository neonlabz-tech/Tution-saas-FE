import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg } from "@fullcalendar/core";
import { Ban, CalendarClock, CalendarDays, ExternalLink, MapPin, Video } from "lucide-react";
import { Button, Card, Field, InfoRow, Select, Textarea } from "@/components/ui/primitives";
import { Drawer, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { changeClass } from "@/lib/teacherApi";
import { MAX_REASON, canChangeClass } from "@/lib/teacherPolicy";
import { ClassKindBadge, ClassStatusBadge, ONLINE_COLOR, PHYSICAL_COLOR, POSTPONED_COLOR, CANCELLED_COLOR } from "@/components/teacher/badges";
import type { TeacherClass } from "@/types/teacher";
import { fmtDate, fmtTime, toLocalDT } from "@/lib/utils";

const longDate = (dt: string) => new Date(`${dt.slice(0, 10)}T00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function colorOf(c: TeacherClass) {
  if (c.status === "cancelled") return CANCELLED_COLOR;
  if (c.status === "postponed") return POSTPONED_COLOR;
  return c.kind === "online" ? ONLINE_COLOR : PHYSICAL_COLOR;
}

export function ClassCalendar({ classes, showFilter = true }: { classes: TeacherClass[]; showFilter?: boolean }) {
  const { actor, batches, patchClass } = useTeacherPortal();
  const toast = useToast();
  const [batchId, setBatchId] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<"cancel" | "postpone" | null>(null);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => (batchId === "all" ? classes : classes.filter((c) => c.batchId === batchId)), [classes, batchId]);
  const open = classes.find((c) => c.id === openId) ?? null;
  const events = useMemo(
    () =>
      visible.map((c) => ({
        id: c.id,
        title: `${c.moduleName} · ${c.batch}`,
        start: c.start,
        end: c.end,
        backgroundColor: colorOf(c),
        borderColor: colorOf(c),
        textColor: "#fff",
        classNames: [c.status === "cancelled" ? "line-through opacity-60" : "", c.status === "completed" ? "opacity-70" : "", c.kind === "physical" ? "tch-physical" : "tch-online"],
      })),
    [visible],
  );
  const initialView = typeof window !== "undefined" && window.innerWidth < 768 ? "listMonth" : "dayGridMonth";
  const allowed = open && actor ? canChangeClass(open, actor) : false;
  const canJoin = open?.kind === "online" && !!open.link && (open.status === "scheduled" || open.status === "postponed") && open.end >= toLocalDT(new Date());

  const begin = (a: "cancel" | "postpone") => {
    if (!open) return;
    setAction(a);
    setReason("");
    setErr(null);
    setStart(open.start);
    setEnd(open.end);
  };
  const closeAction = () => !busy && setAction(null);

  const submit = async () => {
    if (!open || !actor || !action) return;
    setBusy(true);
    setErr(null);
    try {
      const { updated, notified } = await changeClass(actor, open, action === "cancel" ? { type: "cancel", reason } : { type: "postpone", reason, start, end });
      patchClass(updated);
      setAction(null);
      toast.success(action === "cancel" ? "Class cancelled" : "Class rescheduled");
      if (!notified) toast.error("Saved, but we couldn't send the student notification. Please tell the batch directly.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Calendar legend">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ONLINE_COLOR }} />Online</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PHYSICAL_COLOR }} />Physical</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POSTPONED_COLOR }} />Postponed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CANCELLED_COLOR }} />Cancelled</span>
          </div>
          {showFilter && batches.length > 1 && (
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} aria-label="Filter calendar by batch" className="h-9 w-full sm:w-64">
              <option value="all">All my batches</option>
              {batches.map((b) => (<option key={b.id} value={b.id}>{b.moduleName} · {b.batch}</option>))}
            </Select>
          )}
        </div>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView={initialView}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" }}
          buttonText={{ today: "Today", month: "Month", week: "Week", list: "List" }}
          events={events}
          eventClick={(i: EventClickArg) => setOpenId(i.event.id)}
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

      <Drawer
        open={!!open && !action}
        onClose={() => setOpenId(null)}
        title={open?.title}
        description={open ? `${open.moduleCode} · ${open.batch}` : undefined}
        footer={
          open && (
            <div className="flex flex-wrap justify-end gap-2">
              {canJoin && (<a href={open.link} target="_blank" rel="noreferrer noopener"><Button><Video className="h-4 w-4" /> Join class <ExternalLink className="h-3.5 w-3.5" /></Button></a>)}
              {allowed && (<Button variant="secondary" onClick={() => begin("postpone")}><CalendarClock className="h-4 w-4" /> Postpone</Button>)}
              {allowed && (<Button variant="danger" onClick={() => begin("cancel")}><Ban className="h-4 w-4" /> Cancel class</Button>)}
              {!canJoin && !allowed && <Button variant="secondary" onClick={() => setOpenId(null)}>Close</Button>}
            </div>
          )
        }
      >
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><ClassKindBadge kind={open.kind} /><ClassStatusBadge status={open.status} /></div>
            <div className="divide-y divide-line rounded-2xl border border-line px-4">
              <InfoRow label="Subject">{open.moduleName}</InfoRow>
              <InfoRow label="Batch">{open.batch}</InfoRow>
              <InfoRow label="Date">{longDate(open.start)}</InfoRow>
              <InfoRow label="Time"><span className="num">{fmtTime(open.start)} – {fmtTime(open.end)}</span></InfoRow>
              {open.kind === "physical" ? <InfoRow label="Location"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{open.location}</span></InfoRow> : <InfoRow label="Meeting link"><span className="break-all text-xs">{open.link || "—"}</span></InfoRow>}
            </div>
            {open.status === "postponed" && open.originalStart && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Moved from {fmtDate(open.originalStart, false)}, {fmtTime(open.originalStart)}.</p>
            )}
            {open.reason && (<div><p className="mb-1 text-xs font-semibold text-muted">Reason given to students</p><p className="rounded-xl bg-surface-2 p-3 text-sm">{open.reason}</p></div>)}
            {!allowed && open.status !== "cancelled" && open.status !== "completed" && <p className="text-xs text-muted">This class can no longer be changed.</p>}
            <p className="text-[11px] text-muted">Teachers can cancel or postpone their own classes. New classes are scheduled by the front office.</p>
          </div>
        )}
      </Drawer>

      <Modal
        open={!!open && !!action}
        onClose={closeAction}
        size="sm"
        title={action === "cancel" ? "Cancel this class?" : "Postpone this class"}
        description={open ? `${open.title} · ${open.batch}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={closeAction} disabled={busy}>Keep class</Button>
            <Button variant={action === "cancel" ? "danger" : "primary"} loading={busy} onClick={() => void submit()}>{action === "cancel" ? "Cancel class" : "Confirm new time"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {action === "postpone" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New start"><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm" aria-label="New start" /></Field>
              <Field label="New end"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm" aria-label="New end" /></Field>
            </div>
          )}
          <Field label="Reason (shown to students)" error={err ?? undefined} hint={`${reason.trim().length}/${MAX_REASON}`}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === "cancel" ? "e.g. I'm unwell and can't teach today" : "e.g. Moved because of a clash with the exam schedule"} maxLength={MAX_REASON} />
          </Field>
          <p className="flex items-start gap-2 text-xs text-muted"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />Students in {open?.batch} are notified automatically.</p>
        </div>
      </Modal>
    </>
  );
}
