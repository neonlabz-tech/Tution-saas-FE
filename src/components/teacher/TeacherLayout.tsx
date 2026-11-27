import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { TeacherSidebar } from "./TeacherSidebar";
import { TeacherTopbar } from "./TeacherTopbar";

export function TeacherLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("eduflow-teacher-sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem("eduflow-teacher-sidebar", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen">
      <TeacherSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]"}`}>
        <TeacherTopbar onMenu={() => setMobileOpen(true)} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
