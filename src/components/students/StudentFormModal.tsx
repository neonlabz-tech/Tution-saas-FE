import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Student } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, MultiSelect, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { todayISO } from "@/lib/utils";

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
  enrollmentDate: z.string().min(1, "Required"),
  status: z.enum(["active", "inactive", "graduated"]),
});
type Values = z.infer<typeof schema>;

function Inner({ item, onClose }: { item: Student | null; onClose: () => void }) {
  const { modules, saveStudent } = useAppData();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { ...item }
      : { fullName: "", email: "", phone: "", dob: "", address: "", guardianName: "", guardianPhone: "", batch: BATCHES[0], moduleIds: [], enrollmentDate: todayISO(), status: "active" },
  });
  const onSubmit = (v: Values) => {
    const s = saveStudent(v, item?.id);
    toast.success(item ? `${s.fullName} updated` : `${s.fullName} added as ${s.id} — QR code generated`);
    onClose();
  };
  return (
    <form id="student-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName?.message} className="sm:col-span-2"><Input {...register("fullName")} placeholder="e.g. Nimal Perera" /></Field>
      <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} placeholder="name@mail.lk" /></Field>
      <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} placeholder="0771234567" className="num" /></Field>
      <Field label="Date of birth" error={errors.dob?.message}><Input type="date" {...register("dob")} /></Field>
      <Field label="Enrollment date" error={errors.enrollmentDate?.message}><Input type="date" {...register("enrollmentDate")} /></Field>
      <Field label="Address" error={errors.address?.message} className="sm:col-span-2"><Textarea {...register("address")} className="min-h-[64px]" placeholder="Street, city" /></Field>
      <Field label="Guardian name" error={errors.guardianName?.message}><Input {...register("guardianName")} /></Field>
      <Field label="Guardian phone" error={errors.guardianPhone?.message}><Input {...register("guardianPhone")} className="num" /></Field>
      <Field label="Batch" error={errors.batch?.message}>
        <Select {...register("batch")}>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select>
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <Select {...register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
        </Select>
      </Field>
      <Field label="Registered modules" error={errors.moduleIds?.message} className="sm:col-span-2">
        <Controller control={control} name="moduleIds" render={({ field }) => <MultiSelect value={field.value} onChange={field.onChange} options={modules.map((m) => ({ value: m.id, label: m.name }))} />} />
      </Field>
    </form>
  );
}

export function StudentFormModal({ open, item, onClose }: { open: boolean; item: Student | null; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? "Edit student" : "Add new student"}
      description={item ? item.id : "A unique ID and QR code are generated automatically"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="student-form">{item ? "Save changes" : "Create student"}</Button>
        </>
      }
    >
      <Inner item={item} onClose={onClose} />
    </Modal>
  );
}
