import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, UserX } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} />;

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-6 h-40 rounded-[2rem]" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-rose-500" />}
        title="Something went wrong"
        text={message}
        action={onRetry && <Button onClick={onRetry}>Try again</Button>}
      />
    </Card>
  );
}

export function NotLinkedState() {
  return (
    <Card>
      <EmptyState
        icon={<UserX className="h-6 w-6" />}
        title="Your account isn't linked to a student record yet"
        text="Modules, classes and payments appear once the institute links your portal account to your enrolment. Ask the front desk for your student ID, then register again with it."
        action={
          <Link to="/student/register">
            <Button variant="secondary">Register with a student ID</Button>
          </Link>
        }
      />
    </Card>
  );
}

/** Renders loading / error / not-linked states, otherwise the page content. */
export function DataGate({ loading, error, linked, data, onRetry, children, cards }: { loading: boolean; error: string | null; linked?: boolean; data: unknown; onRetry: () => void; children: ReactNode; cards?: number }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || !data) return <PageSkeleton cards={cards} />;
  if (linked === false) return <NotLinkedState />;
  return <>{children}</>;
}
