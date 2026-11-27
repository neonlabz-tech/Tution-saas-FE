import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { useAuth } from "@/hooks/useAuth";
import { TeacherPortalProvider } from "@/hooks/useTeacherPortal";

/** Layout route for /teacher/*: scopes the teacher data provider away from the admin and student apps. */
export function TeacherRoot() {
  return (
    <TeacherPortalProvider>
      <Outlet />
    </TeacherPortalProvider>
  );
}

/** Role guard: only a signed-in user whose role is exactly "teacher" may enter. */
export function RequireTeacher({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">Verifying session...</div>;
  if (!user) return <Navigate to="/teacher/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== "teacher") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <Card className="w-full max-w-md">
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6 text-rose-500" />}
            title="This area is for teachers"
            text={`You're signed in as ${user.role.replace("_", " ")}. Sign in with a teacher account to open the Teacher Dashboard.`}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void logout()}>Sign out</Button>
                <a href={user.role === "student" ? "/student" : "/dashboard"}><Button>Go to my dashboard</Button></a>
              </div>
            }
          />
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
