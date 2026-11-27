import { Badge } from "@/components/ui/primitives";
import type { AssignmentSubmission } from "@/types/teacher";

export function AssignmentBadge({ sub }: { sub: AssignmentSubmission | null }) {
  if (!sub?.submittedAt) return <Badge tone="rose">Not submitted</Badge>;
  if (sub.marks !== null) return <Badge tone="green">Marked</Badge>;
  return <Badge tone={sub.late ? "amber" : "primary"}>{sub.late ? "Late · to mark" : "To mark"}</Badge>;
}
