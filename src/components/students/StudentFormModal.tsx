import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CreateStudentDto, Module, StudentDetail, StudentListItem } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { listModules } from "@/api/modules";
import { createStudentWithMeta, getStudentById, updateStudent } from "@/api/students";
import { applyApiValidationErrors } from "@/lib/api";
import { BATCHES } from "@/lib/constants";
import { toDateInput, todayISO } from "@/lib/utils";

const ALLOWED_NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey || ALLOWED_NAV_KEYS.has(e.key)) return;
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

function sanitizePhoneInput(e: React.ChangeEvent<HTMLInputElement>) {
  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
  if (e.target.value !== cleaned) {
    e.target.value = cleaned;
  }
}

const phone = z.string().regex(/^0\d{9}$/, "Use 10 digits, e.g. 0771234567");
const schema = z.object({
  fullName: z.string().min(3, "Enter the full name"),
  email: z.string().email("Enter a valid email"),
  phone,
  dob: z.string().min(1, "Required"),
  address: z.string().min(5, "Enter the address"),
  guardianName: z.string().min(3, "Enter guardian name"),
  guardianPhone: phone,
  batch: z.string().min(1, "Select a batch"),
  moduleIds: z.array(z.string()).min(1, "Select at least one module"),
  enrollmentDate: z.string().optional(),
  status: z.enum(["pending", "active", "inactive", "graduated"]),
});
type Values = z.infer<typeof schema>;

type EditableStudent = StudentListItem | StudentDetail;

function toFormValues(item: EditableStudent | null): Values {
  if (!item) {
    return {
      fullName: "",
      email: "",
      phone: "",
      dob: "",
      address: "",
      guardianName: "",
      guardianPhone: "",
      batch: BATCHES[0],
      moduleIds: [],
      enrollmentDate: todayISO(),
      status: "active",
    };
  }
  const moduleIds = item.moduleIds?.length
    ? item.moduleIds
    : (item.modules?.map((m) => m.id) ?? []);
  return {
    fullName: item.fullName ?? "",
    email: item.email ?? "",
    phone: item.phone ?? "",
    dob: toDateInput(item.dob),
    address: item.address ?? "",
    guardianName: item.guardianName ?? "",
    guardianPhone: item.guardianPhone ?? "",
    batch: item.batch ?? BATCHES[0],
    moduleIds,
    enrollmentDate: toDateInput(item.enrollmentDate),
    status: item.status ?? "pending",
  };
}

