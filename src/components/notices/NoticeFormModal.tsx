import { useRef, useState, type DragEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import type { Notice } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Badge, Button, Field, Input, MultiSelect, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { applyApiValidationErrors, noticesApi, type NoticePayload } from "@/lib/api";
import { useBatches } from "@/hooks/useBatches";
import { addDays, cn, formatBytes, getNoticeExpiryDate, isNoticeExpired, pad, toDateInput, toISO, todayISO } from "@/lib/utils";

const MAX_NOTICE_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXT_RE = /\.(pdf|png|jpe?g|webp)$/i;

function getDefaultExpiryTime(item: Notice | null): string {
  if (item?.expiryTime && /^\d{2}:\d{2}$/.test(item.expiryTime)) return item.expiryTime;
  if (item?.expiresAt) {
    const d = new Date(item.expiresAt);
    if (!Number.isNaN(d.getTime())) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return "23:59";
}

function buildExpiresAtISO(expiryDate: string, expiryTime: string): string {
  const [y, m, d] = expiryDate.split("-").map(Number);
  const [hh, mm] = expiryTime.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh ?? 23, mm ?? 59, 0, 0).toISOString();
}

/**
 * Publish date cannot be in the past for a new notice. When editing, an
 * already-past publish date may be kept as-is (it is live already), but it
 * cannot be moved to another past date.
 */
const makeSchema = (originalPublishDate?: string) =>
  z
    .object({
      title: z.string().trim().min(4, "Enter a notice title"),
      description: z.string().trim().min(10, "Describe the notice (min 10 characters)"),
      allBatches: z.boolean(),
      batches: z.array(z.string()),
      publishDate: z.string().min(1, "Required"),
      expiryDate: z.string().min(1, "Required"),
      expiryTime: z.string().regex(/^\d{2}:\d{2}$/, "Select expiry time"),
      priority: z.enum(["low", "medium", "high"]),
      status: z.enum(["published", "draft"]),
    })
    .refine((v) => v.publishDate === originalPublishDate || v.publishDate >= todayISO(), {
      path: ["publishDate"],
      message: "Publish date cannot be in the past",
    })
    .refine((v) => v.expiryDate >= v.publishDate, {
      path: ["expiryDate"],
      message: "Expiry must be on or after the publish date",
    })
    .refine((v) => v.allBatches || v.batches.length > 0, {
      path: ["batches"],
      message: "Select at least one batch, or choose All batches",
    });
type Values = z.infer<ReturnType<typeof makeSchema>>;

function Inner({
  item,
  onClose,
  onSaved,
  onSubmittingChange,
}: {
  item: Notice | null;
  onClose: () => void;
  onSaved: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedTarget, setSavedTarget] = useState<Notice | null>(item);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const activeSource = savedTarget ?? item;
  const { batches: batchOptions, registerBatches } = useBatches(activeSource?.batches);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(makeSchema(activeSource?.publishDate)),
    defaultValues: activeSource
      ? {
          title: activeSource.title,
          description: activeSource.description,
          allBatches: activeSource.allBatches ?? activeSource.batches.length === 0,
          batches: activeSource.batches,
          publishDate: toDateInput(activeSource.publishDate),
          expiryDate: toDateInput(activeSource.expiryDate),
          expiryTime: getDefaultExpiryTime(activeSource),
          priority: activeSource.priority,
          status: activeSource.status,
        }
      : {
          title: "",
          description: "",
          allBatches: false,
          batches: [],
          publishDate: todayISO(),
          expiryDate: toISO(addDays(new Date(), 7)),
          expiryTime: "23:59",
          priority: "medium",
          status: "published",
        },
  });

  const allBatches = watch("allBatches");
  const publishDate = watch("publishDate");
  const today = todayISO();
  // Keep an existing past publish date selectable when editing.
  const minPublish = activeSource && activeSource.publishDate < today ? toDateInput(activeSource.publishDate) : today;

  const existingAttachment =
    activeSource?.attachment && !removeExisting && !isNoticeExpired(activeSource)
      ? activeSource.attachment
      : null;

  const validateAndStageFile = (file: File | undefined) => {
    if (!file) return;
    setFileError(null);

    const validMime = file.type ? ALLOWED_MIME_TYPES.has(file.type) : false;
    const validExt = ALLOWED_EXT_RE.test(file.name);
    if (!validMime && !validExt) {
      setFileError("Only PDF documents or timetable images (PNG, JPG, WebP) are supported.");
      return;
    }
    if (file.size > MAX_NOTICE_FILE_BYTES) {
      setFileError(`File size (${formatBytes(file.size)}) exceeds the 5 MB limit.`);
      return;
    }
    setPendingFile(file);
    setRemoveExisting(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    validateAndStageFile(e.dataTransfer.files?.[0]);
  };

  const onSubmit = async (v: Values) => {
    if (pendingFile) {
      const targetExpiry = getNoticeExpiryDate({ expiryDate: v.expiryDate, expiryTime: v.expiryTime });
      if (targetExpiry.getTime() <= Date.now()) {
        setError("expiryTime", {
          type: "manual",
          message: "Choose a future expiry date & time for the uploaded document",
        });
        return;
      }
    }

    const payload: NoticePayload = {
      title: v.title.trim(),
      description: v.description.trim(),
      allBatches: v.allBatches,
      batches: v.allBatches ? [] : v.batches,
      publishDate: v.publishDate,
      expiryDate: v.expiryDate,
      expiryTime: v.expiryTime,
      expiresAt: buildExpiresAtISO(v.expiryDate, v.expiryTime),
      priority: v.priority,
      status: v.status,
    };

    onSubmittingChange(true);
    let currentSaved: Notice | null = savedTarget;
    try {
      currentSaved = savedTarget
        ? await noticesApi.update(savedTarget.id, payload)
        : await noticesApi.create(payload);
      setSavedTarget(currentSaved);
      registerBatches(payload.batches);
    } catch (err: unknown) {
      applyApiValidationErrors(err, setError);
      toast.error(err instanceof Error ? err.message : "Could not save notice");
      onSubmittingChange(false);
      return;
    }

    try {
      if (pendingFile) {
        await noticesApi.uploadAttachment(currentSaved.id, pendingFile);
      } else if (savedTarget?.attachment && removeExisting) {
        await noticesApi.removeAttachment(currentSaved.id);
      }
      toast.success(
        item ? "Notice updated" : v.status === "draft" ? "Notice saved as draft" : "Notice published",
      );
      onSaved();
      onClose();
    } catch (err: unknown) {
      onSaved();
      const msg = err instanceof Error ? err.message : "Attachment upload failed";
      setFileError(msg);
      toast.error(`Notice saved, but attachment update failed: ${msg}`);
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form id="notice-form" noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Notice title" error={errors.title?.message} className="sm:col-span-2">
        <Input {...register("title")} placeholder="e.g. Term 2 Timetable & Exam Schedule" />
      </Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
        <Textarea {...register("description")} />
      </Field>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-ink/80">Target batches</span>
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-line px-3 py-2">
          <Controller
            control={control}
            name="allBatches"
            render={({ field }) => (
              <Switch checked={field.value} onChange={field.onChange} label="Send to all batches" />
            )}
          />
          <span className="text-sm">All batches</span>
          <span className="text-[11px] text-muted">Every current and future batch sees this notice</span>
        </div>
        {!allBatches && (
          <Controller
            control={control}
            name="batches"
            render={({ field }) => (
              <MultiSelect
                value={field.value}
                onChange={field.onChange}
                options={batchOptions.map((b) => ({ value: b, label: b }))}
                allowCustom
                onAddCustom={(newBatch) => registerBatches([newBatch])}
              />
            )}
          />
        )}
        {errors.batches?.message && (
          <span className="mt-1 block text-[11px] font-medium text-rose-500">{errors.batches.message}</span>
        )}
      </div>

      {/* deps: re-validate the other date so a fixed error does not stay on screen */}
      <Field label="Publish date" error={errors.publishDate?.message}>
        <Input type="date" min={minPublish} {...register("publishDate", { deps: ["expiryDate"] })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry date" error={errors.expiryDate?.message}>
          <Input type="date" min={publishDate || today} {...register("expiryDate", { deps: ["publishDate"] })} />
        </Field>
        <Field label="Expiry time" error={errors.expiryTime?.message}>
          <Input type="time" {...register("expiryTime")} />
        </Field>
      </div>

      <Field label="Priority">
        <Select {...register("priority")}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
      </Field>
      <Field label="Status">
        <Select {...register("status")}>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </Select>
      </Field>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-ink/80">
          Timetable / PDF Document <span className="font-normal text-muted">(optional · max 5 MB)</span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            validateAndStageFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {pendingFile ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pendingFile.name}</p>
                <p className="num text-[11px] text-muted">{formatBytes(pendingFile.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="primary">Ready to upload</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear file"
                onClick={() => {
                  setPendingFile(null);
                  setFileError(null);
                }}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          </div>
        ) : existingAttachment ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{existingAttachment.fileName}</p>
                <p className="num text-[11px] text-muted">{formatBytes(existingAttachment.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="soft" onClick={() => fileInputRef.current?.click()}>
                Replace
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove attachment"
                onClick={() => setRemoveExisting(true)}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition",
              dragOver ? "border-primary bg-primary/5" : "border-line bg-surface-2/40 hover:border-primary/50",
            )}
          >
            <UploadCloud className="mb-2 h-6 w-6 text-brand" />
            <p className="text-sm font-semibold">Click to upload or drag and drop</p>
            <p className="mt-0.5 text-[11px] text-muted">
              PDF or timetable image (PNG, JPG, WebP) · Max 5 MB · Auto-removed from Cloudflare R2 at expiry time
            </p>
          </div>
        )}
        {fileError && <span className="mt-1.5 block text-[11px] font-medium text-rose-500">{fileError}</span>}
      </div>
    </form>
  );
}

export function NoticeFormModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: Notice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      title={item ? "Edit notice" : "Create notice"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="notice-form" disabled={submitting}>
            {submitting ? "Saving…" : item ? "Save changes" : "Save notice"}
          </Button>
        </>
      }
    >
      {open && (
        <Inner
          key={item?.id ?? "new"}
          item={item}
          onClose={onClose}
          onSaved={onSaved}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
