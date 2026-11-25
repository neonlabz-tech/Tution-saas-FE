import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { StudentSidebar } from "./StudentSidebar";
import { StudentTopbar } from "./StudentTopbar";
import { MustChangePasswordModal } from "./MustChangePasswordModal";

export function StudentLayout() {
  const { account } = useStudentAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("eduflow-student-sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const { pathname } = useLocation();

  // If the student logged in with a temporary password, automatically prompt them
  useEffect(() => {
    if (account?.mustChangePassword) {
      setPasswordModalOpen(true);
    }
  }, [account?.mustChangePassword]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem("eduflow-student-sidebar", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen">
      <StudentSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]"}`}>
        <StudentTopbar
          onMenu={() => setMobileOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenResetPassword={() => setPasswordModalOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {account?.mustChangePassword && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-heading text-sm font-bold text-amber-900 dark:text-amber-200">
                    Temporary Password in Use
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    You signed in with the temporary password sent to your email. Please reset it to a personal password.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setPasswordModalOpen(true)}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                <KeyRound className="h-3.5 w-3.5 mr-1" />
                Reset Password
              </Button>
            </div>
          )}

          <motion.div key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      <MustChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}
