import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarClock, ChevronRight, LogOut, Menu, Moon, PanelLeft, Sun } from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { TEACHER_HOME, TEACHER_NAV } from "@/lib/teacherNav";
import { fmtDate, fmtTime, toLocalDT, todayISO } from "@/lib/utils";

function Notifications() {
  const { classes } = useTeacherPortal();
  const items = useMemo(() => {
    const now = toLocalDT(new Date());
    return classes.filter((c) => (c.status === "scheduled" || c.status === "postponed") && c.end >= now).slice(0, 4);
  }, [classes]);
  return (
    <Dropdown
      width="w-80"
      mobileFixed
      trigger={({ toggle }) => (
        <button onClick={toggle} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          <Bell className="h-[18px] w-[18px]" />
          {items.length > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-heading text-sm font-bold">Coming up</p>
            <Badge tone="primary">{items.length} classes</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No upcoming classes.</p>}
            {items.map((c) => (
              <Link key={c.id} to={TEACHER_HOME} onClick={close} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand"><CalendarClock className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-semibold leading-snug">{c.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{c.start.slice(0, 10) === todayISO() ? "Today" : fmtDate(c.start, false)} · {fmtTime(c.start)} · {c.batch}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function TeacherTopbar({ onMenu, collapsed, onToggleCollapse }: { onMenu: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { profile } = useTeacherPortal();
  const toast = useToast();
  const match = [...TEACHER_NAV].sort((a, b) => b.route.length - a.route.length).find((n) => (n.route === TEACHER_HOME ? pathname === TEACHER_HOME : pathname.startsWith(n.route)));
  const current = match ?? TEACHER_NAV[0];
  const name = profile?.fullName ?? user?.fullName ?? "Teacher";
  const short = name.split(" ")[0] + (name.split(" ")[1] ? ` ${name.split(" ")[1][0]}.` : "");
  const signOut = () =>
    void logout().then(() => {
      nav("/teacher/login");
      toast.success("Signed out");
    });
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface lg:hidden"><Menu className="h-5 w-5" /></button>
        <button onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink lg:flex"><PanelLeft className="h-[18px] w-[18px]" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-extrabold leading-tight sm:text-xl">{current.title}</h2>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <Link to={TEACHER_HOME} className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Teacher</span>
            {current.route !== TEACHER_HOME && (<><ChevronRight className="h-3 w-3" /><span className="font-semibold text-ink">{current.title}</span></>)}
          </nav>
        </div>
        <Notifications />
        <button onClick={toggle} aria-label="Toggle theme" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">{dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>
        <Dropdown
          width="w-60"
          trigger={({ toggle: t }) => (
            <button onClick={t} aria-label="Profile menu" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1 pr-1 sm:pr-3">
              <Avatar name={name} size="sm" />
              <span className="hidden text-left leading-tight sm:block"><span className="block text-xs font-bold">{short}</span><span className="block text-[10px] text-muted">Teacher</span></span>
            </button>
          )}
        >
          {(close) => (
            <div className="p-2">
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <Avatar name={name} />
                <div className="min-w-0 leading-tight"><p className="truncate text-sm font-bold">{name}</p><p className="truncate text-[11px] text-muted">{user?.email}</p></div>
              </div>
              <button onClick={() => { close(); signOut(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10"><LogOut className="h-4 w-4" /> Log out</button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
