import { useState } from "react";
import { Download, ExternalLink, FileText, FolderOpen, Link2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useBatchCtx } from "@/components/teacher/BatchLayout";
import { fmtSize, useReport } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { deleteMaterial, listMaterials, saveMaterial } from "@/lib/teacherApi";
import { ALLOWED_MATERIAL_EXT, MAX_UPLOAD_BYTES } from "@/lib/teacherPolicy";
import { downloadSampleMaterial, openLink } from "@/lib/teacherFiles";
import { fmtDate } from "@/lib/utils";
import type { TeacherMaterial } from "@/types/teacher";

export default function BatchMaterialsPage() {
  const { batch } = useBatchCtx();
  const { actor } = useTeacherPortal();
  const toast = useToast();
  const report = useReport();
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{ open: boolean; item: TeacherMaterial | null }>({ open: false, item: null });
  const [del, setDel] = useState<TeacherMaterial | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"file" | "link">("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!actor) return null;
  const items = listMaterials(actor, batch);
  void tick;

  const openForm = (item: TeacherMaterial | null) => {
    setForm({ open: true, item });
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setKind(item?.kind ?? "file");
    setUrl(item?.kind === "link" ? item.url : "");
    setFile(null);
    setError(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveMaterial(actor, batch, { title, description, kind, file, url }, form.item ?? undefined);
      toast.success(form.item ? "Material updated" : "Material added");
      setForm({ open: false, item: null });
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the material.");
    } finally {
      setBusy(false);
    }
  };
  const open = (m: TeacherMaterial) => (m.url ? openLink(m.url, m.kind === "file" ? m.fileName : undefined) : downloadSampleMaterial(m.title, m.description));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{items.length} item{items.length === 1 ? "" : "s"} visible to students in this batch.</p>
        <Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add material</Button>
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={<FolderOpen className="h-6 w-6" />} title="No study materials yet" text="Upload lecture notes and documents, or share an external learning link." action={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add material</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-brand">{m.kind === "link" ? <Link2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.title}</p>
                <p className="truncate text-xs text-muted">{m.description || (m.kind === "link" ? m.url : m.fileName)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><Badge tone="neutral" className="uppercase">{m.kind === "link" ? "link" : (m.fileName?.split(".").pop() ?? "file")}</Badge>{m.sizeBytes ? <span>{fmtSize(m.sizeBytes)}</span> : null}<span>Uploaded {fmtDate(m.uploadedAt.slice(0, 10))}</span></p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="soft" onClick={() => open(m)} aria-label={`${m.kind === "link" ? "Open" : "Download"} ${m.title}`}>{m.kind === "link" ? <><ExternalLink className="h-3.5 w-3.5" /> Open</> : <><Download className="h-3.5 w-3.5" /> Download</>}</Button>
                <Button size="sm" variant="secondary" onClick={() => openForm(m)} aria-label={`Edit ${m.title}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="secondary" onClick={() => setDel(m)} aria-label={`Remove ${m.title}`}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={form.open} onClose={() => !busy && setForm({ open: false, item: null })} title={form.item ? "Edit material" : "Add study material"} description={`${batch.moduleName} · ${batch.batch}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setForm({ open: false, item: null })}>Cancel</Button><Button loading={busy} onClick={() => void save()}>{form.item ? "Save changes" : "Add material"}</Button></>}>
        <div className="space-y-4">
          {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 3 lecture notes" aria-label="Title" /></Field>
          <Field label="Description (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" /></Field>
          {!form.item && (
            <div className="inline-flex gap-1 rounded-2xl bg-surface-2 p-1">
              {(["file", "link"] as const).map((k) => (<button key={k} type="button" onClick={() => setKind(k)} className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-semibold ${kind === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{k === "file" ? "Upload file" : "External link"}</button>))}
            </div>
          )}
          {kind === "file" ? (
            <Field label={form.item ? "Replace file (optional)" : "File"} hint={`${ALLOWED_MATERIAL_EXT.join(", ")} · max ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB`}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-surface-2/50 px-4 py-3 text-sm hover:border-primary/50">
                <Upload className="h-4 w-4 text-muted" /><span className="truncate">{file ? file.name : form.item?.fileName ?? "Choose a file…"}</span>
                <input type="file" aria-label="Material file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          ) : (
            <Field label="Link"><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" /></Field>
          )}
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Remove this material?" text={<>“{del?.title}” will no longer be available to students in {batch.batch}.</>} confirmLabel="Remove"
        onConfirm={async () => { if (!del) return; try { await deleteMaterial(actor, del); toast.success("Material removed"); setTick((t) => t + 1); } catch (e) { report(e); } setDel(null); }} />
    </>
  );
}
