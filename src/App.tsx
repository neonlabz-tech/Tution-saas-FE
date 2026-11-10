import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppDataProvider } from "@/hooks/useAppData";
import { ToastProvider } from "@/components/ui/toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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

// Hash routing keeps the single-file build working from any static host.
// Route structure mirrors the Next.js App Router layout: /dashboard/<section>.
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppDataProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
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
      </ToastProvider>
    </ThemeProvider>
  );
}
