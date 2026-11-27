import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { Logo } from "@/components/layout/Sidebar";
import { Avatar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { TEACHER_HOME, TEACHER_NAV_GROUPS } from "@/lib/teacherNav";
import { cn } from "@/lib/utils";

function SidebarContent({ collapsed, onNavigate, onCollapse }: { collapsed: boolean; onNavigate?: () => void; onCollapse?: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { profile } = useTeacherPortal();
  const name = profile?.fullName ?? user?.fullName ?? "Teacher";
  return (
    <div className="sidebar-glow flex h-full flex-col bg-sidebar text-slate-300">
      <div className={cn("flex h-[72px] shrink-0 items-center", collapsed ? "justify-center gap-1 px-2" : "justify-between px-5")}>
        <Logo compact={collapsed} />
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:block"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Teacher navigation">
        {TEACHER_NAV_GROUPS.map((g) => (
          <div key={g.label}>
            {collapsed ? <div className="mx-3 mb-2 h-px bg-white/10" /> : <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.label}</p>}
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.route}>
                  <NavLink
                    to={item.route}
                    end={item.route === TEACHER_HOME}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={({ isActive }) =>
                      cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", collapsed && "justify-center px-0", isActive ? "text-white" : "hover:bg-white/5 hover:text-white")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span layoutId={collapsed ? "tnav-active-c" : "tnav-active"} className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/90 to-violet-600/70 shadow-lg shadow-primary/30" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />
                        )}
                        <item.icon className={cn("relative h-[19px] w-[19px] shrink-0", !isActive && "text-slate-400 group-hover:text-white")} />
                        {!collapsed && <span className="relative truncate">{item.title}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className={cn("flex items-center gap-3 rounded-2xl bg-white/5 p-2.5", collapsed && "flex-col bg-transparent p-0")}>
          <Avatar name={name} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              <p className="num truncate text-[11px] text-slate-400">{profile?.employeeNo ?? "Teacher"}</p>
            </div>
          )}
          <button
            title="Log out"
            aria-label="Log out"
            onClick={() =>
              void logout().then(() => {
                onNavigate?.();
                nav("/teacher/login");
                toast.success("Signed out");
              })
            }
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeacherSidebar({ collapsed, onToggle, mobileOpen, onClose }: { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      <motion.aside initial={false} animate={{ width: collapsed ? 84 : 272 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden lg:block">
        <SidebarContent collapsed={collapsed} onCollapse={onToggle} />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 32, stiffness: 320 }} className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-pop">
              <button onClick={onClose} aria-label="Close menu" className="absolute right-3 top-5 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
              <SidebarContent collapsed={false} onNavigate={onClose} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
