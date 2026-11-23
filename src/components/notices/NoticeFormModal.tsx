import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Notice } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { BATCHES } from "@/data/mock";
import { noticesApi } from "@/lib/api";
import { addDays, toISO, todayISO } from "@/lib/utils";

/**
 * Publish date cannot be in the past for a new notice. When editing, an
 * already-past publish date may be kept as-is (it is live already), but it
 * cannot be moved to another past date.
 */
const makeSchema = (originalPublishDate?: string) =>
  z
    .object({
      title: z.string().min(4, "Enter a notice title"),
      description: z.string().min(10, "Describe the notice (min 10 characters)"),
      allBatches: z.boolean(),
      batches: z.array(z.string()),
      publishDate: z.string().min(1, "Required"),
      expiryDate: z.string().min(1, "Required"),
      priority: z.enum(["low", "medium", "high"]),
      status: z.enum(["published", "draft"]),
    })
    .refine((v) => v.publishDate === originalPublishDate || v.publishDate >= todayISO(), { path: ["publishDate"], message: "Publish date cannot be in the past" })
    .refine((v) => v.expiryDate >= v.publishDate, { path: ["expiryDate"], message: "Expiry must be on or after the publish date" })
    .refine((v) => v.allBatches || v.batches.length > 0, { path: ["batches"], message: "Select at least one batch, or choose All batches" });
type Values = z.infer<ReturnType<typeof makeSchema>>;

function Inner({ item, onClose, onSaved }: { item: Notice | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(makeSchema(item?.publishDate)),
    defaultValues: item
      ? { title: item.title, description: item.description, allBatches: item.allBatches ?? item.batches.length === 0, batches: item.batches, publishDate: item.publishDate, expiryDate: item.expiryDate, priority: item.priority, status: item.status }
      : { title: "", description: "", allBatches: false, batches: [], publishDate: todayISO(), expiryDate: toISO(addDays(new Date(), 7)), priority: "medium", status: "published" },
  });
  const allBatches = watch("allBatches");
  const publishDate = watch("publishDate");
  const today = todayISO();
  // Keep an existing past publish date selectable when editing.
  const minPublish = item && item.publishDate < today ? item.publishDate : today;
  const onSubmit = (v: Values) => {
    const payload = { ...v, batches: v.allBatches ? [] : v.batches };
    const save = item ? noticesApi.update(item.id, payload) : noticesApi.create(payload);
    save
      .then(() => {
        toast.success(item ? "Notice updated" : v.status === "draft" ? "Notice saved as draft" : "Notice published");
        onSaved();
        onClose();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not save notice"));
  };
  return (
    <form id="notice-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Notice title" error={errors.title?.message} className="sm:col-span-2"><Input {...register("title")} placeholder="e.g. Today's class has been cancelled" /></Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></Field>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-ink/80">Target batches</span>
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-line px-3 py-2">
          <Controller control={control} name="allBatches" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Send to all batches" />} />
          <span className="text-sm">All batches</span>
          <span className="text-[11px] text-muted">Every current and future batch sees this notice</span>
        </div>
        {!allBatches && (
          <Controller control={control} name="batches" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={BATCHES.map((b) => ({ value: b, label: b }))} />} />
        )}
        {errors.batches?.message && <span className="mt-1 block text-[11px] font-medium text-rose-500">{errors.batches.message}</span>}
      </div>
      {/* deps: re-validate the other date so a fixed error does not stay on screen */}
      <Field label="Publish date" error={errors.publishDate?.message}><Input type="date" min={minPublish} {...register("publishDate", { deps: ["expiryDate"] })} /></Field>
      <Field label="Expiry date" error={errors.expiryDate?.message}><Input type="date" min={publishDate || today} {...register("expiryDate", { deps: ["publishDate"] })} /></Field>
      <Field label="Priority"><Select {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
      <Field label="Status"><Select {...register("status")}><option value="published">Published</option><option value="draft">Draft</option></Select></Field>
    </form>
  );
}

export function NoticeFormModal({ open, item, onClose, onSaved }: { open: boolean; item: Notice | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? "Edit notice" : "Create notice"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="notice-form">{item ? "Save changes" : "Save notice"}</Button>
        </>
      }
    >
      <Inner item={item} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
