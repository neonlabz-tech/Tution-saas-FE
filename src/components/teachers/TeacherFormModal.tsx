import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Teacher } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { listBatches } from "@/api/batches";
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
  status: z.enum(["active", "inactive"]),
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
  const { teachers, modules, saveTeacher, teacherModules } = useAppData();
  const toast = useToast();
  const [batchOptions, setBatchOptions] = useState<string[]>(() => {
    return Array.isArray(item?.batches) ? [...item.batches] : [];
  });

  useEffect(() => {
    let active = true;
    listBatches()
      .then((data) => {
        if (active) {
          const names = data.map((b) => b.name);
          const current = Array.isArray(item?.batches) ? item.batches : [];
          setBatchOptions(Array.from(new Set([...names, ...current])));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item?.batches]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          ...item,
          moduleIds:
            (item as { assignedModules?: { id: string }[]; moduleIds?: string[] }).assignedModules?.map((m) => m.id) ??
            (item as { moduleIds?: string[] }).moduleIds ??
            teacherModules(item.id).map((m) => m.id),
        }
      : { fullName: "", email: "", phone: "", qualification: "", specialization: "", moduleIds: [], batches: [], joiningDate: todayISO(), status: "active" },
  });
  const onSubmit = async ({ moduleIds, ...data }: Values) => {
    const normalizedPhone = data.phone.trim();
    const phoneInUse = teachers.some(
      (t) => t.phone?.trim() === normalizedPhone && t.id !== item?.id,
    );
    if (phoneInUse) {
      toast.error(`Phone number "${normalizedPhone}" is already registered to another teacher`);
      return;
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const emailInUse = teachers.some(
      (t) => t.email?.trim().toLowerCase() === normalizedEmail && t.id !== item?.id,
    );
    if (emailInUse) {
      toast.error(`Email "${normalizedEmail}" is already registered to another teacher`);
      return;
    }

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
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <Field label="Assigned modules (optional)" hint="Assigning a module here replaces its current teacher." className="sm:col-span-2">
        <Controller control={control} name="moduleIds" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={modules.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))} />} />
      </Field>
      <Field label="Assigned batches (optional)" error={errors.batches?.message} className="sm:col-span-2">
        <Controller
          control={control}
          name="batches"
          render={({ field }) => (
            <MultiSelect
              value={field.value}
              onChange={field.onChange}
              options={batchOptions.map((b) => ({ value: b, label: b }))}
              allowCustom
              onAddCustom={(newBatch) => {
                const trimmed = newBatch.trim();
                if (trimmed) {
                  setBatchOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                }
              }}
            />
          )}
        />
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
