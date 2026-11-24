import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppDataProvider } from "@/hooks/useAppData";
import { ToastProvider } from "@/components/ui/toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import StudentsPage from "@/pages/dashboard/StudentsPage";
import TeachersPage from "@/pages/dashboard/TeachersPage";
import ModulesPage from "@/pages/dashboard/ModulesPage";
import AttendancePage from "@/pages/dashboard/AttendancePage";
import FinancePage from "@/pages/dashboard/FinancePage";
import OnlineClassesPage from "@/pages/dashboard/OnlineClassesPage";
import NoticesPage from "@/pages/dashboard/NoticesPage";
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

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Verifying session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Hash routing keeps the single-file build working from any static host.
// Route structure mirrors the Next.js App Router layout: /dashboard/<section>.
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppDataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
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
                  <Route path="online-classes" element={<OnlineClassesPage />} />
                  <Route path="notices" element={<NoticesPage />} />
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
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </AppDataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
