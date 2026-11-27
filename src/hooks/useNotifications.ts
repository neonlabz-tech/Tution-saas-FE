import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppNotification, CreateNotificationDto } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import {
  clearReadNotifications,
  createNotification as apiCreateNotification,
  deleteNotification as apiDeleteNotification,
  listNotifications,
  markAllAsRead as apiMarkAllAsRead,
  markAsRead as apiMarkAsRead,
  markAsUnread as apiMarkAsUnread,
} from "@/api/notifications";
import { todayISO } from "@/lib/utils";

const LOCAL_READ_KEY = "eduflow_notif_read_ids_v1";
const LOCAL_DELETED_KEY = "eduflow_notif_deleted_ids_v1";

export function clearNotificationStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_READ_KEY);
    localStorage.removeItem(LOCAL_DELETED_KEY);
  } catch {
    // ignore
  }
}

function getStorageSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStorageSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore quota errors
  }
}

export function sortNotificationsNewestFirst(a: AppNotification, b: AppNotification): number {
  // 1. Unread (new) notifications ALWAYS at the top
  if (a.read !== b.read) {
    return a.read ? 1 : -1;
  }
  // 2. Newest timestamp first
  const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const validA = !isNaN(tA) && tA > 0 ? tA : 0;
  const validB = !isNaN(tB) && tB > 0 ? tB : 0;
  if (validB !== validA) {
    return validB - validA;
  }
  // 3. Fallback: newer ID first
  return b.id.localeCompare(a.id);
}

// Shared module-level notification coordinator to eliminate duplicate requests and runaway polling
let sharedBackendItems: AppNotification[] = [];
let lastFetchTimestamp = 0;
let inFlightNotificationPromise: Promise<AppNotification[]> | null = null;
const notificationListeners = new Set<(items: AppNotification[]) => void>();

async function fetchSharedNotifications(force = false, signal?: AbortSignal): Promise<AppNotification[]> {
  const now = Date.now();
  if (!force && now - lastFetchTimestamp < 20_000 && sharedBackendItems.length > 0) {
    return sharedBackendItems;
  }
  if (inFlightNotificationPromise) {
    return inFlightNotificationPromise;
  }

  inFlightNotificationPromise = listNotifications({ limit: 100 }, signal)
    .then((res) => {
      sharedBackendItems = res.items;
      lastFetchTimestamp = Date.now();
      notificationListeners.forEach((fn) => fn(sharedBackendItems));
      return sharedBackendItems;
    })
    .finally(() => {
      inFlightNotificationPromise = null;
    });

  return inFlightNotificationPromise;
}

