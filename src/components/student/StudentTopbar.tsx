import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, ChevronRight, LogOut, Menu, Moon, PanelLeft, Receipt, Sun, Wallet } from "lucide-react";
import { Avatar, Badge, Button } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentData } from "@/hooks/useStudentData";
import { STUDENT_HOME, STUDENT_NAV } from "@/lib/studentNav";
import { notificationsApi } from "@/lib/api";
import { fmtDate, fmtLKR, fmtTime, toLocalDT, todayISO } from "@/lib/utils";

const READ_KEY = "eduflow-student-read-notifs";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {}
}

function Notifications() {
  const { data } = useStudentData();
  const [readIds, setReadIds] = useState<Set<string>>(() => readSet());
  const [liveNotifs, setLiveNotifs] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const fetchNotifs = notificationsApi.list ?? notificationsApi.get;
    if (typeof fetchNotifs === "function") {
      fetchNotifs
        .call(notificationsApi)
        .then((res) => {
          if (active && res && Array.isArray(res.items)) {
            setLiveNotifs(res.items);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => {
    const list: { id: string; icon: any; tone: string; title: string; sub: string; to: string }[] = [];
    if (!data) return list;

    // 1. High-priority batch notices
    data.notices
      .filter((n) => n.priority === "high")
      .slice(0, 3)
      .forEach((n) =>
        list.push({
          id: `notice_${n.id}`,
          icon: AlertTriangle,
          tone: "bg-rose-500/10 text-rose-500",
          title: n.title,
          sub: `Notice · ${n.batches?.join(", ") || "All batches"}`,
          to: STUDENT_HOME,
        })
      );

    // 2. Upcoming classes today/soon
    const now = toLocalDT(new Date());
    const upcoming = data.onlineClasses
      .filter((c) => c.status === "scheduled" && c.end >= now)
      .slice(0, 2);
    upcoming.forEach((next) => {
      list.push({
        id: `class_${next.id}`,
        icon: CalendarClock,
        tone: "bg-primary/10 text-brand",
        title: next.title,
        sub: `${next.start.slice(0, 10) === todayISO() ? "Today" : fmtDate(next.start, false)} · ${fmtTime(next.start)}`,
        to: `${STUDENT_HOME}/modules/${next.moduleId}?tab=calendar`,
      });
    });

    // 3. Overdue fees reminder
    if (data.paymentSummary.overdue > 0) {
      list.push({
        id: `overdue_${data.paymentSummary.overdue}`,
        icon: Wallet,
        tone: "bg-amber-500/10 text-amber-500",
        title: `${fmtLKR(data.paymentSummary.overdue)} payment overdue`,
        sub: "Please settle pending course fees",
        to: `${STUDENT_HOME}/payments`,
      });
    }

    // 4. Confirmed payment receipts
    data.payments
      .filter((p) => p.status === "paid")
      .slice(0, 2)
      .forEach((p) => {
        list.push({
          id: `pay_${p.id}`,
          icon: Receipt,
          tone: "bg-emerald-500/10 text-emerald-500",
          title: `Payment confirmed: ${fmtLKR(p.amount)}`,
          sub: `Receipt ${p.receiptNo} · ${fmtDate(p.date)}`,
          to: `${STUDENT_HOME}/payments`,
        });
      });

    // 5. Backend system announcements
    liveNotifs
      .filter((n) => n.persisted && !n.id.startsWith("stu_reg_"))
      .slice(0, 3)
      .forEach((n) => {
        list.push({
          id: `sys_${n.id}`,
          icon: Bell,
          tone: "bg-primary/10 text-brand",
          title: n.title,
          sub: n.subtitle || "Announcement",
          to: n.link || STUDENT_HOME,
        });
      });

    return list;
  }, [data, liveNotifs]);

  const unreadCount = useMemo(() => items.filter((i) => !readIds.has(i.id)).length, [items, readIds]);

  const markAllRead = () => {
    const updated = new Set(readIds);
    items.forEach((i) => updated.add(i.id));
    setReadIds(updated);
    writeSet(updated);
    notificationsApi.markAllAsRead().catch(() => {});
  };

  const markOneRead = (id: string) => {
    if (!readIds.has(id)) {
      const updated = new Set(readIds);
      updated.add(id);
      setReadIds(updated);
      writeSet(updated);
      notificationsApi.markAsRead(id).catch(() => {});
    }
  };

  return (
    <Dropdown
      width="w-84"
      mobileFixed
      trigger={({ toggle }) => (
        <button onClick={toggle} aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-heading text-sm font-bold">Notifications</p>
              {unreadCount > 0 && <Badge tone="primary">{unreadCount} new</Badge>}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</p>}
            {items.map((i) => {
              const isUnread = !readIds.has(i.id);
              return (
                <Link
                  key={i.id}
                  to={i.to}
                  onClick={() => {
                    markOneRead(i.id);
                    close();
                  }}
                  className={`flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 ${isUnread ? "bg-primary/5" : ""}`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${i.tone}`}>
                    <i.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-semibold leading-snug">{i.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{i.sub}</span>
                  </span>
                  {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function StudentTopbar({
  onMenu,
  collapsed,
  onToggleCollapse,
}: {
  onMenu: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();
  const { account, logout } = useStudentAuth();
  const toast = useToast();
  const isDetail = /^\/student\/modules\/[^/]+/.test(pathname);
  const current = isDetail ? { title: "Module Details", route: pathname } : (STUDENT_NAV.find((n) => n.route === pathname) ?? STUDENT_NAV[0]);
  const name = account?.fullName ?? "Student";
  const short = name.split(" ")[0] + (name.split(" ")[1] ? ` ${name.split(" ")[1][0]}.` : "");
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
            <Link to={STUDENT_HOME} className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Student</span>
            {current.route !== STUDENT_HOME && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-ink">{current.title}</span>
              </>
            )}
          </nav>
        </div>
        <Notifications />
        <button onClick={toggle} aria-label="Toggle theme" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink">
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Dropdown
          width="w-60"
          trigger={({ toggle: t }) => (
            <button onClick={t} aria-label="Profile menu" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1 pr-1 sm:pr-3">
              <Avatar name={name} size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-bold">{short}</span>
                <span className="block text-[10px] text-muted">Student</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <div className="p-2">
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <Avatar name={name} />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="truncate text-[11px] text-muted">{account?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  close();
                  void logout().then(() => {
                    nav("/student/login");
                    toast.success("Signed out");
                  });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
