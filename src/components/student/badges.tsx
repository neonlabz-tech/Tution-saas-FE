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
export const AssignmentBadge = make<AssignmentStatus>({
  pending: { tone: "amber", label: "Pending" },
  submitted: { tone: "primary", label: "Submitted" },
  graded: { tone: "green", label: "Graded" },
  overdue: { tone: "rose", label: "Overdue" },
});
