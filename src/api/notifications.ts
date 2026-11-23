import { request } from "@/lib/api";
import { buildQuery } from "@/lib/utils";
import type {
  AppNotification,
  CreateNotificationDto,
  DeleteNotificationResponse,
  NotificationListResponse,
  NotificationQueryParams,
} from "@/types";

export async function listNotifications(
  params: NotificationQueryParams = {},
  signal?: AbortSignal,
): Promise<NotificationListResponse> {
  const qs = buildQuery({
    type: params.type && params.type !== "all" ? params.type : undefined,
    read: typeof params.read === "boolean" ? String(params.read) : undefined,
    q: params.q?.trim() || undefined,
    page: params.page,
    limit: params.limit,
    from: params.from,
    to: params.to,
  });

  const res = await request<any>(`/notifications${qs}`, { signal });

  // Support array response directly or object wrapper
  const rawItems: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.items)
      ? res.items
      : [];

  const items: AppNotification[] = rawItems.map((item, idx) => {
    let createdAt = item.createdAt || item.date || item.timestamp;
    if (!createdAt && typeof item._id === "string" && item._id.length === 24) {
      try {
        const ts = parseInt(item._id.substring(0, 8), 16) * 1000;
        if (!isNaN(ts)) createdAt = new Date(ts).toISOString();
      } catch {
        // fallback below
      }
    }

    return {
      id: String(item.id || item._id || `notif_${idx}`),
      type: item.type || "system",
      title: item.title || "Notification",
      subtitle: item.subtitle || item.message || "",
      link: item.link || item.url || undefined,
      read: Boolean(item.read || item.isRead),
      persisted: true,
      createdAt: createdAt || new Date().toISOString(),
      metadata: item.metadata || {},
    };
  });

  const total = res?.pagination?.total ?? res?.summary?.total ?? items.length;
  const limit = res?.pagination?.limit ?? params.limit ?? Math.max(items.length, 10);
  const page = res?.pagination?.page ?? params.page ?? 1;
  const totalPages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  const unreadCount =
    typeof res?.unreadCount === "number"
      ? res.unreadCount
      : typeof res?.summary?.unreadCount === "number"
        ? res.summary.unreadCount
        : items.filter((i) => !i.read).length;

  return {
    items,
    pagination: { total, page, limit, totalPages },
    summary: {
      total,
      unreadCount,
    },
    unreadCount,
  };
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  try {
    const res = await request<{ unreadCount: number }>("/notifications/unread-count", { signal });
    if (typeof res?.unreadCount === "number") {
      return res.unreadCount;
    }
  } catch {
    // fallback to list if unread-count endpoint isn't supported
  }

  const list = await listNotifications({ limit: 1 }, signal);
  return list.summary?.unreadCount ?? 0;
}

export async function createNotification(
  payload: CreateNotificationDto,
): Promise<AppNotification> {
  const res = await request<any>("/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const created: AppNotification = {
    id: String(res.id || res._id || `notif_${Date.now()}`),
    type: res.type || payload.type || "system",
    title: res.title || payload.title,
    subtitle: res.subtitle || res.message || payload.subtitle || "",
    link: res.link || payload.link,
    read: Boolean(res.read),
    persisted: true,
    createdAt: res.createdAt || new Date().toISOString(),
    metadata: res.metadata || payload.metadata,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("notifications-updated"));
  }

  return created;
}

export async function markAsRead(id: string): Promise<{ id: string; read: true }> {
  try {
    return await request<{ id: string; read: true }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
    );
  } catch {
    // If PATCH /:id/read is missing, try PATCH /:id with body { read: true }
    return await request<{ id: string; read: true }>(
      `/notifications/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      },
    );
  }
}

export async function markAsUnread(id: string): Promise<{ id: string; read: false }> {
  try {
    return await request<{ id: string; read: false }>(
      `/notifications/${encodeURIComponent(id)}/unread`,
      { method: "PATCH" },
    );
  } catch {
    return await request<{ id: string; read: false }>(
      `/notifications/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ read: false }),
      },
    );
  }
}

export async function markAllAsRead(): Promise<{ updatedCount: number }> {
  return await request<{ updatedCount: number }>("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function deleteNotification(id: string): Promise<DeleteNotificationResponse> {
  try {
    return await request<DeleteNotificationResponse>(
      `/notifications/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  } catch (err) {
    return { deleted: false, id };
  }
}

export async function clearReadNotifications(): Promise<{ deletedCount: number }> {
  try {
    return await request<{ deletedCount: number }>("/notifications/clear-read", {
      method: "DELETE",
    });
  } catch {
    return await request<{ deletedCount: number }>("/notifications/read", {
      method: "DELETE",
    });
  }
}
