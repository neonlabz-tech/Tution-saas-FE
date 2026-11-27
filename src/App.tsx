import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppDataProvider } from "@/hooks/useAppData";
import { ToastProvider } from "@/components/ui/toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import StudentsPage from "@/pages/dashboard/StudentsPage";
import TeachersPage from "@/pages/dashboard/TeachersPage";
import ModulesPage from "@/pages/dashboard/ModulesPage";
import AttendancePage from "@/pages/dashboard/AttendancePage";
import FinancePage from "@/pages/dashboard/FinancePage";
import PaymentsPage from "@/pages/dashboard/PaymentsPage";
import OnlineClassesPage from "@/pages/dashboard/OnlineClassesPage";
import NoticesPage from "@/pages/dashboard/NoticesPage";
import NotificationsPage from "@/pages/dashboard/NotificationsPage";
import QrScannerPage from "@/pages/dashboard/QrScannerPage";
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import { StudentRoot, RequireStudent } from "@/components/student/StudentRoot";
import { StudentLayout } from "@/components/student/StudentLayout";
import StudentLoginPage from "@/pages/student/StudentLoginPage";
import StudentRegisterPage from "@/pages/student/StudentRegisterPage";
import StudentForgotPasswordPage from "@/pages/student/StudentForgotPasswordPage";
import StudentResetPasswordPage from "@/pages/student/StudentResetPasswordPage";
import StudentOverviewPage from "@/pages/student/StudentOverviewPage";
import StudentModulesPage from "@/pages/student/StudentModulesPage";
import StudentModuleDetailPage from "@/pages/student/StudentModuleDetailPage";
import StudentPaymentsPage from "@/pages/student/StudentPaymentsPage";
import { TeacherRoot, RequireTeacher } from "@/components/teacher/TeacherRoot";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { BatchLayout } from "@/components/teacher/BatchLayout";
import TeacherLoginPage from "@/pages/teacher/TeacherLoginPage";
import TeacherOverviewPage from "@/pages/teacher/TeacherOverviewPage";
import TeacherBatchesPage from "@/pages/teacher/TeacherBatchesPage";
import BatchOverviewPage from "@/pages/teacher/BatchOverviewPage";
import BatchStudentsPage from "@/pages/teacher/BatchStudentsPage";
import BatchMaterialsPage from "@/pages/teacher/BatchMaterialsPage";
import BatchRecordingsPage from "@/pages/teacher/BatchRecordingsPage";
import BatchAssignmentsPage from "@/pages/teacher/BatchAssignmentsPage";
import AssignmentDetailPage from "@/pages/teacher/AssignmentDetailPage";
import BatchMarksPage from "@/pages/teacher/BatchMarksPage";
import TeacherNoticesPage from "@/pages/teacher/TeacherNoticesPage";
import TeacherPaymentsPage from "@/pages/teacher/TeacherPaymentsPage";
import PaymentDetailPage from "@/pages/teacher/PaymentDetailPage";

class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center text-ink">
          <div className="max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h2 className="font-heading text-lg font-bold">Something went wrong</h2>
            <p className="mt-2 text-xs text-muted">
              {this.state.error?.message || "An unexpected error occurred while loading this view."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="mt-4 cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted">Verifying session...</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Teachers have their own portal; they never see the admin dashboard.
  if (user.role === "teacher") {
    return <Navigate to="/teacher" replace />;
  }
  return <>{children}</>;
}

// Automatically migrates any legacy hash routes (e.g. /#/dashboard/...) to clean routes
function HashMigrator() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#/")) {
      const cleanPath = window.location.hash.slice(1);
      window.history.replaceState(null, "", cleanPath);
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppDataProvider>
              <BrowserRouter>
                <HashMigrator />
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route
                    path="/dashboard"
                    element={
                      <RequireAuth>
                        <DashboardLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<OverviewPage />} />
                    <Route path="students" element={<StudentsPage />} />
                    <Route path="teachers" element={<TeachersPage />} />
                    <Route path="modules" element={<ModulesPage />} />
                    <Route path="attendance" element={<AttendancePage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="online-classes" element={<OnlineClassesPage />} />
                    <Route path="notices" element={<NoticesPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="qr-scanner" element={<QrScannerPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                  {/* Student portal: /student/* (separate auth + data providers, see StudentRoot) */}
                  <Route path="/student" element={<StudentRoot />}>
                    <Route path="login" element={<StudentLoginPage />} />
                    <Route path="register" element={<StudentRegisterPage />} />
                    <Route path="forgot-password" element={<StudentForgotPasswordPage />} />
                    <Route path="reset-password" element={<StudentResetPasswordPage />} />
                    <Route
                      element={
                        <RequireStudent>
                          <StudentLayout />
                        </RequireStudent>
                      }
                    >
                      <Route index element={<StudentOverviewPage />} />
                      <Route path="modules" element={<StudentModulesPage />} />
                      <Route path="modules/:moduleId" element={<StudentModuleDetailPage />} />
                      <Route path="payments" element={<StudentPaymentsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/student" replace />} />
                  </Route>
                  {/* Teacher portal: /teacher/* (uses the real auth session; role-checked in RequireTeacher) */}
                  <Route path="/teacher" element={<TeacherRoot />}>
                    <Route path="login" element={<TeacherLoginPage />} />
                    <Route
                      element={
                        <RequireTeacher>
                          <TeacherLayout />
                        </RequireTeacher>
                      }
                    >
                      <Route index element={<TeacherOverviewPage />} />
                      <Route path="batches" element={<TeacherBatchesPage />} />
                      <Route path="batches/:batchId" element={<BatchLayout />}>
                        <Route index element={<BatchOverviewPage />} />
                        <Route path="students" element={<BatchStudentsPage />} />
                        <Route path="materials" element={<BatchMaterialsPage />} />
                        <Route path="recordings" element={<BatchRecordingsPage />} />
                        <Route path="assignments" element={<BatchAssignmentsPage />} />
                        <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
                        <Route path="marks" element={<BatchMarksPage />} />
                      </Route>
                      <Route path="notices" element={<TeacherNoticesPage />} />
                      <Route path="payments" element={<TeacherPaymentsPage />} />
                      <Route path="payments/:paymentId" element={<PaymentDetailPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/teacher" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </BrowserRouter>
            </AppDataProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
