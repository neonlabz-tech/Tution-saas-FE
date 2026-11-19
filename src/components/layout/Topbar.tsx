import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, BookOpen, CalendarClock, ChevronRight, GraduationCap, Menu, Moon, PanelLeft, Search, Sun, UserCog, Users, Wallet, X } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { todayISO } from "@/lib/utils";

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
  const { user } = useAuth();
  const { notices } = useAppData();
  const toast = useToast();
  const [backendItems, setBackendItems] = useState<NotificationItem[]>([]);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setBackendItems([]);
      return;
    }
    let active = true;
    notificationsApi
      .list()
      .then((res) => {
        if (!active) return;
        setBackendItems(res.items);
      })
      .catch(() => {
        /* keep empty list if offline */
      });
    return () => {
      active = false;
    };
  }, [user]);

  const items = useMemo(() => {
    const today = todayISO();
    const seenTitles = new Set(backendItems.map((i) => i.title.toLowerCase()));
    const localExpiring: NotificationItem[] = notices
      .filter((n) => n.status === "published" && n.expiryDate === today && !seenTitles.has(n.title.toLowerCase()))
      .map((n) => {
        const id = `local_exp_${n.id}`;
        return {
          id,
          type: "notice",
          title: n.title,
          subtitle: "Notice expires today",
          link: "/dashboard/notices",
          read: localReadIds.has(id),
          persisted: false,
        };
      });
    const combined = [...backendItems, ...localExpiring];
    return combined.sort((a, b) => {
      if (a.read === b.read) return 0;
      return a.read ? 1 : -1;
    });
  }, [backendItems, notices, localReadIds]);

  const unreadCount = items.filter((i) => !i.read).length;

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setBackendItems((prev) => prev.map((entry) => ({ ...entry, read: true })));
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id));
      return next;
    });
    try {
      await notificationsApi.markAllAsRead();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleNotificationClick = async (item: NotificationItem, close: () => void) => {
    close();
    if (item.read || inFlightRef.current.has(item.id)) return;

    if (item.id.startsWith("local_exp_")) {
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      return;
    }

    inFlightRef.current.add(item.id);
    setBackendItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    try {
      await notificationsApi.markAsRead(item.id);
    } catch {
      setBackendItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, read: false } : entry)));
      toast.error("Failed to mark notification as read");
    } finally {
      inFlightRef.current.delete(item.id);
    }
  };

  const metaFor = (type: NotificationItem["type"]) => {
    if (type === "student") return { icon: GraduationCap, tone: "bg-emerald-500/10 text-emerald-500" };
    if (type === "notice") return { icon: AlertTriangle, tone: "bg-rose-500/10 text-rose-500" };
    if (type === "class") return { icon: CalendarClock, tone: "bg-primary/10 text-brand" };
    if (type === "payment") return { icon: Wallet, tone: "bg-amber-500/10 text-amber-500" };
    return { icon: Bell, tone: "bg-primary/10 text-brand" };
  };

  return (
    <Dropdown
      width="w-80"
      trigger={({ toggle }) => (
        <button onClick={toggle} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-heading text-sm font-bold">Notifications</p>
              <Badge tone={unreadCount > 0 ? "primary" : "neutral"}>
                {unreadCount > 0 ? `${unreadCount} new` : "All read"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-semibold text-brand transition hover:underline"
                >
                  Mark all as read
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Close notifications"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line/40">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No notifications</p>
            ) : (
              items.map((i) => {
                const m = metaFor(i.type);
                return (
                  <Link
                    key={i.id}
                    to={i.link}
                    onClick={() => void handleNotificationClick(i, close)}
                    className={`flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 ${
                      i.read ? "opacity-70 bg-transparent" : "bg-primary/[0.04]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.tone}`}>
                      <m.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 block text-sm leading-snug ${i.read ? "font-normal text-muted" : "font-semibold text-ink"}`}>
                        {i.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">{i.subtitle}</span>
                    </span>
                    {!i.read && (
                      <span aria-label="Unread notification" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function Topbar({ onMenu, collapsed, onToggleCollapse }: { onMenu: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const current = ALL_NAV.find((n) => n.route === pathname) ?? ALL_NAV[0];
  const displayName = user?.fullName ?? "Amara Perera";
  const shortName = displayName.split(" ")[0] + (displayName.split(" ")[1] ? ` ${displayName.split(" ")[1][0]}.` : "");
  const displayEmail = user?.email ?? "amara@brightfuture.lk";
  const displayRole = user?.role ? user.role.replace("_", " ") : "Admin";
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
              <Avatar name={displayName} size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-bold">{shortName}</span>
                <span className="block text-[10px] capitalize text-muted">{displayRole}</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <div className="p-2">
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <Avatar name={displayName} />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold">{displayName}</p>
                  <p className="truncate text-[11px] text-muted">{displayEmail}</p>
                </div>
              </div>
              <Link to="/dashboard/settings" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
                <UserCog className="h-4 w-4 text-muted" /> Profile & settings
              </Link>
              <button
                onClick={() => {
                  close();
                  void logout().then(() => {
                    nav("/login");
                    toast.success("Logged out");
                  });
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
