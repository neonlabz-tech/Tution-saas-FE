import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { StudentAuthProvider, useStudentAuth } from "@/hooks/useStudentAuth";
import { StudentDataProvider } from "@/hooks/useStudentData";

/** Layout route for everything under /student: scopes the student providers away from the admin app. */
export function StudentRoot() {
  return (
    <StudentAuthProvider>
      <StudentDataProvider>
        <Outlet />
      </StudentDataProvider>
    </StudentAuthProvider>
  );
}

export function RequireStudent({ children }: { children: ReactNode }) {
  const { account, loading } = useStudentAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">Verifying session...</div>;
  }
  if (!account) {
    return <Navigate to="/student/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
