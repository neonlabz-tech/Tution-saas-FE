import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, Trash2 } from "lucide-react";
import type { OnlineClass } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { todayISO } from "@/lib/utils";

const schema = z
  .object({
    title: z.string().min(3, "Enter a class title"),
    moduleId: z.string().min(1, "Select a module"),
    teacherId: z.string().min(1, "Select a teacher"),
    batch: z.string().min(1, "Select a batch"),
    date: z.string().min(1, "Required"),
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    link: z.string().url("Enter a valid URL, e.g. https://meet.example.com/room"),
    description: z.string(),
    status: z.enum(["scheduled", "completed", "cancelled"]),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End must be after start" });
type Values = z.infer<typeof schema>;

export interface ClassDraft {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

function Inner({ item, draft, onClose, onDelete }: { item: OnlineClass | null; draft: ClassDraft; onClose: () => void; onDelete: (id: string) => void }) {
  const { modules, teachers, getModule, saveClass } = useAppData();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { title: item.title, moduleId: item.moduleId, teacherId: item.teacherId, batch: item.batch, date: item.start.slice(0, 10), startTime: item.start.slice(11, 16), endTime: item.end.slice(11, 16), link: item.link, description: item.description, status: item.status }
      : { title: "", moduleId: "", teacherId: "", batch: "", date: draft.date ?? todayISO(), startTime: draft.startTime ?? "18:00", endTime: draft.endTime ?? "19:30", link: "https://meet.example.com/eduflow-room", description: "", status: "scheduled" },
  });
  const moduleId = watch("moduleId");
  useEffect(() => {
    const m = getModule(moduleId);
    if (m && !item) {
      if (m.teacherId) setValue("teacherId", m.teacherId);
      if (!dirtyFields.batch) setValue("batch", m.batches[0] ?? "");
      if (!dirtyFields.title) setValue("title", `${m.name}: Live Session`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const onSubmit = (v: Values) => {
    saveClass({ title: v.title, moduleId: v.moduleId, teacherId: v.teacherId, batch: v.batch, start: `${v.date}T${v.startTime}`, end: `${v.date}T${v.endTime}`, link: v.link, description: v.description, status: v.status }, item?.id);
    toast.success(item ? "Online class updated" : "Online class scheduled");
    onClose();
  };
  const link = watch("link");
  return (
    <form id="class-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Class title" error={errors.title?.message} className="sm:col-span-2"><Input {...register("title")} placeholder="e.g. Physics: Revision Session" /></Field>
      <Field label="Module" error={errors.moduleId?.message}>
        <Select {...register("moduleId")}><option value="">Select module…</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
      </Field>
      <Field label="Teacher" error={errors.teacherId?.message}>
        <Select {...register("teacherId")}><option value="">Select teacher…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>
      </Field>
      <Field label="Batch" error={errors.batch?.message}>
        <Select {...register("batch")}><option value="">Select batch…</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select>
      </Field>
      <Field label="Status">
        <Select {...register("status")}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select>
      </Field>
      <Field label="Start date" error={errors.date?.message}><Input type="date" {...register("date")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" error={errors.startTime?.message}><Input type="time" {...register("startTime")} /></Field>
        <Field label="End time" error={errors.endTime?.message}><Input type="time" {...register("endTime")} /></Field>
      </div>
      <Field label="Meeting link" error={errors.link?.message} className="sm:col-span-2">
        <div className="flex gap-2">
          <Input {...register("link")} />
          <a href={link} target="_blank" rel="noreferrer" aria-label="Open link" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:text-ink"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </Field>
      <Field label="Description" className="sm:col-span-2"><Textarea {...register("description")} className="min-h-[70px]" /></Field>
      {item && (
        <div className="sm:col-span-2">
          <Button variant="dangerSoft" size="sm" onClick={() => onDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /> Delete this class</Button>
        </div>
      )}
    </form>
  );
}

export function ClassFormModal({ open, item, draft, onClose, onDelete }: { open: boolean; item: OnlineClass | null; draft: ClassDraft; onClose: () => void; onDelete: (id: string) => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? "Edit online class" : "Schedule online class"}
      description="Drag events on the calendar to reschedule, or resize to change duration"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="class-form">{item ? "Save changes" : "Schedule class"}</Button>
        </>
      }
    >
      <Inner item={item} draft={draft} onClose={onClose} onDelete={onDelete} />
    </Modal>
  );
}