export function useNotifications() {
  const { user } = useAuth();
  const { students, outstanding, classes } = useAppData();

  const [backendItems, setBackendItems] = useState<AppNotification[]>(() => sharedBackendItems);
  const [loading, setLoading] = useState(sharedBackendItems.length === 0);
  const [error, setError] = useState<string | null>(null);

  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => getStorageSet(LOCAL_READ_KEY));
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(() => getStorageSet(LOCAL_DELETED_KEY));

  const inFlightRef = useRef<Set<string>>(new Set());

  // Subscribe to shared module notifications
  useEffect(() => {
    const listener = (items: AppNotification[]) => {
      setBackendItems(items);
      setLoading(false);
    };
    notificationListeners.add(listener);
    return () => {
      notificationListeners.delete(listener);
    };
  }, []);

  // Automatically reset notifications and clear local storage keys when user logs out
  useEffect(() => {
    if (!user) {
      sharedBackendItems = [];
      lastFetchTimestamp = 0;
      setBackendItems([]);
      setLocalReadIds(new Set());
      setLocalDeletedIds(new Set());
      clearNotificationStorage();
    }
  }, [user]);

  // Load from backend - only for admin/staff inside the dashboard
  const fetchBackendNotifications = useCallback(
    async (force = false, signal?: AbortSignal) => {
      const isStudentPath = typeof window !== "undefined" && window.location.pathname.startsWith("/student");
      if (!user || user.role === "student" || isStudentPath) {
        setBackendItems([]);
        setLoading(false);
        return;
      }
      try {
        const items = await fetchSharedNotifications(force, signal);
        setBackendItems(items);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Controlled background polling: 60s interval, throttled, pauses on hidden tab
  useEffect(() => {
    const isStudentPath = typeof window !== "undefined" && window.location.pathname.startsWith("/student");
    if (!user || user.role === "student" || isStudentPath) return;

    const controller = new AbortController();
    void fetchBackendNotifications(false, controller.signal);

    // Steady 60s background polling (avoids excessive polling while keeping alerts fresh)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchBackendNotifications(false);
    }, 60000);

    const onFocus = () => {
      if (Date.now() - lastFetchTimestamp > 30000) {
        void fetchBackendNotifications(false);
      }
    };

    const onNotifsUpdated = () => {
      if (Date.now() - lastFetchTimestamp > 5000) {
        void fetchBackendNotifications(true);
      }
    };

    const onNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<AppNotification>;
      if (customEvent.detail) {
        const newNotif = customEvent.detail;
        if (!sharedBackendItems.some((p) => p.id === newNotif.id)) {
          sharedBackendItems = [newNotif, ...sharedBackendItems];
          notificationListeners.forEach((fn) => fn(sharedBackendItems));
        }
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications-updated", onNotifsUpdated);
    window.addEventListener("eduflow:new-notification", onNewNotification);

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications-updated", onNotifsUpdated);
      window.removeEventListener("eduflow:new-notification", onNewNotification);
    };
  }, [user, fetchBackendNotifications]);

  // Contextual smart alerts (Student debtors & 15-Minute Class Reminders)
  const contextualItems = useMemo(() => {
    const today = todayISO();
    const now = new Date();
    const items: AppNotification[] = [];

    // 1. 15-Minute Online Class Reminders (Only for Teacher & Students of that batch)
    classes?.forEach((c) => {
      if (c.status !== "scheduled" || !c.start) return;
      const startDate = new Date(c.start);
      if (isNaN(startDate.getTime())) return;
      const diffMs = startDate.getTime() - now.getTime();
      const diffMin = Math.round(diffMs / 60000);

      // Starting between 0 and 15 minutes from right now
      if (diffMin >= 0 && diffMin <= 15) {
        const timeLabel = diffMin === 0 ? "starting now" : `in ${diffMin} min`;
        items.push({
          id: `class_reminder_15m_${c.id}_${today}`,
          type: "class",
          title: `Class Reminder: Starting ${timeLabel}`,
          subtitle: `${c.title} (Batch ${c.batch}) starts soon. Tap to join class room.`,
          link: c.link || "/dashboard/online-classes",
          read: false,
          persisted: false,
          createdAt: new Date().toISOString(),
          targetRoles: ["teacher", "student"],
          targetUserIds: [c.teacherId],
          targetBatch: c.batch,
          priority: "urgent",
        });
      }
    });

    // 2. Students with overdue fees (Only for Super Admin & Admin)
    const debtors = (students || []).filter((s) => s.status === "active" && outstanding(s.id) > 0);
    if (debtors.length > 0) {
      const totalOverdue = debtors.reduce((sum, s) => sum + outstanding(s.id), 0);
      items.push({
        id: `ctx_finance_debtors_${today}`,
        type: "payment",
        title: `Pending Student Fees Alert`,
        subtitle: `${debtors.length} active student${debtors.length === 1 ? "" : "s"} have overdue balances totaling LKR ${totalOverdue.toLocaleString()}.`,
        link: "/dashboard/payments?tab=debtors",
        read: false,
        persisted: false,
        createdAt: new Date().toISOString(),
        targetRoles: ["super_admin", "admin"],
      });
    }

    return items;
  }, [classes, students, outstanding]);

  // Role filtering & Actor self-suppression logic
  const isNotificationVisible = useCallback(
    (item: AppNotification): boolean => {
      if (!user) return true;

      // 1. SELF-SUPPRESSION: If I performed the change, I do not see the alert!
      if (item.actorId && item.actorId === user.id) {
        return false;
      }

      // 2. Super Admin sees all oversight / audit alerts
      if (user.role === "super_admin") {
        return true;
      }

      // 3. Specific target user IDs (e.g. newly enrolled student, assigned teacher)
      if (item.targetUserIds && item.targetUserIds.length > 0) {
        if (item.targetUserIds.includes(user.id)) return true;
      }

      // 4. Target roles filter
      if (item.targetRoles && item.targetRoles.length > 0) {
        if (!item.targetRoles.includes(user.role)) return false;
      }

      // 5. Target batch filter (for students)
      if (user.role === "student" && item.targetBatch) {
        const studentRecord = students?.find((s) => s.id === user.id || s.email === user.email);
        if (studentRecord && studentRecord.batch !== item.targetBatch) {
          return false;
        }
      }

      return true;
    },
    [user, students],
  );

  // Combine backend + contextual notifications, applying filters & sorting
  const notifications = useMemo(() => {
    const seenTitles = new Set<string>();
    const result: AppNotification[] = [];

    // Backend items first
    backendItems.forEach((item) => {
      if (localDeletedIds.has(item.id)) return;
      if (!isNotificationVisible(item)) return;

      const isRead = localReadIds.has(item.id) ? true : item.read;
      seenTitles.add(item.title.toLowerCase().trim());
      result.push({
        ...item,
        read: isRead,
      });
    });

    // Merge contextual items if not deleted, visible, and not duplicates
    contextualItems.forEach((item) => {
      if (localDeletedIds.has(item.id)) return;
      if (!isNotificationVisible(item)) return;
      if (seenTitles.has(item.title.toLowerCase().trim())) return;

      result.push({
        ...item,
        read: localReadIds.has(item.id),
      });
    });

    // Sort: Newest / Unread first!
    return result.sort(sortNotificationsNewestFirst);
  }, [backendItems, contextualItems, localReadIds, localDeletedIds, isNotificationVisible]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Action: Mark single as read
  const markAsRead = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return;
      inFlightRef.current.add(id);

      // Optimistic update
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveStorageSet(LOCAL_READ_KEY, next);
        return next;
      });
      setBackendItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );

      try {
        const item = backendItems.find((b) => b.id === id);
        if (item && item.persisted !== false) {
          await apiMarkAsRead(id);
        }
      } catch (err) {
        console.error("Failed to mark as read on backend:", err);
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [backendItems],
  );

  // Action: Mark single as unread
  const markAsUnread = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return;
      inFlightRef.current.add(id);

      // Optimistic update
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        saveStorageSet(LOCAL_READ_KEY, next);
        return next;
      });
      setBackendItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: false } : item)),
      );

      try {
        const item = backendItems.find((b) => b.id === id);
        if (item && item.persisted !== false) {
          await apiMarkAsUnread(id);
        }
      } catch (err) {
        console.error("Failed to mark as unread on backend:", err);
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [backendItems],
  );

  // Action: Mark all as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveStorageSet(LOCAL_READ_KEY, next);
      return next;
    });
    setBackendItems((prev) => prev.map((item) => ({ ...item, read: true })));

    try {
      await apiMarkAllAsRead();
    } catch (err) {
      console.error("Failed to mark all as read on backend:", err);
    }
  }, [notifications]);

  // Action: Delete single notification
  const deleteNotification = useCallback(
    async (id: string) => {
      // Optimistic update
      setLocalDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveStorageSet(LOCAL_DELETED_KEY, next);
        return next;
      });
      setBackendItems((prev) => prev.filter((item) => item.id !== id));

      try {
        const item = backendItems.find((b) => b.id === id);
        if (item && item.persisted !== false) {
          await apiDeleteNotification(id);
        }
      } catch (err) {
        console.error("Failed to delete notification on backend:", err);
      }
    },
    [backendItems],
  );

  // Action: Clear all read notifications
  const clearRead = useCallback(async () => {
    const readIds = notifications.filter((n) => n.read).map((n) => n.id);
    if (readIds.length === 0) return;

    setLocalDeletedIds((prev) => {
      const next = new Set(prev);
      readIds.forEach((id) => next.add(id));
      saveStorageSet(LOCAL_DELETED_KEY, next);
      return next;
    });
    setBackendItems((prev) => prev.filter((item) => !item.read));

    try {
      await clearReadNotifications();
    } catch (err) {
      console.error("Failed to clear read on backend:", err);
    }
  }, [notifications]);

  // Action: Create manual notification
  const createNotification = useCallback(
    async (dto: CreateNotificationDto) => {
      const created = await apiCreateNotification(dto);
      setBackendItems((prev) => [created, ...prev]);
    },
    [],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchBackendNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearRead,
    createNotification,
  };
}
