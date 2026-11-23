import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Eye, Megaphone, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Notice, NoticeState } from "@/types";
import { Badge, Button, Card, EmptyState, InfoRow, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { BATCHES } from "@/data/mock";
import { NoticeFormModal } from "@/components/notices/NoticeFormModal";
import { noticesApi } from "@/lib/api";
import { cn, diffDays, fmtDate, todayISO } from "@/lib/utils";

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
  const today = todayISO();

  const loadNotices = () => {
    setLoading(true);
    noticesApi.list()
      .then((res) => setNotices(res.items))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load notices"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.get("new") === "1") { setForm({ open: true, item: null }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  // Prefer the backend-computed state; fall back for safety.
  const state = (n: Notice): NoticeState =>
    n.state ?? (n.status === "draft" ? "draft" : n.publishDate > today ? "scheduled" : n.expiryDate < today ? "expired" : "active");
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: notices.length, active: 0, scheduled: 0, expired: 0, draft: 0 };
    notices.forEach((n) => { c[state(n)] += 1; });
    return c;
  }, [notices]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return notices
      .filter((n) => (filter === "all" || state(n) === filter) && (priority === "all" || n.priority === priority) && (batch === "all" || isAllBatches(n) || n.batches.includes(batch)) && (!s || n.title.toLowerCase().includes(s) || n.description.toLowerCase().includes(s)))
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  }, [notices, filter, priority, batch, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = detailId ? notices.find((n) => n.id === detailId) : undefined;
  const delN = delId ? notices.find((n) => n.id === delId) : undefined;

  const BatchChips = ({ n }: { n: Notice }) =>
    isAllBatches(n) ? <Badge tone="teal"><Users className="h-3 w-3" /> All batches</Badge> : <>{n.batches.map((b) => <Badge key={b} tone="neutral">{b}</Badge>)}</>;

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements for students and batches."
        actions={<Button onClick={() => setForm({ open: true, item: null })}><Plus className="h-4 w-4" /> Create notice</Button>}
      />

      {/* Filters, right above the cards */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search notices…" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 sm:w-56" />
        <div className="sm:w-44"><Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">{STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label} ({counts[o.id]})</option>)}</Select></div>
        <div className="sm:w-40"><Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority"><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></div>
        <div className="col-span-2 sm:w-44"><Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch"><option value="all">All batches</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select></div>
      </div>

      {loading ? (
        <Card><EmptyState icon={<Megaphone className="h-6 w-6" />} title="Loading notices" text="Fetching announcements from the server." /></Card>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="h-6 w-6" />} title="No notices found" text="Nothing matches these filters." action={<Button onClick={() => setForm({ open: true, item: null })}><Plus className="h-4 w-4" /> Create notice</Button>} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((n) => {
              const st = state(n);
              const left = diffDays(today, n.expiryDate);
              return (
                <motion.div key={n.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                  <Card className={cn("group relative flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop", st === "expired" && "opacity-75")}>
                    <span className={cn("absolute inset-y-0 left-0 w-1.5", PRIORITY_BAR[n.priority])} />
                    <button onClick={() => setDetailId(n.id)} className="flex-1 cursor-pointer p-5 pl-6 text-left">
                      <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={n.priority} /><StatusBadge status={st === "active" ? "published" : st} /></div>
                      <h3 className="font-heading text-base font-bold leading-snug">{n.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted">{n.description}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5"><BatchChips n={n} /></div>
                    </button>
                    <div className="flex items-center justify-between border-t border-line px-5 py-3 pl-6">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted"><CalendarClock className="h-3.5 w-3.5" />{st === "draft" ? "Draft" : st === "scheduled" ? `Publishes ${fmtDate(n.publishDate, false)}` : st === "expired" ? `Expired ${fmtDate(n.expiryDate, false)}` : left === 0 ? "Expires today" : `${left}d left`}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label="View" title="View" onClick={() => setDetailId(n.id)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ open: true, item: n })}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(n.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <NoticeFormModal open={form.open} item={form.item} onClose={() => setForm((f) => ({ ...f, open: false }))} onSaved={loadNotices} />

      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.title}
        footer={detail && <><Button variant="dangerSoft" onClick={() => setDelId(detail.id)}><Trash2 className="h-4 w-4" /> Delete</Button><Button onClick={() => { setForm({ open: true, item: detail }); setDetailId(null); }}><Pencil className="h-4 w-4" /> Edit</Button></>}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><StatusBadge status={detail.priority} /><StatusBadge status={state(detail) === "active" ? "published" : state(detail)} /></div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{detail.description}</p>
            <div className="rounded-2xl border border-line p-4">
              <InfoRow label="Target"><span className="flex flex-wrap justify-end gap-1"><BatchChips n={detail} /></span></InfoRow>
              <InfoRow label="Publish date">{fmtDate(detail.publishDate)}</InfoRow>
              <InfoRow label="Expiry date">{fmtDate(detail.expiryDate)}</InfoRow>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!delN}
        onClose={() => setDelId(null)}
        title="Delete notice?"
        text={<>“{delN?.title}” will be permanently deleted. This cannot be undone.</>}
        onConfirm={() => {
          if (!delId) return;
          const id = delId;
          noticesApi.remove(id)
            .then(() => { setNotices((current) => current.filter((notice) => notice.id !== id)); setDetailId((current) => (current === id ? null : current)); toast.success("Notice deleted"); })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not delete notice"));
        }}
      />
    </>
  );
}
