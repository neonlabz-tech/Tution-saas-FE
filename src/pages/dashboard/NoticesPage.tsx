import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Download,
  Eye,
  FileText,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import type { Notice, NoticeState } from "@/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InfoRow,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useBatches } from "@/hooks/useBatches";
import { NoticeFormModal } from "@/components/notices/NoticeFormModal";
import { ApiError, noticesApi } from "@/lib/api";
import {
  cn,
  formatDate,
  formatShortDate,
  fmtNotificationDateTime,
  formatBytes,
  getNoticeExpiryDate,
  isNoticeExpired,
  todayISO,
} from "@/lib/utils";

type Filter = "all" | NoticeState;
// Status dropdown. "active" is shown as "Published". Expired notices have no option; they show under "All statuses".
const STATUS_OPTIONS: { id: Filter; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "active", label: "Published" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Draft" },
];
const isAllBatches = (n: Notice) => n.allBatches === true || n.batches.length === 0;
const PRIORITY_BAR = { high: "bg-rose-500", medium: "bg-amber-500", low: "bg-teal-500" };

function formatExpiryLabel(n: Notice, st: NoticeState, now: Date): string {
  if (st === "draft") return "Draft";
  if (st === "scheduled") return `Publishes ${formatShortDate(n.publishDate)}`;
  const exp = getNoticeExpiryDate(n);
  if (st === "expired") return `Expired ${fmtNotificationDateTime(exp.toISOString())}`;

  const diffMs = exp.getTime() - now.getTime();
  if (diffMs >= 86_400_000) {
    const days = Math.ceil(diffMs / 86_400_000);
    return `${days}d left`;
  }
  if (diffMs >= 3_600_000) {
    const h = Math.floor(diffMs / 3_600_000);
    const m = Math.floor((diffMs % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
  }
  if (diffMs >= 60_000) return `${Math.floor(diffMs / 60_000)}m left`;
  return "Expires in < 1m";
}

export default function NoticesPage() {
  const toast = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [priority, setPriority] = useState("all");
  const [batch, setBatch] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; item: Notice | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const today = todayISO();
  const { batches: batchOptions } = useBatches();

  const loadNotices = () => {
    setLoading(true);
    noticesApi
      .list()
      .then((res) => setNotices(res.items))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Could not load notices"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (params.get("new") === "1") {
      setForm({ open: true, item: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Combine backend state with exact local expiry timestamp check so UI flips immediately at expiry time.
  const state = (n: Notice): NoticeState => {
    if (n.state === "draft" || n.status === "draft") return "draft";
    if (n.publishDate > today) return "scheduled";
    if (n.state === "expired" || isNoticeExpired(n, now)) return "expired";
    return n.state ?? "active";
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: notices.length, active: 0, scheduled: 0, expired: 0, draft: 0 };
    notices.forEach((n) => {
      c[state(n)] += 1;
    });
    return c;
  }, [notices, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return notices
      .filter(
        (n) =>
          (filter === "all" || state(n) === filter) &&
          (priority === "all" || n.priority === priority) &&
          (batch === "all" || isAllBatches(n) || n.batches.includes(batch)) &&
          (!s || n.title.toLowerCase().includes(s) || n.description.toLowerCase().includes(s)),
      )
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  }, [notices, filter, priority, batch, q, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = detailId ? notices.find((n) => n.id === detailId) : undefined;
  const delN = delId ? notices.find((n) => n.id === delId) : undefined;

  const handleDownload = async (notice: Notice) => {
    if (downloadingId || !notice.attachment) return;
    if (state(notice) === "expired") {
      toast.error("This document has expired and is no longer available.");
      return;
    }
    setDownloadingId(notice.id);
    try {
      await noticesApi.downloadAttachment(notice.id, notice.attachment.fileName);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 410 || err.status === 404)) {
        toast.error(err.message || "This document has expired and is no longer available.");
        loadNotices();
      } else {
        toast.error(err instanceof Error ? err.message : "Could not download document");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const BatchChips = ({ n }: { n: Notice }) =>
    isAllBatches(n) ? (
      <Badge tone="teal">
        <Users className="h-3 w-3" /> All batches
      </Badge>
    ) : (
      <>
        {n.batches.map((b) => (
          <Badge key={b} tone="neutral">
            {b}
          </Badge>
        ))}
      </>
    );

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements for students and batches — attach timetables or PDFs with automatic expiry."
        actions={
          <Button onClick={() => setForm({ open: true, item: null })}>
            <Plus className="h-4 w-4" /> Create notice
          </Button>
        }
      />

      {/* Filters, right above the cards */}
      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          placeholder="Search notices…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
        <div className="w-full sm:w-44">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({counts[o.id]})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch">
            <option value="all">All batches</option>
            {batchOptions.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="Loading notices"
            text="Fetching announcements from the server."
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No notices found"
            text="Nothing matches these filters."
            action={
              <Button onClick={() => setForm({ open: true, item: null })}>
                <Plus className="h-4 w-4" /> Create notice
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((n) => {
              const st = state(n);
              const expLabel = formatExpiryLabel(n, st, now);
              const hasActiveAttachment = Boolean(n.attachment && st !== "expired");
              const hasExpiredAttachment = Boolean(st === "expired" && (n.attachment || n.attachmentExpired));
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <Card
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop",
                      st === "expired" && "opacity-75",
                    )}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-1.5", PRIORITY_BAR[n.priority])} />
                    <button
                      onClick={() => setDetailId(n.id)}
                      className="flex-1 cursor-pointer p-5 pl-6 text-left"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={n.priority} />
                        <StatusBadge status={st === "active" ? "published" : st} />
                      </div>
                      <h3 className="font-heading text-base font-bold leading-snug">{n.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted">{n.description}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <BatchChips n={n} />
                      </div>
                      {hasActiveAttachment && n.attachment && (
                        <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{n.attachment.fileName}</span>
                          <span className="num shrink-0 opacity-75">· {formatBytes(n.attachment.size)}</span>
                        </div>
                      )}
                      {hasExpiredAttachment && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span>Document expired</span>
                        </div>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 pl-6">
                      <span
                        className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted"
                        title={`Expires ${fmtNotificationDateTime(getNoticeExpiryDate(n).toISOString())}`}
                      >
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{expLabel}</span>
                      </span>
                      <div className="flex shrink-0 gap-1">
                        {hasActiveAttachment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Download document"
                            title="Download document"
                            disabled={downloadingId === n.id}
                            onClick={() => void handleDownload(n)}
                          >
                            <Download className="h-4 w-4 text-brand" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="View"
                          title="View"
                          onClick={() => setDetailId(n.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => setForm({ open: true, item: n })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          className="hover:text-rose-500"
                          onClick={() => setDelId(n.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <NoticeFormModal
        open={form.open}
        item={form.item}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={loadNotices}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.title}
        footer={
          detail && (
            <>
              <Button variant="dangerSoft" onClick={() => setDelId(detail.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button
                onClick={() => {
                  setForm({ open: true, item: detail });
                  setDetailId(null);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detail.priority} />
              <StatusBadge status={state(detail) === "active" ? "published" : state(detail)} />
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{detail.description}</p>
            <div className="rounded-2xl border border-line p-4">
              <InfoRow label="Target">
                <span className="flex flex-wrap justify-end gap-1">
                  <BatchChips n={detail} />
                </span>
              </InfoRow>
              <InfoRow label="Publish date">{formatDate(detail.publishDate)}</InfoRow>
              <InfoRow label="Expires at">
                <span className="num">{fmtNotificationDateTime(getNoticeExpiryDate(detail).toISOString())}</span>
              </InfoRow>
            </div>

            {state(detail) !== "expired" && detail.attachment ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{detail.attachment.fileName}</p>
                    <p className="num text-[11px] text-muted">{formatBytes(detail.attachment.size)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={downloadingId === detail.id}
                  onClick={() => void handleDownload(detail)}
                >
                  <Download className="h-4 w-4" />
                  {downloadingId === detail.id ? "Downloading…" : "Download"}
                </Button>
              </div>
            ) : (
              state(detail) === "expired" &&
              (detail.attachment || detail.attachmentExpired) && (
                <div className="rounded-2xl border border-dashed border-line bg-surface-2/50 px-4 py-3 text-xs text-muted">
                  Document expired on{" "}
                  <span className="font-semibold text-ink">
                    {fmtNotificationDateTime(getNoticeExpiryDate(detail).toISOString())}
                  </span>{" "}
                  and is no longer available for download.
                </div>
              )
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!delN}
        onClose={() => setDelId(null)}
        title="Delete notice?"
        text={<>“{delN?.title}” will be permanently deleted. This cannot be undone.</>}
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={async () => {
          if (!delId) return;
          const id = delId;
          try {
            await noticesApi.remove(id);
            setNotices((current) => current.filter((notice) => notice.id !== id));
            setDetailId((current) => (current === id ? null : current));
            toast.success("Notice deleted");
          } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Could not delete notice");
            throw error;
          }
        }}
      />
    </>
  );
}
