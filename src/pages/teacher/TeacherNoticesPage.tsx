import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { ErrorState, PageSkeleton } from "@/components/student/states";
import { useReport } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { createNotice, deleteNotice, listNotices, updateNotice, type TeacherNoticeView } from "@/lib/teacherApi";
import { addDays, fmtDate, toISO } from "@/lib/utils";

const PRIORITY_TONE = { high: "rose", medium: "amber", low: "neutral" } as const;

export default function TeacherNoticesPage() {
  const { actor, batches } = useTeacherPortal();
  const toast = useToast();
  const report = useReport();
  const [items, setItems] = useState<TeacherNoticeView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "mine" | "admin">("all");
  const [form, setForm] = useState<{ open: boolean; item: TeacherNoticeView | null }>({ open: false, item: null });
  const [del, setDel] = useState<TeacherNoticeView | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [expiry, setExpiry] = useState("");
  const [fErr, setFErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    setError(null);
    listNotices(actor).then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Could not load notices."));
  }, [actor]);
  useEffect(load, [load]);

  const myBatchNames = [...new Set(batches.map((b) => b.batch))];
  const openForm = (item: TeacherNoticeView | null) => {
    setForm({ open: true, item });
    setTitle(item?.notice.title ?? "");
    setDescription(item?.notice.description ?? "");
    setBatchNames(item?.notice.batches ?? myBatchNames.slice(0, 1));
    setPriority(item?.notice.priority ?? "medium");
    setExpiry(item?.notice.expiryDate ?? toISO(addDays(new Date(), 14)));
    setFErr(null);
  };
  const save = async () => {
    if (!actor) return;
    setBusy(true);
    setFErr(null);
    try {
      const input = { title, description, batches: batchNames, priority, expiryDate: expiry };
      if (form.item) await updateNotice(actor, form.item.notice.id, input);
      else await createNotice(actor, input, "academic");
      toast.success(form.item ? "Notice updated" : "Notice published");
      setForm({ open: false, item: null });
      load();
    } catch (e) { setFErr(e instanceof Error ? e.message : "Could not save the notice."); }
    setBusy(false);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <PageSkeleton />;
  const shown = items.filter((n) => tab === "all" || (tab === "mine" ? n.owned : !n.owned));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-2xl bg-surface-2 p-1">
          {([["all", "All"], ["mine", "My notices"], ["admin", "From admin"]] as const).map(([k, l]) => (<button key={k} onClick={() => setTab(k)} className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-semibold ${tab === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{l}</button>))}
        </div>
        <Button onClick={() => openForm(null)} disabled={!myBatchNames.length}><Plus className="h-4 w-4" /> New notice</Button>
      </div>
      {shown.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="h-6 w-6" />} title="No notices here" text="Admin announcements and the notices you publish for your batches appear here." /></Card>
      ) : (
        <div className="space-y-3">
          {shown.map((v) => (
            <Card key={v.notice.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{v.notice.title}</h3><Badge tone={PRIORITY_TONE[v.notice.priority]}>{v.notice.priority}</Badge>{v.kind === "admin" ? <Badge tone="neutral">Admin</Badge> : v.kind === "result" ? <Badge tone="green">Results</Badge> : <Badge tone="primary">Academic</Badge>}</div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-muted">{v.notice.description}</p>
                  <p className="mt-2 text-[11px] text-muted">{v.notice.allBatches || !v.notice.batches.length ? "All batches" : v.notice.batches.join(", ")} · Published {fmtDate(v.notice.publishDate)} · Expires {fmtDate(v.notice.expiryDate)}</p>
                </div>
                {v.owned ? (
                  <div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => openForm(v)} aria-label={`Edit ${v.notice.title}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button size="sm" variant="secondary" onClick={() => setDel(v)} aria-label={`Delete ${v.notice.title}`}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button></div>
                ) : <span className="text-[11px] text-muted">Read-only</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={form.open} onClose={() => !busy && setForm({ open: false, item: null })} title={form.item ? "Edit notice" : "New notice"} description="Visible to students in the batches you choose."
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setForm({ open: false, item: null })}>Cancel</Button><Button loading={busy} onClick={() => void save()}>{form.item ? "Save changes" : "Publish notice"}</Button></>}>
        <div className="space-y-4">
          {fErr && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{fErr}</p>}
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" /></Field>
          <Field label="Message"><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Message" /></Field>
          <Field label="Batches">
            <div className="flex flex-wrap gap-2">
              {myBatchNames.map((b) => { const on = batchNames.includes(b); return (<button type="button" key={b} aria-pressed={on} onClick={() => setBatchNames(on ? batchNames.filter((x) => x !== b) : [...batchNames, b])} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary/10 text-brand" : "border-line text-muted"}`}>{b}</button>); })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")} aria-label="Priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
            <Field label="Expires on"><Input type="date" value={expiry} min={toISO(new Date())} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry date" /></Field>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete this notice?" text={<>“{del?.notice.title}” will be removed for students. This can’t be undone.</>} confirmLabel="Delete"
        onConfirm={async () => { if (!del || !actor) return; try { await deleteNotice(actor, del.notice.id); toast.success("Notice deleted"); load(); } catch (e) { report(e); } setDel(null); }} />
    </>
  );
}
