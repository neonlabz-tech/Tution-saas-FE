import { useState } from "react";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  RotateCw,
  Trash2,
  Video,
} from "lucide-react";
import type { ClassStatus, ModuleListItem, OnlineClassItem } from "@/types";
import type { TeacherListItem } from "@/lib/api";
import { Drawer } from "@/components/ui/overlays";
import { Badge, Button, InfoRow, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { updateOnlineClass } from "@/api/onlineClasses";
import { useOnlineClassDetail } from "@/hooks/useOnlineClasses";
import { formatDate, formatTime, toLocalDT } from "@/lib/utils";

export function ClassDetailDrawer({
  classId,
  refreshKey,
  moduleMap,
  teacherMap,
  onClose,
  onEdit,
  onDelete,
  onUpdated,
}: {
  classId: string | null;
  refreshKey?: number;
  moduleMap: Map<string, ModuleListItem>;
  teacherMap: Map<string, TeacherListItem>;
  onClose: () => void;
  onEdit: (item: OnlineClassItem) => void;
  onDelete: (target: { id: string; title: string }) => void;
  onUpdated: (item: OnlineClassItem) => void;
}) {
  const toast = useToast();
  const { item, setItem, loading, error, refresh } = useOnlineClassDetail(classId, refreshKey);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);

  const mod = item ? moduleMap.get(item.moduleId) : undefined;
  const moduleCode = item?.module?.code ?? item?.moduleCode ?? mod?.code;
  const moduleName = item?.module?.name ?? item?.moduleName ?? mod?.name ?? "Unknown module";
  const teacherName =
    item?.teacher?.fullName ??
    item?.teacherName ??
    (item ? teacherMap.get(item.teacherId)?.fullName : undefined) ??
    "Unassigned";

  const handleCopyLink = async () => {
    if (!item?.link) return;
    try {
      await navigator.clipboard.writeText(item.link);
      setCopied(true);
      toast.success("Meeting link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleStatusChange = async (status: ClassStatus) => {
    if (!item || updatingStatus || item.status === status) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateOnlineClass(item.id, { status });
      setItem({ ...item, ...updated });
      onUpdated({ ...item, ...updated });
      toast.success(
        status === "cancelled"
          ? "Class cancelled"
          : status === "completed"
            ? "Class marked completed"
            : "Class marked scheduled",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update class status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const now = toLocalDT(new Date());
  const isPast = item ? item.end < now : false;
  const isCancelled = item?.status === "cancelled";
  const isCompleted = item?.status === "completed";
  const isEnded = isPast || isCompleted;

  return (
    <Drawer
      open={!!classId}
      onClose={onClose}
      title={item?.title ?? "Class details"}
      description={moduleCode ? `${moduleCode} · ${moduleName}` : classId ?? undefined}
    >
      {loading && !item ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error && !item ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="font-heading text-sm font-bold">Could not load class details</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={refresh}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : (
        item && (
          <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {item.status === "scheduled" && isPast ? (
                  <Badge tone="neutral">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Ended
                  </Badge>
                ) : (
                  <StatusBadge status={item.status} />
                )}
                {item.classType === "physical" ? (
                  <Badge tone="teal">
                    <MapPin className="mr-1 inline-block h-3 w-3" />
                    Physical · {item.hall || "Hall"}
                  </Badge>
                ) : (
                  <Badge tone="primary">
                    <Video className="mr-1 inline-block h-3 w-3" />
                    Online
                  </Badge>
                )}
                <Badge tone="primary">{item.batch}</Badge>
                {moduleCode && <Badge tone="teal">{moduleCode}</Badge>}
              </div>

              <div className="flex flex-wrap gap-2">
                {item.link ? (
                  isCancelled ? (
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 text-xs font-semibold text-muted opacity-70">
                      <Ban className="h-3.5 w-3.5" /> Class cancelled
                    </span>
                  ) : isEnded ? (
                    <>
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3.5 text-xs font-semibold text-muted opacity-70">
                        <Clock className="h-3.5 w-3.5" /> Class ended
                      </span>
                      <Button size="sm" variant="soft" onClick={() => void handleCopyLink()}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy link"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-violet-600 px-3.5 text-xs font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
                      >
                        <Video className="h-3.5 w-3.5" /> Join class
                      </a>
                      <Button size="sm" variant="soft" onClick={() => void handleCopyLink()}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy link"}
                      </Button>
                    </>
                  )
                ) : item.classType === "physical" && item.hall ? (
                  <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                    <MapPin className="h-3.5 w-3.5" /> Location: {item.hall}
                  </div>
                ) : null}
                <Button size="sm" variant="soft" onClick={() => onEdit(item)} disabled={updatingStatus}>
                  <Pencil className="h-3.5 w-3.5" /> Edit / Reschedule
                </Button>
              </div>

            <div className="rounded-2xl border border-line p-4">
              <InfoRow label="Type">
                <span className="capitalize font-medium">
                  {item.classType === "physical" ? "Physical class" : "Online class"}
                </span>
              </InfoRow>
              <InfoRow label="Module">
                <span>
                  {moduleCode ? <span className="num mr-1.5 text-xs text-muted">{moduleCode}</span> : null}
                  {moduleName}
                </span>
              </InfoRow>
              <InfoRow label="Teacher">{teacherName}</InfoRow>
              <InfoRow label="Batch">{item.batch}</InfoRow>
              <InfoRow label="Date">{formatDate(item.start)}</InfoRow>
              <InfoRow label="Time">
                <span className="num">
                  {formatTime(item.start)} – {formatTime(item.end)}
                </span>
              </InfoRow>
              {item.classType === "physical" && item.hall ? (
                <InfoRow label="Hall / Room">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    {item.hall}
                  </span>
                </InfoRow>
              ) : null}
              {item.link ? (
                <InfoRow label="Meeting link">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-[240px] items-center gap-1 truncate text-brand hover:underline"
                  >
                    <span className="truncate">{item.link}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </InfoRow>
              ) : null}
            </div>

            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                Description
              </h4>
              <p className="whitespace-pre-line rounded-2xl bg-surface-2/70 p-4 text-sm leading-relaxed text-ink">
                {item.description?.trim() ? item.description : "No description provided."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {item.status === "scheduled" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updatingStatus}
                      onClick={() => void handleStatusChange("completed")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Mark completed
                    </Button>
                    <Button
                      size="sm"
                      variant="dangerSoft"
                      disabled={updatingStatus}
                      onClick={() => void handleStatusChange("cancelled")}
                    >
                      <Ban className="h-3.5 w-3.5" /> Cancel class
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updatingStatus}
                    onClick={() => void handleStatusChange("scheduled")}
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Re-open as scheduled
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                variant="dangerSoft"
                disabled={updatingStatus}
                onClick={() => onDelete({ id: item.id, title: item.title })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        )
      )}
    </Drawer>
  );
}