function Inner({
  item,
  modulesProp,
  onClose,
  onSaved,
  onSubmittingChange,
}: {
  item: EditableStudent | null;
  modulesProp?: Module[];
  onClose: () => void;
  onSaved?: (student: StudentDetail) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const toast = useToast();
  const [modules, setModules] = useState<Module[]>(modulesProp ?? []);
  const [loadingModules, setLoadingModules] = useState(!modulesProp?.length);
  const [loadingItem, setLoadingItem] = useState(
    Boolean(item?.id && (item.dob === undefined || item.address === undefined || item.guardianName === undefined)),
  );

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
    if (modulesProp?.length) {
      setModules(modulesProp);
      setLoadingModules(false);
      return;
    }
    const controller = new AbortController();
    setLoadingModules(true);
    listModules({}, controller.signal)
      .then((res) => setModules(res))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load modules");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingModules(false);
      });
    return () => controller.abort();
  }, [modulesProp, toast]);

  useEffect(() => {
    if (!item?.id) {
      setLoadingItem(false);
      return;
    }
    if (item.dob !== undefined && item.address !== undefined && item.guardianName !== undefined) {
      setLoadingItem(false);
      return;
    }
    const controller = new AbortController();
    setLoadingItem(true);
    getStudentById(item.id, controller.signal)
      .then((full) => {
        reset(toFormValues(full));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Could not load full student details");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingItem(false);
      });
    return () => controller.abort();
  }, [item, reset, toast]);

  const onSubmit = async (v: Values) => {
    const payload: CreateStudentDto = {
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      dob: v.dob,
      address: v.address.trim(),
      guardianName: v.guardianName.trim(),
      guardianPhone: v.guardianPhone.trim(),
      batch: v.batch,
      moduleIds: v.moduleIds,
      ...(v.enrollmentDate ? { enrollmentDate: v.enrollmentDate } : {}),
      status: v.status,
    };

    onSubmittingChange(true);
    try {
      if (item) {
        const saved = await updateStudent(item.id, payload);
        toast.success(`${saved.fullName} updated`);
        onSaved?.(saved);
      } else {
        const { student: saved, message } = await createStudentWithMeta(payload);
        const emailFeedback =
          message && /email/i.test(message)
            ? message
            : `Registration email sent to ${saved.email}`;
        toast.success(`${saved.fullName} added as ${saved.id} (${saved.status}) — QR generated. ${emailFeedback}`);
        onSaved?.(saved);
      }
      onClose();
    } catch (err: unknown) {
      const mapped = applyApiValidationErrors(err, setError);
      const msg = err instanceof Error ? err.message : "Failed to save student";
      toast.error(mapped ? `Please check the highlighted fields: ${msg}` : msg);
    } finally {
      onSubmittingChange(false);
    }
  };

  if (loadingItem) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-10 sm:col-span-2" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-16 sm:col-span-2" />
      </div>
    );
  }

  return (
    <form id="student-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName?.message} className="sm:col-span-2">
        <Input {...register("fullName")} placeholder="e.g. Nimal Perera" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" {...register("email")} placeholder="name@mail.lk" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          onKeyDown={handlePhoneKeyDown}
          {...register("phone", { onChange: sanitizePhoneInput })}
          placeholder="0771234567"
          className="num"
        />
      </Field>
      <Field label="Date of birth" error={errors.dob?.message}>
        <Input type="date" {...register("dob")} />
      </Field>
      <Field label="Enrollment date" error={errors.enrollmentDate?.message}>
        <Input type="date" {...register("enrollmentDate")} />
      </Field>
      <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
        <Textarea {...register("address")} className="min-h-[64px]" placeholder="Street, city" />
      </Field>
      <Field label="Guardian name" error={errors.guardianName?.message}>
        <Input {...register("guardianName")} />
      </Field>
      <Field label="Guardian phone" error={errors.guardianPhone?.message}>
        <Input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          onKeyDown={handlePhoneKeyDown}
          {...register("guardianPhone", { onChange: sanitizePhoneInput })}
          placeholder="0771234567"
          className="num"
        />
      </Field>
      <Field label="Batch" error={errors.batch?.message}>
        <Select {...register("batch")}>
          {BATCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <Select {...register("status")}>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
        </Select>
      </Field>
      <Field label="Registered modules" error={errors.moduleIds?.message} className="sm:col-span-2">
        {loadingModules ? (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        ) : modules.length === 0 ? (
          <p className="text-xs text-muted">No modules available.</p>
        ) : (
          <Controller
            control={control}
            name="moduleIds"
            render={({ field }) => (
              <MultiSelect
                value={field.value}
                onChange={field.onChange}
                options={modules.map((m) => ({ value: m.id, label: m.name }))}
              />
            )}
          />
        )}
      </Field>
    </form>
  );
}

export function StudentFormModal({
  open,
  item,
  modules,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: EditableStudent | null;
  modules?: Module[];
  onClose: () => void;
  onSaved?: (student: StudentDetail) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      title={item ? "Edit student" : "Add new student"}
      description={item ? item.id : "A unique ID, QR code, and registration email are generated automatically"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" disabled={submitting}>
            {submitting ? "Saving…" : item ? "Save changes" : "Create student"}
          </Button>
        </>
      }
    >
      {open && (
        <Inner
          key={item?.id ?? "new"}
          item={item}
          modulesProp={modules}
          onClose={onClose}
          onSaved={onSaved}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
