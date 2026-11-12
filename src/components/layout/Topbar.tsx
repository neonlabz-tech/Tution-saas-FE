import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, BookOpen, CalendarClock, ChevronRight, GraduationCap, Menu, Moon, PanelLeft, Search, Sun, UserCog, Users, Wallet, X } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { fmtTime, todayISO } from "@/lib/utils";

function GlobalSearch({ className = "" }: { className?: string }) {
  const { students, teachers, modules } = useAppData();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const nav = useNavigate();
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return [
      ...students.filter((x) => x.fullName.toLowerCase().includes(s) || x.id.toLowerCase().includes(s)).slice(0, 4).map((x) => ({ key: x.id, label: x.fullName, sub: x.id, icon: GraduationCap, to: `/dashboard/students?q=${encodeURIComponent(x.id)}` })),
      ...teachers.filter((x) => x.fullName.toLowerCase().includes(s)).slice(0, 3).map((x) => ({ key: x.id, label: x.fullName, sub: x.specialization, icon: Users, to: `/dashboard/teachers?q=${encodeURIComponent(x.fullName)}` })),
      ...modules.filter((x) => x.name.toLowerCase().includes(s) || x.code.toLowerCase().includes(s)).slice(0, 3).map((x) => ({ key: x.id, label: x.name, sub: x.code, icon: BookOpen, to: `/dashboard/modules?q=${encodeURIComponent(x.name)}` })),
    ];
  }, [q, students, teachers, modules]);
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder="Search students, teachers, modules…"
        className="h-10 w-full rounded-xl border border-line bg-surface-2/60 pl-10 pr-3 text-sm placeholder:text-muted/80 transition focus:border-blue-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-blue-500/15"
      />
      {focus && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted">No matches for “{q}”</p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                onMouseDown={() => {
                  nav(r.to);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-brand">
                  <r.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.label}</span>
                  <span className="num block truncate text-[11px] text-muted">{r.sub}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { notices, classes, students, outstanding } = useAppData();
  const items = useMemo(() => {
    const today = todayISO();
    const list: { id: string; icon: typeof Bell; tone: string; title: string; sub: string }[] = [];
    notices
      .filter((n) => n.status === "published" && n.expiryDate >= today && n.priority === "high")
      .slice(0, 2)
      .forEach((n) => list.push({ id: n.id, icon: AlertTriangle, tone: "bg-rose-500/10 text-rose-500", title: n.title, sub: "High priority notice" }));
    classes
      .filter((c) => c.status === "scheduled" && c.start.slice(0, 10) >= today)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 2)
      .forEach((c) => list.push({ id: c.id, icon: CalendarClock, tone: "bg-primary/10 text-brand", title: c.title, sub: `${c.start.slice(0, 10) === today ? "Today" : c.start.slice(5, 10)} · ${fmtTime(c.start)}` }));
    const owing = students.filter((s) => s.status === "active" && outstanding(s.id) > 100000).length;
    list.push({ id: "pay", icon: Wallet, tone: "bg-amber-500/10 text-amber-500", title: `${owing} students have large outstanding balances`, sub: "Finance reminder" });
    return list;
  }, [notices, classes, students, outstanding]);
  return (
    <Dropdown
      width="w-80"
      trigger={({ toggle }) => (
        <button onClick={toggle} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-heading text-sm font-bold">Notifications</p>
            <Badge tone="primary">{items.length} new</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.map((i) => (
              <Link key={i.id} to="/dashboard/notices" onClick={close} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${i.tone}`}>
                  <i.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-semibold leading-snug">{i.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{i.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function Topbar({ onMenu, collapsed, onToggleCollapse }: { onMenu: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const current = ALL_NAV.find((n) => n.route === pathname) ?? ALL_NAV[0];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <button onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink lg:flex">
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-extrabold leading-tight sm:text-xl">{current.title}</h2>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <Link to="/dashboard" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Dashboard</span>
            {current.route !== "/dashboard" && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-ink">{current.title}</span>
              </>
            )}
          </nav>
        </div>
        <GlobalSearch className="hidden w-72 md:block xl:w-96" />
        <button onClick={() => setSearchOpen((s) => !s)} aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted md:hidden">
          {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
        </button>
        <Notifications />
        <button onClick={toggle} aria-label="Toggle theme" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Dropdown
          width="w-60"
          trigger={({ toggle: t }) => (
            <button onClick={t} aria-label="Profile menu" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1 pr-1 sm:pr-3">
              <Avatar name="Amara Perera" size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-bold">Amara P.</span>
                <span className="block text-[10px] text-muted">Admin</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <div className="p-2">
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <Avatar name="Amara Perera" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold">Amara Perera</p>
                  <p className="truncate text-[11px] text-muted">amara@brightfuture.lk</p>
                </div>
              </div>
              <Link to="/dashboard/settings" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
                <UserCog className="h-4 w-4 text-muted" /> Profile & settings
              </Link>
              <button
                onClick={() => {
                  close();
                  toast.info("Logout is a UI demo — there is no authentication backend yet.");
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10"
              >
                <X className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </Dropdown>
      </div>
      {searchOpen && (
        <div className="px-4 pb-3 md:hidden">
          <GlobalSearch />
        </div>
      )}
    </header>
  );
}
