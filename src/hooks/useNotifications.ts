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

export function useNotifications() {
  const { user } = useAuth();
  const { students, outstanding } = useAppData();

  const [backendItems, setBackendItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => getStorageSet(LOCAL_READ_KEY));
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(() => getStorageSet(LOCAL_DELETED_KEY));

  const inFlightRef = useRef<Set<string>>(new Set());

  // Load from backend
  const fetchBackendNotifications = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) {
        setBackendItems([]);
        setLoading(false);
        return;
      }
      try {
        const res = await listNotifications({ limit: 100 }, signal);
        setBackendItems(res.items);
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

  // Initial fetch and 30s polling
  useEffect(() => {
    const controller = new AbortController();
    fetchBackendNotifications(controller.signal);

    const interval = setInterval(() => {
      fetchBackendNotifications();
    }, 30000);

    const onFocus = () => {
      fetchBackendNotifications();
    };
    const onNotifsUpdated = () => {
      fetchBackendNotifications();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications-updated", onNotifsUpdated);

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications-updated", onNotifsUpdated);
    };
  }, [fetchBackendNotifications]);

  // Generate contextual smart alerts ONLY from real active student balances (no fake classes or notices)
  const contextualItems = useMemo(() => {
    const today = todayISO();
    const items: AppNotification[] = [];

    // Students with overdue fees
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
      });
    }

    return items;
  }, [students, outstanding]);

  // Combine backend + contextual notifications, applying local read & deleted filters
  const notifications = useMemo(() => {
    const seenTitles = new Set<string>();
    const result: AppNotification[] = [];

    // Backend items first
    backendItems.forEach((item) => {
      if (localDeletedIds.has(item.id)) return;
      const isRead = localReadIds.has(item.id) ? true : item.read;
      seenTitles.add(item.title.toLowerCase().trim());
      result.push({
        ...item,
        read: isRead,
      });
    });

    // Merge contextual items if not deleted and not duplicates
    contextualItems.forEach((item) => {
      if (localDeletedIds.has(item.id)) return;
      if (seenTitles.has(item.title.toLowerCase().trim())) return;
      result.push({
        ...item,
        read: localReadIds.has(item.id),
      });
    });

    // Sort: Newest / Unread first!
    return result.sort(sortNotificationsNewestFirst);
  }, [backendItems, contextualItems, localReadIds, localDeletedIds]);

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
