import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Module } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";

const schema = z.object({
  code: z.string().min(3, "e.g. MTH-101"),
  name: z.string().min(3, "Enter module name"),
  description: z.string().min(10, "Add a short description"),
  fee: z.number({ message: "Enter a fee" }).min(1000, "Minimum LKR 1,000"),
  duration: z.string().min(2, "e.g. 6 months"),
  teacherId: z.string(),
  batches: z.array(z.string()).min(1, "Assign at least one batch"),
  status: z.enum(["active", "upcoming", "archived"]),
});
type Values = z.infer<typeof schema>;

function Inner({ item, onClose }: { item: Module | null; onClose: () => void }) {
  const { teachers, saveModule } = useAppData();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { ...item, teacherId: item.teacherId ?? "" }
      : { code: "", name: "", description: "", fee: 50000, duration: "6 months", teacherId: "", batches: [], status: "active" },
  });
  const onSubmit = (v: Values) => {
    const m = saveModule({ ...v, teacherId: v.teacherId || null }, item?.id);
    toast.success(item ? `${m.name} updated` : `${m.name} created`);
    onClose();
  };
  return (
    <form id="module-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Module code" error={errors.code?.message}><Input {...register("code")} className="num uppercase" placeholder="MTH-101" /></Field>
      <Field label="Module name" error={errors.name?.message}><Input {...register("name")} placeholder="Advanced Mathematics" /></Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></Field>
      <Field label="Fee (LKR)" error={errors.fee?.message}><Input type="number" step={500} {...register("fee", { valueAsNumber: true })} className="num" /></Field>
      <Field label="Duration" error={errors.duration?.message}><Input {...register("duration")} /></Field>
      <Field label="Teacher">
        <Select {...register("teacherId")}>
          <option value="">Unassigned</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </Select>
      </Field>
      <Field label="Status">
        <Select {...register("status")}>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="archived">Archived</option>
        </Select>
      </Field>
      <Field label="Batches" error={errors.batches?.message} className="sm:col-span-2">
        <Controller control={control} name="batches" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={BATCHES.map((b) => ({ value: b, label: b }))} />} />
      </Field>
    </form>
  );
}

export function ModuleFormModal({ open, item, onClose }: { open: boolean; item: Module | null; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? "Edit module" : "Create module"}
      description={item?.code}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="module-form">{item ? "Save changes" : "Create module"}</Button>
        </>
      }
    >
      <Inner item={item} onClose={onClose} />
    </Modal>
  );
}
