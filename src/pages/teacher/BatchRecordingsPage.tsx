import { useMemo, useState } from "react";
import { Clock, ExternalLink, MonitorPlay, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { useReport } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { deleteRecording, listRecordings, saveRecording } from "@/lib/teacherApi";
import { ALLOWED_RECORDING_EXT } from "@/lib/teacherPolicy";
import { fmtDate, todayISO } from "@/lib/utils";
import type { TeacherRecording } from "@/types/teacher";

const monthOf = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function BatchRecordingsPage() {
  const { batch } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const toast = useToast();
  const report = useReport();
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{ open: boolean; item: TeacherRecording | null }>({ open: false, item: null });
  const [del, setDel] = useState<TeacherRecording | null>(null);
  const [play, setPlay] = useState<TeacherRecording | null>(null);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (actor ? listRecordings(actor, batch) : []), [actor, batch, tick]);
  const groups = useMemo(() => {
    const m = new Map<string, TeacherRecording[]>();
    items.forEach((r) => m.set(monthOf(r.date), [...(m.get(monthOf(r.date)) ?? []), r]));
    return [...m.entries()];
  }, [items]);
  if (!actor) return null;

  const openForm = (item: TeacherRecording | null) => {
    setForm({ open: true, item });
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setDate(item?.date ?? todayISO());
    setVideoUrl(item?.source === "link" ? item.videoUrl : "");
    setFile(null);
    setError(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveRecording(actor, batch, { title, description, date, videoUrl, file }, form.item ?? undefined);
      toast.success(form.item ? "Recording updated" : "Recording added");
      setForm({ open: false, item: null });
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the recording.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{items.length} recording{items.length === 1 ? "" : "s"} for {batch.moduleName}.</p>
        <Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add recording</Button>
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={<MonitorPlay className="h-6 w-6" />} title="No recordings yet" text="Add a video link or upload a recorded class." action={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add recording</Button>} /></Card>
      ) : (
        groups.map(([month, recs]) => (
          <section key={month} className="mb-6">
            <h2 className="mb-3 font-heading text-sm font-bold text-muted">{month}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recs.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <button onClick={() => { setPlay(r); setFailed(false); }} aria-label={`Watch ${r.title}`} className="relative flex aspect-video w-full cursor-pointer items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
                  </button>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 text-sm font-bold leading-snug">{r.title}</h3><Badge tone="neutral">{r.source === "upload" ? "Uploaded" : "Link"}</Badge></div>
                    {r.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{r.description}</p>}
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><Clock className="h-3 w-3" />{fmtDate(r.date)} · {batch.moduleName}</p>
                    <div className="mt-3 flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => openForm(r)} aria-label={`Edit ${r.title}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button size="sm" variant="secondary" onClick={() => setDel(r)} aria-label={`Remove ${r.title}`}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button></div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <Modal open={form.open} onClose={() => !busy && setForm({ open: false, item: null })} title={form.item ? "Edit recording" : "Add recording"} description={`${batch.moduleName} · ${batch.batch}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setForm({ open: false, item: null })}>Cancel</Button><Button loading={busy} onClick={() => void save()}>{form.item ? "Save changes" : "Add recording"}</Button></>}>
        <div className="space-y-4">
          {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 4: Integration" aria-label="Title" /></Field>
          <Field label="Description (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" /></Field>
          <Field label="Class date"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Class date" /></Field>
          <Field label="Video link (YouTube, Vimeo, Drive…)"><Input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" aria-label="Video link" /></Field>
          <Field label="…or upload a file" hint={ALLOWED_RECORDING_EXT.join(", ")}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-3 text-sm hover:border-primary/50"><Upload className="h-4 w-4 text-muted" /><span className="truncate">{file ? file.name : "Choose a video…"}</span><input type="file" aria-label="Recording file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          </Field>
        </div>
      </Modal>
      <Modal open={!!play} onClose={() => setPlay(null)} size="lg" title={play?.title} description={play ? `Recorded ${fmtDate(play.date)}` : undefined}>
        {play && (
          <div className="overflow-hidden rounded-2xl bg-black">
            {failed || !/\.(mp4|webm|mov)(\?|$)/i.test(play.videoUrl) ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-white"><MonitorPlay className="h-8 w-8 opacity-70" /><p className="text-sm">{failed ? "This recording couldn't be played here." : "This recording is hosted on an external site."}</p><a href={play.videoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold underline">Open in a new tab <ExternalLink className="h-3.5 w-3.5" /></a></div>
            ) : (<video key={play.id} src={play.videoUrl} controls playsInline className="aspect-video w-full" onError={() => setFailed(true)} />)}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Remove this recording?" text={<>“{del?.title}” will be removed for students. {del?.source === "upload" ? "The uploaded file is deleted too." : "Only the link is removed."}</>} confirmLabel="Remove"
        onConfirm={async () => { if (!del) return; try { await deleteRecording(actor, del); toast.success("Recording removed"); setTick((t) => t + 1); } catch (e) { report(e); } setDel(null); }} />
    </>
  );
}
