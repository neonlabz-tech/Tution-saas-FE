import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CreateModuleDto, ModuleDetail, ModuleListItem, UpdateModuleDto } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createModule, updateModule } from "@/api/modules";
import { applyApiValidationErrors, teachersApi, type TeacherListItem } from "@/lib/api";
import { BATCHES } from "@/lib/constants";

const schema = z.object({
  code: z.string().trim().min(3, "e.g. MTH-101"),
  name: z.string().trim().min(3, "Enter module name"),
  description: z.string().trim().min(10, "Add a short description"),
  fee: z.number({ message: "Enter a fee" }).min(1000, "Minimum LKR 1,000"),
  duration: z.string().trim().min(2, "e.g. 6 months"),
  teacherId: z.string(),
  batches: z.array(z.string()).min(1, "Assign at least one batch"),
  status: z.enum(["active", "upcoming", "archived"]),
});
type Values = z.infer<typeof schema>;

type EditableModule = ModuleListItem | ModuleDetail;

function toFormValues(item: EditableModule | null): Values {
  if (!item) {
    return {
      code: "",
      name: "",
      description: "",
      fee: 50000,
      duration: "6 months",
      teacherId: "",
      batches: [],
      status: "active",
    };
  }
  return {
    code: item.code ?? "",
    name: item.name ?? "",
    description: item.description ?? "",
    fee: item.fee ?? 50000,
    duration: item.duration ?? "",
    teacherId: item.teacherId ?? "",
    batches: Array.isArray(item.batches) ? [...item.batches] : [],
    status: item.status ?? "active",
  };
}

function Inner({
  item,
  teachersProp,
  onClose,
  onSaved,
  onSubmittingChange,
}: {
  item: EditableModule | null;
  teachersProp?: TeacherListItem[];
  onClose: () => void;
  onSaved?: (saved: ModuleListItem) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const toast = useToast();
  const [teachers, setTeachers] = useState<TeacherListItem[]>(teachersProp ?? []);
  const [loadingTeachers, setLoadingTeachers] = useState(!teachersProp);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(item),
  });

  useEffect(() => {
    reset(toFormValues(item));
  }, [item, reset]);

  useEffect(() => {
    if (teachersProp) {
      setTeachers(teachersProp);
      setLoadingTeachers(false);
      return;
    }
    let active = true;
    setLoadingTeachers(true);
    teachersApi
      .list()
      .then((res) => {
        if (active) setTeachers(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (active) toast.error(err instanceof Error ? err.message : "Failed to load teachers");
      })
      .finally(() => {
        if (active) setLoadingTeachers(false);
      });
    return () => {
      active = false;
    };
  }, [teachersProp, toast]);

  const onSubmit = async (v: Values) => {
    const base = {
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      description: v.description.trim(),
      fee: v.fee,
      duration: v.duration.trim(),
      batches: v.batches,
      status: v.status,
    };

    onSubmittingChange(true);
    try {
      let saved: ModuleListItem;
      if (item) {
        const payload: UpdateModuleDto = {
          ...base,
          teacherId: v.teacherId || null,
        };
        saved = await updateModule(item.id, payload);
        toast.success(`${saved.name} updated`);
      } else {
        const payload: CreateModuleDto = {
          ...base,
          ...(v.teacherId ? { teacherId: v.teacherId } : {}),
        };
        saved = await createModule(payload);
        toast.success(`${saved.name} created`);
      }
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      const mapped = applyApiValidationErrors(err, setError);
      const msg = err instanceof Error ? err.message : "Failed to save module";
      toast.error(mapped ? `Please check the highlighted fields: ${msg}` : msg);
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form id="module-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Module code" error={errors.code?.message}>
        <Input {...register("code")} className="num uppercase" placeholder="MTH-101" />
      </Field>
      <Field label="Module name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Advanced Mathematics" />
      </Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
        <Textarea {...register("description")} />
      </Field>
      <Field label="Fee (LKR)" error={errors.fee?.message}>
        <Input type="number" step={500} {...register("fee", { valueAsNumber: true })} className="num" />
      </Field>
      <Field label="Duration" error={errors.duration?.message}>
        <Input {...register("duration")} />
      </Field>
      <Field label="Teacher" error={errors.teacherId?.message}>
        {loadingTeachers ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select {...register("teacherId")}>
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <Select {...register("status")}>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="archived">Archived</option>
        </Select>
      </Field>
      <Field label="Batches" error={errors.batches?.message} className="sm:col-span-2">
        <Controller
          control={control}
          name="batches"
          render={({ field }) => (
            <MultiSelect
              value={field.value}
              onChange={field.onChange}
              options={BATCHES.map((b) => ({ value: b, label: b }))}
            />
          )}
        />
      </Field>
    </form>
  );
}

export function ModuleFormModal({
  open,
  item,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: EditableModule | null;
  teachers?: TeacherListItem[];
  onClose: () => void;
  onSaved?: (saved: ModuleListItem) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      title={item ? "Edit module" : "Create module"}
      description={item?.code}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="module-form" disabled={submitting}>
            {submitting ? "Saving…" : item ? "Save changes" : "Create module"}
          </Button>
        </>
      }
    >
      {open && (
        <Inner
          key={item?.id ?? "new"}
          item={item}
          teachersProp={teachers}
          onClose={onClose}
          onSaved={onSaved}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
