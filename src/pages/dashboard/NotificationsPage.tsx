import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  Mail,
  MailOpen,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";
import type { CreateNotificationDto, NotificationType } from "@/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useNotifications } from "@/hooks/useNotifications";
import { cn, fmtNotificationDateTime } from "@/lib/utils";

type FilterType = "all" | NotificationType;
type StatusFilter = "all" | "unread" | "read";

function getNotificationMeta(type: NotificationType) {
  switch (type) {
    case "payment":
      return {
        label: "Payment",
        icon: Wallet,
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        badgeTone: "green" as const,
      };
    case "attendance":
      return {
        label: "Attendance",
        icon: ClipboardCheck,
        tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        badgeTone: "amber" as const,
      };
    case "class":
      return {
        label: "Class",
        icon: CalendarClock,
        tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        badgeTone: "primary" as const,
      };
    case "notice":
      return {
        label: "Notice",
        icon: Megaphone,
        tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        badgeTone: "rose" as const,
      };
    case "student":
      return {
        label: "Student",
        icon: GraduationCap,
        tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
        badgeTone: "teal" as const,
      };
    case "system":
    default:
      return {
        label: "System",
        icon: Bell,
        tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        badgeTone: "neutral" as const,
      };
  }
}

export default function NotificationsPage() {
  const toast = useToast();
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearRead,
    createNotification,
  } = useNotifications();

  // Filters & Search
  const [activeTab, setActiveTab] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateNotificationDto>({
    type: "system",
    title: "",
    subtitle: "",
    link: "",
  });

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearingBusy, setClearingBusy] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  // Tab counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: notifications.length,
      payment: 0,
      attendance: 0,
      class: 0,
      notice: 0,
      student: 0,
      system: 0,
    };
    notifications.forEach((n) => {
      if (map[n.type] !== undefined) {
        map[n.type]++;
      } else {
        map.system++;
      }
    });
    return map;
  }, [notifications]);

  // Filtered and sorted notifications list
  const filteredNotifications = useMemo(() => {
    let list = [...notifications];

    // Filter by Tab
    if (activeTab !== "all") {
      list = list.filter((n) => n.type === activeTab);
    }

    // Filter by Read / Unread Status
    if (statusFilter === "unread") {
      list = list.filter((n) => !n.read);
    } else if (statusFilter === "read") {
      list = list.filter((n) => n.read);
    }

    // Filter by Search Query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.subtitle.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q),
      );
    }

    // Sort order: Unread/newest first
    list.sort((a, b) => {
      // 1. Unread items always on top
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      // 2. Timestamp sorting
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const validA = !isNaN(timeA) && timeA > 0 ? timeA : 0;
      const validB = !isNaN(timeB) && timeB > 0 ? timeB : 0;

      if (sortOrder === "newest") {
        if (validB !== validA) return validB - validA;
        return b.id.localeCompare(a.id);
      } else {
        if (validA !== validB) return validA - validB;
        return a.id.localeCompare(b.id);
      }
    });

    return list;
  }, [notifications, activeTab, statusFilter, searchQuery, sortOrder]);

  // Bulk Selection Handlers
  const isAllSelected =
    filteredNotifications.length > 0 &&
    filteredNotifications.every((n) => selectedIds.has(n.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await markAsRead(id);
    }
    toast.success(`Marked ${ids.length} notification${ids.length === 1 ? "" : "s"} as read`);
    setSelectedIds(new Set());
  };

  const handleBulkMarkUnread = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await markAsUnread(id);
    }
    toast.success(`Marked ${ids.length} notification${ids.length === 1 ? "" : "s"} as unread`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await deleteNotification(id);
    }
    toast.success(`Deleted ${ids.length} notification${ids.length === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
  };

  // Clear Read Handler
  const handleClearRead = async () => {
    setClearingBusy(true);
    try {
      await clearRead();
      toast.success("Read notifications cleared");
      setConfirmClearOpen(false);
    } catch {
      toast.error("Failed to clear notifications");
    } finally {
      setClearingBusy(false);
    }
  };

  // Single Delete Handler
  const handleSingleDelete = async () => {
    if (!singleDeleteId) return;
    try {
      await deleteNotification(singleDeleteId);
      toast.success("Notification removed");
      setSingleDeleteId(null);
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  // Create Notification Form Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setCreateSubmitting(true);
    try {
      await createNotification(createForm);
      toast.success("Notification created successfully");
      setIsCreateOpen(false);
      setCreateForm({
        type: "system",
        title: "",
        subtitle: "",
        link: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create notification");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notification Center"
        description="Monitor system alerts, student payments, scheduled classes, and announcements in real-time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
              title="Refresh notifications"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  markAllAsRead();
                  toast.success("All notifications marked as read");
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClearOpen(true)}
              disabled={notifications.filter((n) => n.read).length === 0}
              title="Clear already read notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear read
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create alert
            </Button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Total Alerts</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-brand">
              <Bell className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink">
            {notifications.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">All active inbox items</p>
        </Card>

        <Card className="p-4 transition hover:border-rose-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Unread Alerts</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
            {unreadCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Awaiting your review</p>
        </Card>

        <Card className="p-4 transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Finance & Fees</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            {counts.payment}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Receipts & fee balances</p>
        </Card>

        <Card className="p-4 transition hover:border-blue-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Academic & Notices</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
            {counts.class + counts.notice + counts.attendance}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Classes, notices & rolls</p>
        </Card>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="mb-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<FilterType>
            value={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              setSelectedIds(new Set());
            }}
            items={[
              { id: "all", label: `All (${counts.all})` },
              { id: "student", label: `Students (${counts.student})` },
              { id: "payment", label: `Payments (${counts.payment})` },
              { id: "attendance", label: `Attendance (${counts.attendance})` },
              { id: "class", label: `Classes (${counts.class})` },
              { id: "notice", label: `Notices (${counts.notice})` },
              { id: "system", label: `System (${counts.system})` },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search notifications…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56"
            />
            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter status"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                aria-label="Sort order"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold text-ink">
                Selected notification{selectedIds.size === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleBulkMarkRead}>
                <MailOpen className="h-3.5 w-3.5" />
                Mark as read
              </Button>
              <Button size="sm" variant="secondary" onClick={handleBulkMarkUnread}>
                <Mail className="h-3.5 w-3.5" />
                Mark as unread
              </Button>
              <Button size="sm" variant="dangerSoft" onClick={handleBulkDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
              </Button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-muted hover:text-ink hover:underline"
              >
                Clear selection
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Notifications Listing */}
      {loading ? (
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCheck className="h-8 w-8 text-emerald-500" />}
            title="You're all caught up!"
            text={
              searchQuery || activeTab !== "all" || statusFilter !== "all"
                ? "No notifications match your chosen filters."
                : "No notifications right now. Any payments, notices, or class alerts will show up here."
            }
            action={
              searchQuery || activeTab !== "all" || statusFilter !== "all" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab("all");
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {/* Header select-all bar */}
          <div className="flex items-center justify-between px-2 text-xs text-muted">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-line text-primary focus:ring-primary/20"
              />
              <span>Select all on page ({filteredNotifications.length})</span>
            </label>
            <span>Sorted by {sortOrder === "newest" ? "Newest" : "Oldest"}</span>
          </div>

          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((item) => {
              const meta = getNotificationMeta(item.type);
              const isSelected = selectedIds.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={cn(
                      "group relative flex flex-col gap-3 p-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between",
                      !item.read
                        ? "border-primary/20 bg-primary/[0.02] shadow-sm ring-1 ring-primary/10"
                        : "opacity-85 hover:opacity-100",
                      isSelected && "border-primary bg-primary/[0.05]",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      {/* Checkbox */}
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          aria-label={`Select ${item.title}`}
                          className="h-4 w-4 cursor-pointer rounded border-line text-primary focus:ring-primary/20"
                        />
                      </div>

                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                          meta.tone,
                        )}
                      >
                        <meta.icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.badgeTone}>{meta.label}</Badge>
                          <h4
                            className={cn(
                              "text-sm tracking-tight text-ink",
                              item.read ? "font-normal" : "font-bold",
                            )}
                          >
                            {item.title}
                          </h4>
                          {!item.read && (
                            <span
                              className="h-2 w-2 rounded-full bg-rose-500 shadow-sm"
                              title="Unread notification"
                            />
                          )}
                        </div>

                        {item.subtitle && (
                          <p className="mt-1 text-xs text-muted leading-relaxed">
                            {item.subtitle}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                          <span className="font-medium text-muted/90">
                            {fmtNotificationDateTime(item.createdAt)}
                          </span>
                          {item.link && (
                            <>
                              <span>•</span>
                              <Link
                                to={item.link}
                                onClick={() => {
                                  if (!item.read) markAsRead(item.id);
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                              >
                                View details
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Row Actions */}
                    <div className="flex shrink-0 items-center justify-end gap-1 border-t border-line/40 pt-2 sm:border-0 sm:pt-0">
                      {item.read ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsUnread(item.id)}
                          title="Mark as unread"
                          aria-label="Mark as unread"
                          className="h-8 w-8 text-muted hover:text-ink"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsRead(item.id)}
                          title="Mark as read"
                          aria-label="Mark as read"
                          className="h-8 w-8 text-muted hover:text-brand"
                        >
                          <Check className="h-4 w-4 text-brand" />
                        </Button>
                      )}

                      {item.link && (
                        <Link
                          to={item.link}
                          onClick={() => {
                            if (!item.read) markAsRead(item.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
                          title="Navigate"
                          aria-label="Navigate"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSingleDeleteId(item.id)}
                        title="Delete notification"
                        aria-label="Delete notification"
                        className="h-8 w-8 text-muted hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal: Create Alert */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create System Notification"
        description="Dispatch a custom alert to the notification feed for administrative review."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={createSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createSubmitting || !createForm.title.trim()}
            >
              {createSubmitting ? "Creating…" : "Dispatch notification"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Field label="Category / Type">
            <Select
              value={createForm.type}
              onChange={(e) =>
                setCreateForm((p) => ({
                  ...p,
                  type: e.target.value as NotificationType,
                }))
              }
            >
              <option value="system">System Alert</option>
              <option value="payment">Payment & Fee Alert</option>
              <option value="class">Online Class Reminder</option>
              <option value="notice">Notice Announcement</option>
              <option value="attendance">Attendance Alert</option>
            </Select>
          </Field>

          <Field label="Title" hint="Brief headline of the alert">
            <Input
              value={createForm.title}
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Server maintenance scheduled"
              required
            />
          </Field>

          <Field label="Description / Message">
            <Textarea
              value={createForm.subtitle}
              onChange={(e) => setCreateForm((p) => ({ ...p, subtitle: e.target.value }))}
              placeholder="Provide context or instructions for this notification…"
              rows={3}
            />
          </Field>

          <Field
            label="Target Link (optional)"
            hint="Internal page URL (e.g., /dashboard/payments, /dashboard/notices)"
          >
            <Input
              value={createForm.link}
              onChange={(e) => setCreateForm((p) => ({ ...p, link: e.target.value }))}
              placeholder="/dashboard/..."
            />
          </Field>
        </form>
      </Modal>

      {/* Confirmation Dialog: Clear All Read */}
      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearRead}
        title="Clear Read Notifications?"
        text="This will delete all notifications that you have already marked as read. Unread items will remain intact."
        confirmLabel="Clear history"
        confirmLoadingLabel="Clearing…"
        confirmVariant="danger"
        loading={clearingBusy}
      />

      {/* Confirmation Dialog: Single Delete */}
      <ConfirmDialog
        open={Boolean(singleDeleteId)}
        onClose={() => setSingleDeleteId(null)}
        onConfirm={handleSingleDelete}
        title="Delete Notification?"
        text="Are you sure you want to remove this notification? This action cannot be undone."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        confirmVariant="danger"
      />
    </>
  );
}
