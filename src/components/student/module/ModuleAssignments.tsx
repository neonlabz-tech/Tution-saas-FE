import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/primitives";
import { AssignmentBadge } from "@/components/student/badges";
import type { Assignment, AssignmentStatus } from "@/types/student";
import { cn, fmtDate, fmtTime } from "@/lib/utils";

const FILTERS: { id: "all" | AssignmentStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "submitted", label: "Submitted" },
  { id: "graded", label: "Graded" },
  { id: "overdue", label: "Overdue" },
];

function dueText(a: Assignment) {
  const diff = Math.round((new Date(`${a.dueDate.slice(0, 10)}T00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  if (a.status === "graded" || a.status === "submitted") return `Due ${fmtDate(a.dueDate)}`;
  if (diff === 0) return "Due today";
  if (diff > 0) return `Due in ${diff} day${diff > 1 ? "s" : ""}`;
  return `Overdue by ${-diff} day${diff < -1 ? "s" : ""}`;
}

export function ModuleAssignments({ assignments }: { assignments: Assignment[] }) {
  const [filter, setFilter] = useState<"all" | AssignmentStatus>("all");
  const sorted = useMemo(() => [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assignments]);
  const shown = filter === "all" ? sorted : sorted.filter((a) => a.status === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter assignments">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? assignments.length : assignments.filter((a) => a.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn("cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition", filter === f.id ? "border-primary bg-primary/10 text-brand" : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink")}
            >
              {f.label} <span className="num ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        {shown.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-bold">{a.title}</h3>
                <p className="mt-1 max-w-3xl text-sm text-muted">{a.description}</p>
              </div>
              <AssignmentBadge status={a.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span className={cn("flex items-center gap-1.5", a.status === "overdue" && "font-semibold text-rose-500")}>
                <CalendarClock className="h-3.5 w-3.5" />
                <span><span className="font-semibold">{dueText(a)}</span> · {fmtDate(a.dueDate)} at {fmtTime(a.dueDate)}</span>
              </span>
              {a.submittedAt && <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Submitted {fmtDate(a.submittedAt)}</span>}
              {a.status === "graded" && a.marks !== undefined && <span className="num font-bold text-ink">Marks: {a.marks} / {a.maxMarks}</span>}
              {a.status !== "graded" && <span className="num">Max marks: {a.maxMarks}</span>}
            </div>
          </Card>
        ))}
        {shown.length === 0 && (
          <Card>
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No assignments here" text={filter === "all" ? "Your teacher hasn't posted any assignments for this module yet." : "No assignments match this filter."} />
          </Card>
        )}
      </div>
    </div>
  );
}
