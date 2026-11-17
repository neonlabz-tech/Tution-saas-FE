import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Notice } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { BATCHES } from "@/data/mock";
import { noticesApi } from "@/lib/api";
import { addDays, toISO, todayISO } from "@/lib/utils";

const schema = z
  .object({
    title: z.string().min(4, "Enter a notice title"),
    description: z.string().min(10, "Describe the notice (min 10 characters)"),
    batches: z.array(z.string()),
    publishDate: z.string().min(1, "Required"),
    expiryDate: z.string().min(1, "Required"),
    priority: z.enum(["low", "medium", "high"]),
    status: z.enum(["published", "draft"]),
  })
  .refine((v) => v.expiryDate >= v.publishDate, { path: ["expiryDate"], message: "Expiry must be on or after the publish date" });
type Values = z.infer<typeof schema>;

function Inner({ item, onClose, onSaved }: { item: Notice | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item ? { ...item } : { title: "", description: "", batches: [], publishDate: todayISO(), expiryDate: toISO(addDays(new Date(), 7)), priority: "medium", status: "published" },
  });
  const onSubmit = (v: Values) => {
    const save = item ? noticesApi.update(item.id, v) : noticesApi.create(v);
    save
      .then(() => {
        toast.success(item ? "Notice updated" : v.status === "draft" ? "Notice saved as draft" : "Notice published");
        onSaved();
        onClose();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not save notice"));
  };
  return (
    <form id="notice-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Notice title" error={errors.title?.message} className="sm:col-span-2"><Input {...register("title")} placeholder="e.g. Today's class has been cancelled" /></Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></Field>
      <Field label="Target batches" hint="Leave all unselected to notify every batch." className="sm:col-span-2">
        <Controller control={control} name="batches" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={BATCHES.map((b) => ({ value: b, label: b }))} />} />
      </Field>
      <Field label="Publish date" error={errors.publishDate?.message}><Input type="date" {...register("publishDate")} /></Field>
      <Field label="Expiry date" error={errors.expiryDate?.message}><Input type="date" {...register("expiryDate")} /></Field>
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
