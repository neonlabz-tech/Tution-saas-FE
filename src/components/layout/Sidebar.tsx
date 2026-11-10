import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, LogOut, Settings, X } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-secondary shadow-lg shadow-primary/40">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 8c3-3 5-3 8 0s5 3 8 0" />
          <path d="M4 15c3-3 5-3 8 0s5 3 8 0" opacity="0.65" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="font-heading text-lg font-extrabold tracking-tight text-white">EduFlow</p>
          <p className="truncate text-[11px] text-slate-400">Bright Future Institute</p>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate, onCollapse }: { collapsed: boolean; onNavigate?: () => void; onCollapse?: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  return (
    <div className="sidebar-glow flex h-full flex-col bg-sidebar text-slate-300">
      <div className={cn("flex h-[72px] shrink-0 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        <Logo compact={collapsed} />
        {!collapsed && onCollapse && (
          <button onClick={onCollapse} aria-label="Collapse sidebar" className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:block">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            {collapsed ? <div className="mx-3 mb-2 h-px bg-white/10" /> : <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.label}</p>}
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.route}>
                  <NavLink
                    to={item.route}
                    end={item.route === "/dashboard"}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        collapsed && "justify-center px-0",
                        isActive ? "text-white" : "hover:bg-white/5 hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span layoutId={collapsed ? "nav-active-c" : "nav-active"} className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/90 to-violet-600/70 shadow-lg shadow-primary/30" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />
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
          <Avatar name="Amara Perera" size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">Amara Perera</p>
              <p className="truncate text-[11px] text-slate-400">Administrator</p>
            </div>
          )}
          <div className={cn("flex gap-1", collapsed && "flex-col")}>
            <button
              title="Settings"
              aria-label="Settings"
              onClick={() => {
                nav("/dashboard/settings");
                onNavigate?.();
              }}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button title="Log out" aria-label="Log out" onClick={() => toast.info("Logout is a UI demo — there is no authentication backend yet.")} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 84 : 272 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden lg:block"
      >
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
