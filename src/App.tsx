import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Component, type ErrorInfo, type ReactNode } from "react";
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
import OnlineClassesPage from "@/pages/dashboard/OnlineClassesPage";
import NoticesPage from "@/pages/dashboard/NoticesPage";
import QrScannerPage from "@/pages/dashboard/QrScannerPage";
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";

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
    <GlobalErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppDataProvider>
              <HashRouter>
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
                    <Route path="online-classes" element={<OnlineClassesPage />} />
                    <Route path="notices" element={<NoticesPage />} />
                    <Route path="qr-scanner" element={<QrScannerPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </HashRouter>
            </AppDataProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
