import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Teacher } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { todayISO } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().min(3, "Enter the full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().regex(/^0\d{9}$/, "Use 10 digits, e.g. 0771234567"),
  qualification: z.string(),
  specialization: z.string(),
  moduleIds: z.array(z.string()),
  batches: z.array(z.string()),
  joiningDate: z.string().min(1, "Required"),
  status: z.enum(["active", "on-leave", "inactive"]),
});
type Values = z.infer<typeof schema>;

function Inner({
  item,
  onClose,
  onSubmittingChange,
}: {
  item: Teacher | null;
  onClose: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const { modules, saveTeacher, teacherModules } = useAppData();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { ...item, moduleIds: teacherModules(item.id).map((m) => m.id) }
      : { fullName: "", email: "", phone: "", qualification: "", specialization: "", moduleIds: [], batches: [], joiningDate: todayISO(), status: "active" },
  });
  const onSubmit = async ({ moduleIds, ...data }: Values) => {
    onSubmittingChange(true);
    try {
      const t = await saveTeacher(data, moduleIds, item?.id);
      toast.success(item ? `${t.fullName} updated` : `${t.fullName} added as ${t.id}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save teacher");
    } finally {
      onSubmittingChange(false);
    }
  };
  return (
    <form id="teacher-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName?.message} className="sm:col-span-2"><Input {...register("fullName")} placeholder="e.g. Dr. Anura Wijesekara" /></Field>
      <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
      <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} className="num" placeholder="0771234567" /></Field>
      <Field label="Qualification (optional)" error={errors.qualification?.message}><Input {...register("qualification")} placeholder="MSc in Physics" /></Field>
      <Field label="Specialization (optional)" error={errors.specialization?.message}><Input {...register("specialization")} placeholder="Mechanics & Waves" /></Field>
      <Field label="Joining date" error={errors.joiningDate?.message}><Input type="date" {...register("joiningDate")} /></Field>
      <Field label="Status">
        <Select {...register("status")}>
          <option value="active">Active</option>
          <option value="on-leave">On leave</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <Field label="Assigned modules (optional)" hint="Assigning a module here replaces its current teacher." className="sm:col-span-2">
        <Controller control={control} name="moduleIds" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={modules.map((m) => ({ value: m.id, label: m.name }))} />} />
      </Field>
      <Field label="Assigned batches (optional)" error={errors.batches?.message} className="sm:col-span-2">
        <Controller control={control} name="batches" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={BATCHES.map((b) => ({ value: b, label: b }))} />} />
      </Field>
    </form>
  );
}

export function TeacherFormModal({ open, item, onClose }: { open: boolean; item: Teacher | null; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? "Edit teacher" : "Add new teacher"}
      description={item?.id}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="teacher-form" disabled={submitting}>
            {submitting ? "Saving..." : item ? "Save changes" : "Create teacher"}
          </Button>
        </>
      }
    >
      <Inner item={item} onClose={onClose} onSubmittingChange={setSubmitting} />
    </Modal>
  );
}
