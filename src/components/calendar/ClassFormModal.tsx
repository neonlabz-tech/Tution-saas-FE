import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, MapPin, Trash2, Video } from "lucide-react";
import type {
  ClassType,
  CreateOnlineClassDto,
  ModuleListItem,
  OnlineClassItem,
  UpdateOnlineClassDto,
} from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { listModules } from "@/api/modules";
import { createOnlineClass, updateOnlineClass } from "@/api/onlineClasses";
import { createNotification } from "@/api/notifications";
import { useAuth } from "@/hooks/useAuth";
import { applyApiValidationErrors, teachersApi, type TeacherListItem } from "@/lib/api";
import { useBatches } from "@/hooks/useBatches";
import { cn, todayISO } from "@/lib/utils";

const schema = z
  .object({
    title: z.string().trim().min(3, "Enter a class title"),
    classType: z.enum(["online", "physical"]),
    moduleId: z.string().min(1, "Select a module"),
    teacherId: z.string().min(1, "Select a teacher"),
    batch: z.string().min(1, "Select a batch"),
    date: z.string().min(1, "Required"),
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    link: z.string(),
    hall: z.string(),
    description: z.string(),
    status: z.enum(["scheduled", "completed", "cancelled"]),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End must be after start" })
  .superRefine((v, ctx) => {
    if (v.classType === "online") {
      const trimmed = v.link.trim();
      if (trimmed) {
        try {
          new URL(trimmed);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["link"],
            message: "Enter a valid URL (e.g. https://meet.google.com/...)",
          });
        }
      }
    } else if (v.classType === "physical") {
      if (!v.hall.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hall"],
          message: "Enter hall or room name",
        });
      }
    }
  });
type Values = z.infer<typeof schema>;

export interface ClassDraft {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

function toFormValues(item: OnlineClassItem | null, draft: ClassDraft): Values {
  if (item) {
    const classType: ClassType = item.classType ?? (item.hall && !item.link ? "physical" : "online");
    return {
      title: item.title ?? "",
      classType,
      moduleId: item.moduleId ?? "",
      teacherId: item.teacherId ?? "",
      batch: item.batch ?? "",
      date: item.start.slice(0, 10),
      startTime: item.start.slice(11, 16),
      endTime: item.end.slice(11, 16),
      link: item.link ?? "",
      hall: item.hall ?? "",
      description: item.description ?? "",
      status: item.status ?? "scheduled",
    };
  }
  return {
    title: "",
    classType: "online",
    moduleId: "",
    teacherId: "",
    batch: "",
    date: draft.date ?? todayISO(),
    startTime: draft.startTime ?? "18:00",
    endTime: draft.endTime ?? "19:30",
    link: "",
    hall: "",
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
  const { batches: batchOptions } = useBatches(item?.batch ? [item.batch] : undefined);
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
    const trimmedBatch = v.batch.trim();
    if (!trimmedBatch) {
      setError("batch", { message: "Select or enter a batch" });
      return;
    }
    const start = `${v.date}T${v.startTime}`;
    const end = `${v.date}T${v.endTime}`;
    const desc = v.description.trim();

    onSubmittingChange(true);
    try {
      let saved: OnlineClassItem;
      if (item) {
        const payload: UpdateOnlineClassDto = {
          title: v.title.trim(),
          classType: v.classType,
          moduleId: v.moduleId,
          teacherId: v.teacherId,
          batch: trimmedBatch,
          start,
          end,
          link: v.classType === "online" ? v.link.trim() : undefined,
          hall: v.classType === "physical" ? v.hall.trim() : undefined,
          description: desc,
          status: v.status,
        };
        saved = await updateOnlineClass(item.id, payload);
        toast.success("Class updated");

        try {
          const locSubtitle =
            v.classType === "physical" && saved.hall
              ? `${saved.title} updated for ${v.date} at ${v.startTime} (${saved.batch} · ${saved.hall}).`
              : `${saved.title} updated for ${v.date} at ${v.startTime} (${saved.batch}).`;

          await createNotification({
            type: "class",
            title: "Class Schedule Updated",
            subtitle: locSubtitle,
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
          classType: v.classType,
          moduleId: v.moduleId,
          teacherId: v.teacherId,
          batch: trimmedBatch,
          start,
          end,
          link: v.classType === "online" ? v.link.trim() : undefined,
          hall: v.classType === "physical" ? v.hall.trim() : undefined,
          ...(desc ? { description: desc } : {}),
          status: v.status,
        };
        saved = await createOnlineClass(payload);
        toast.success("Class scheduled");

        try {
          const locSubtitle =
            v.classType === "physical" && saved.hall
              ? `${saved.title} has been scheduled for ${v.date} at ${v.startTime} (${saved.batch} · ${saved.hall}).`
              : `${saved.title} has been scheduled for ${v.date} at ${v.startTime} (${saved.batch}).`;

          // 1. Teacher alert
          await createNotification({
            type: "class",
            title: "New Class Scheduled",
            subtitle: locSubtitle,
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
      const msg = err instanceof Error ? err.message : "Failed to save class";
      toast.error(mapped ? `Please check the highlighted fields: ${msg}` : msg);
    } finally {
      onSubmittingChange(false);
    }
  };

  const classType = watch("classType");
  const link = watch("link");
  const validHref = /^https?:\/\/.+/i.test((link || "").trim());

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
          {batchOptions.map((b) => (
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

      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
          Class type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-medium transition",
              classType === "online"
                ? "border-brand/40 bg-brand/5 text-ink shadow-sm"
                : "border-line bg-surface-2/40 text-muted hover:border-line hover:text-ink",
            )}
          >
            <input
              type="checkbox"
              checked={classType === "online"}
              onChange={() => {
                setValue("classType", "online", { shouldValidate: true, shouldDirty: true });
              }}
              className="h-4 w-4 rounded border-line text-brand accent-brand focus:ring-brand"
            />
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4 text-brand" />
              Online class
            </span>
          </label>

          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-medium transition",
              classType === "physical"
                ? "border-teal-500/40 bg-teal-500/5 text-ink shadow-sm"
                : "border-line bg-surface-2/40 text-muted hover:border-line hover:text-ink",
            )}
          >
            <input
              type="checkbox"
              checked={classType === "physical"}
              onChange={() => {
                setValue("classType", "physical", { shouldValidate: true, shouldDirty: true });
              }}
              className="h-4 w-4 rounded border-line text-brand accent-brand focus:ring-brand"
            />
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Physical class
            </span>
          </label>
        </div>
      </div>

      {classType === "online" ? (
        <Field label="Meeting link (optional)" error={errors.link?.message} className="sm:col-span-2">
          <div className="flex gap-2">
            <Input {...register("link")} placeholder="https://meet.google.com/... (optional)" />
            {validHref ? (
              <a
                href={(link || "").trim()}
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
      ) : (
        <Field label="Hall" error={errors.hall?.message} className="sm:col-span-2">
          <div className="relative">
            <Input {...register("hall")} placeholder="e.g. Hall A, Main Auditorium, Lab 2" />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
        </Field>
      )}

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
      title={item ? "Edit class" : "Schedule class"}
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
