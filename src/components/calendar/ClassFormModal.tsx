import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, Trash2 } from "lucide-react";
import type { CreateOnlineClassDto, ModuleListItem, OnlineClassItem, UpdateOnlineClassDto } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { listModules } from "@/api/modules";
import { createOnlineClass, updateOnlineClass } from "@/api/onlineClasses";
import { createNotification } from "@/api/notifications";
import { useAuth } from "@/hooks/useAuth";
import { applyApiValidationErrors, teachersApi, type TeacherListItem } from "@/lib/api";
import { BATCHES } from "@/lib/constants";
import { todayISO } from "@/lib/utils";

const schema = z
  .object({
    title: z.string().trim().min(3, "Enter a class title"),
    moduleId: z.string().min(1, "Select a module"),
    teacherId: z.string().min(1, "Select a teacher"),
    batch: z.string().min(1, "Select a batch"),
    date: z.string().min(1, "Required"),
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    link: z.string().trim().url("Enter a valid URL, e.g. https://meet.example.com/room"),
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

function toFormValues(item: OnlineClassItem | null, draft: ClassDraft): Values {
  if (item) {
    return {
      title: item.title ?? "",
      moduleId: item.moduleId ?? "",
      teacherId: item.teacherId ?? "",
      batch: item.batch ?? "",
      date: item.start.slice(0, 10),
      startTime: item.start.slice(11, 16),
      endTime: item.end.slice(11, 16),
      link: item.link ?? "",
      description: item.description ?? "",
      status: item.status ?? "scheduled",
    };
  }
  return {
    title: "",
    moduleId: "",
    teacherId: "",
    batch: "",
    date: draft.date ?? todayISO(),
    startTime: draft.startTime ?? "18:00",
    endTime: draft.endTime ?? "19:30",
    link: "https://meet.example.com/eduflow-room",
    description: "",
    status: "scheduled",
  };
}

function Inner({
  item,
  draft,
  modulesProp,
  teachersProp,
  onClose,
  onDelete,
  onSaved,
  onSubmittingChange,
}: {
  item: OnlineClassItem | null;
  draft: ClassDraft;
  modulesProp?: ModuleListItem[];
  teachersProp?: TeacherListItem[];
  onClose: () => void;
  onDelete: (target: { id: string; title: string }) => void;
  onSaved?: (saved: OnlineClassItem) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleListItem[]>(modulesProp ?? []);
  const [teachers, setTeachers] = useState<TeacherListItem[]>(teachersProp ?? []);
  const [loadingModules, setLoadingModules] = useState(!modulesProp);
  const [loadingTeachers, setLoadingTeachers] = useState(!teachersProp);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(item, draft),
  });

  useEffect(() => {
    reset(toFormValues(item, draft));
  }, [item, draft, reset]);

  useEffect(() => {
    if (modulesProp) {
      setModules(modulesProp);
      setLoadingModules(false);
      return;
    }
    const controller = new AbortController();
    setLoadingModules(true);
    listModules({}, controller.signal)
      .then(setModules)
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

  const moduleId = watch("moduleId");
  useEffect(() => {
    if (item || !moduleId) return;
    const m = modules.find((x) => x.id === moduleId);
    if (!m) return;
    if (m.teacherId && !dirtyFields.teacherId) setValue("teacherId", m.teacherId);
    if (!dirtyFields.batch && m.batches.length > 0) setValue("batch", m.batches[0]);
    if (!dirtyFields.title) setValue("title", `${m.name}: Live Session`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, item, modules]);

  const onSubmit = async (v: Values) => {
    const start = `${v.date}T${v.startTime}`;
    const end = `${v.date}T${v.endTime}`;
    const desc = v.description.trim();

    onSubmittingChange(true);
    try {
      let saved: OnlineClassItem;
      if (item) {
        const payload: UpdateOnlineClassDto = {
          title: v.title.trim(),
          moduleId: v.moduleId,
          teacherId: v.teacherId,
          batch: v.batch,
          start,
          end,
          link: v.link.trim(),
          description: desc,
          status: v.status,
        };
        saved = await updateOnlineClass(item.id, payload);
        toast.success("Online class updated");

        try {
          await createNotification({
            type: "class",
            title: "Class Schedule Updated",
            subtitle: `${saved.title} updated for ${v.date} at ${v.startTime} (${saved.batch}).`,
            link: "/dashboard/online-classes",
            targetRoles: ["teacher", "student"],
            targetBatch: saved.batch,
            targetUserIds: [saved.teacherId],
            actorId: user?.id,
            metadata: { classId: saved.id },
          });
        } catch {
          // non-blocking
        }
      } else {
        const payload: CreateOnlineClassDto = {
          title: v.title.trim(),
          moduleId: v.moduleId,
          teacherId: v.teacherId,
          batch: v.batch,
          start,
          end,
          link: v.link.trim(),
          ...(desc ? { description: desc } : {}),
          status: v.status,
        };
        saved = await createOnlineClass(payload);
        toast.success("Online class scheduled");

        try {
          // 1. Teacher alert
          await createNotification({
            type: "class",
            title: "New Class Scheduled",
            subtitle: `${saved.title} has been scheduled for ${v.date} at ${v.startTime} (${saved.batch}).`,
            link: "/dashboard/online-classes",
            targetRoles: ["teacher"],
            targetUserIds: [saved.teacherId],
            actorId: user?.id,
            metadata: { classId: saved.id, moduleId: saved.moduleId, batch: saved.batch },
          });

          // 2. Student alert for enrolled batch
          await createNotification({
            type: "class",
            title: "New Class Added to Your Schedule",
            subtitle: `${saved.title} on ${v.date} at ${v.startTime}. Tap to view details.`,
            link: "/dashboard/online-classes",
            targetRoles: ["student"],
            targetBatch: saved.batch,
            actorId: user?.id,
            metadata: { classId: saved.id, batch: saved.batch },
          });
        } catch {
          // non-blocking
        }
      }
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      const mapped = applyApiValidationErrors(err, setError);
      const msg = err instanceof Error ? err.message : "Failed to save online class";
      toast.error(mapped ? `Please check the highlighted fields: ${msg}` : msg);
    } finally {
      onSubmittingChange(false);
    }
  };

  const link = watch("link");
  const validHref = /^https?:\/\/.+/i.test(link.trim());

  return (
    <form id="class-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Class title" error={errors.title?.message} className="sm:col-span-2">
        <Input {...register("title")} placeholder="e.g. Physics: Revision Session" />
      </Field>
      <Field label="Module" error={errors.moduleId?.message}>
        {loadingModules ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select {...register("moduleId")}>
            <option value="">Select module…</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Teacher" error={errors.teacherId?.message}>
        {loadingTeachers ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select {...register("teacherId")}>
            <option value="">Select teacher…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Batch" error={errors.batch?.message}>
        <Select {...register("batch")}>
          <option value="">Select batch…</option>
          {BATCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <Select {...register("status")}>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Field>
      <Field label="Start date" error={errors.date?.message}>
        <Input type="date" {...register("date")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" error={errors.startTime?.message}>
          <Input type="time" {...register("startTime")} />
        </Field>
        <Field label="End time" error={errors.endTime?.message}>
          <Input type="time" {...register("endTime")} />
        </Field>
      </div>
      <Field label="Meeting link" error={errors.link?.message} className="sm:col-span-2">
        <div className="flex gap-2">
          <Input {...register("link")} />
          {validHref ? (
            <a
              href={link.trim()}
              target="_blank"
              rel="noreferrer"
              aria-label="Open link"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:text-ink"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted opacity-40"
            >
              <ExternalLink className="h-4 w-4" />
            </span>
          )}
        </div>
      </Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
        <Textarea {...register("description")} className="min-h-[70px]" />
      </Field>
      {item && (
        <div className="sm:col-span-2">
          <Button
            variant="dangerSoft"
            size="sm"
            onClick={() => onDelete({ id: item.id, title: item.title })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete this class
          </Button>
        </div>
      )}
    </form>
  );
}

export function ClassFormModal({
  open,
  item,
  draft,
  modules,
  teachers,
  onClose,
  onDelete,
  onSaved,
}: {
  open: boolean;
  item: OnlineClassItem | null;
  draft: ClassDraft;
  modules?: ModuleListItem[];
  teachers?: TeacherListItem[];
  onClose: () => void;
  onDelete: (target: { id: string; title: string }) => void;
  onSaved?: (saved: OnlineClassItem) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      title={item ? "Edit online class" : "Schedule online class"}
      description="Drag events on the calendar to reschedule, or resize to change duration"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" disabled={submitting}>
            {submitting ? "Saving…" : item ? "Save changes" : "Schedule class"}
          </Button>
        </>
      }
    >
      {open && (
        <Inner
          key={item?.id ?? `new-${draft.date ?? ""}-${draft.startTime ?? ""}`}
          item={item}
          draft={draft}
          modulesProp={modules}
          teachersProp={teachers}
          onClose={onClose}
          onDelete={onDelete}
          onSaved={onSaved}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
