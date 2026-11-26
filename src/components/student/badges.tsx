import { Badge, type Tone } from "@/components/ui/primitives";
import type { AssignmentStatus, DueStatus, PaymentStatus } from "@/types/student";

const dot = <span className="h-1.5 w-1.5 rounded-full bg-current" />;
const make = <K extends string>(map: Record<K, { tone: Tone; label: string }>) =>
  function StatusPill({ status }: { status: K }) {
    const { tone, label } = map[status];
    return (
      <Badge tone={tone}>
        {dot}
        {label}
      </Badge>
    );
  };

export const PaymentBadge = make<PaymentStatus>({ paid: { tone: "green", label: "Paid" }, pending: { tone: "amber", label: "Pending" } });
export const DueBadge = make<DueStatus>({ overdue: { tone: "rose", label: "Overdue" }, "due-soon": { tone: "amber", label: "Due soon" }, upcoming: { tone: "primary", label: "Upcoming" } });

export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold capitalize text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400" />
        Submitted
      </span>
    );
  }
  const toneMap: Record<AssignmentStatus, Tone> = {
    pending: "amber",
    submitted: "rose",
    graded: "green",
    overdue: "rose",
  };
  const labels: Record<AssignmentStatus, string> = {
    pending: "Pending",
    submitted: "Submitted",
    graded: "Graded",
    overdue: "Overdue",
  };
  return (
    <Badge tone={toneMap[status] ?? "neutral"}>
      {dot}
      {labels[status] ?? status}
    </Badge>
  );
}
