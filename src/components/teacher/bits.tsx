import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Users } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { ErrorState, PageSkeleton } from "@/components/student/states";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { ForbiddenError } from "@/lib/teacherPolicy";
import { useToast } from "@/components/ui/toast";

/** Loading / error gate shared by every teacher page. */
export function TeacherGate({ children, cards }: { children: ReactNode; cards?: number }) {
  const { loading, error, profile, reload } = useTeacherPortal();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !profile) return <PageSkeleton cards={cards} />;
  return <>{children}</>;
}

export function NoAccess({ text = "This batch isn't assigned to you, so you can't open it." }: { text?: string }) {
  return (
    <Card>
      <EmptyState icon={<ShieldAlert className="h-6 w-6 text-rose-500" />} title="You don't have access to this" text={text} action={<Link to="/teacher/batches"><Button variant="secondary"><Users className="h-4 w-4" /> My batches</Button></Link>} />
    </Card>
  );
}

/** Uniform error → toast mapping for service calls. */
export function useReport() {
  const toast = useToast();
  return (e: unknown, fallback = "Something went wrong. Please try again.") => toast.error(e instanceof ForbiddenError || e instanceof Error ? e.message : fallback);
}
export const fmtSize = (b?: number) => (!b ? "" : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
