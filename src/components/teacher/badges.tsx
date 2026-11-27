import { Badge, type Tone } from "@/components/ui/primitives";
import type { TeacherClassKind, TeacherClassStatus } from "@/types/teacher";

const dot = <span className="h-1.5 w-1.5 rounded-full bg-current" />;
const STATUS: Record<TeacherClassStatus, { tone: Tone; label: string }> = {
  scheduled: { tone: "primary", label: "Scheduled" },
  completed: { tone: "green", label: "Completed" },
  cancelled: { tone: "rose", label: "Cancelled" },
  postponed: { tone: "amber", label: "Postponed" },
};
export const ClassStatusBadge = ({ status }: { status: TeacherClassStatus }) => (
  <Badge tone={STATUS[status].tone}>{dot}{STATUS[status].label}</Badge>
);
export const ClassKindBadge = ({ kind }: { kind: TeacherClassKind }) => <Badge tone={kind === "online" ? "primary" : "teal"}>{kind === "online" ? "Online" : "Physical"}</Badge>;

export const ONLINE_COLOR = "#4F46E5";
export const PHYSICAL_COLOR = "#14B8A6";
export const POSTPONED_COLOR = "#D97706";
export const CANCELLED_COLOR = "#94A3B8";
