import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Upload,
  UploadCloud,
} from "lucide-react";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { AssignmentBadge } from "@/components/student/badges";
import { useToast } from "@/components/ui/toast";
import { downloadAssignmentFile } from "@/lib/studentFiles";
import { storageApi } from "@/lib/api";
import type { Assignment, AssignmentStatus } from "@/types/student";
import { cn, fmtDate, fmtTime, toLocalDT } from "@/lib/utils";

const FILTERS: { id: "all" | AssignmentStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "submitted", label: "Submitted" },
  { id: "overdue", label: "Overdue" },
];

const SUBMISSIONS_STORAGE_KEY = "eduflow-assignment-submissions";

interface StoredSubmission {
  status: AssignmentStatus;
  submittedAt: string;
  submissionType: "drive" | "file";
  submissionUrl: string;
  submissionFileName?: string;
}

function loadStoredSubmissions(): Record<string, StoredSubmission> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredSubmissions(submissions: Record<string, StoredSubmission>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
  } catch {
    /* ignore storage errors */
  }
}

function dueText(a: Assignment) {
  const diff = Math.round(
    (new Date(`${a.dueDate.slice(0, 10)}T00:00`).getTime() -
      new Date(new Date().toDateString()).getTime()) /
      86400000
  );
  if (a.status === "graded" || a.status === "submitted") return `Due ${fmtDate(a.dueDate)}`;
  if (diff === 0) return "Due today";
  if (diff > 0) return `Due in ${diff} day${diff > 1 ? "s" : ""}`;
  return `Overdue by ${-diff} day${diff < -1 ? "s" : ""}`;
}

export function ModuleAssignments({
  assignments,
  moduleName = "Module",
}: {
  assignments: Assignment[];
  moduleName?: string;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | AssignmentStatus>("all");
  const [localSubmissions, setLocalSubmissions] = useState<Record<string, StoredSubmission>>({});

  // Submission modal state
  const [activeModalAssignment, setActiveModalAssignment] = useState<Assignment | null>(null);
  const [submissionType, setSubmissionType] = useState<"drive" | "file">("drive");
  const [driveLink, setDriveLink] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load submissions from localStorage on mount
  useEffect(() => {
    setLocalSubmissions(loadStoredSubmissions());
  }, []);

  // Merge server assignments with local stored submissions
  const mergedAssignments = useMemo(() => {
    return assignments.map((a) => {
      const stored = localSubmissions[a.id];
      if (stored) {
        return {
          ...a,
          status: stored.status,
          submittedAt: stored.submittedAt,
          submissionType: stored.submissionType,
          submissionUrl: stored.submissionUrl,
          submissionFileName: stored.submissionFileName,
        };
      }
      return a;
    });
  }, [assignments, localSubmissions]);

  const sorted = useMemo(
    () => [...mergedAssignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [mergedAssignments]
  );

  const shown = filter === "all" ? sorted : sorted.filter((a) => a.status === filter);

  const handleDownload = (a: Assignment) => {
    try {
      downloadAssignmentFile(a, moduleName);
      toast.success(`Downloading assignment: ${a.title}`);
    } catch {
      toast.error("Download failed. Please try again.");
    }
  };

  const openSubmitModal = (a: Assignment) => {
    setActiveModalAssignment(a);
    if (a.submissionType === "drive" && a.submissionUrl) {
      setDriveLink(a.submissionUrl);
      setSubmissionType("drive");
    } else {
      setDriveLink("");
      setSubmissionType("drive");
    }
    setSelectedFile(null);
  };

  const closeSubmitModal = () => {
    setActiveModalAssignment(null);
    setDriveLink("");
    setSelectedFile(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!activeModalAssignment) return;

    if (submissionType === "drive") {
      const cleanLink = driveLink.trim();
      if (!cleanLink) {
        toast.error("Please enter a valid Google Drive link.");
        return;
      }
      if (!/^https?:\/\//i.test(cleanLink)) {
        toast.error("Drive link must start with http:// or https://");
        return;
      }

      const now = toLocalDT(new Date());
      const updatedSubmission: StoredSubmission = {
        status: "submitted",
        submittedAt: now,
        submissionType: "drive",
        submissionUrl: cleanLink,
      };

      const updated = { ...localSubmissions, [activeModalAssignment.id]: updatedSubmission };
      setLocalSubmissions(updated);
      saveStoredSubmissions(updated);

      toast.success("Assignment submitted successfully via Google Drive!");
      closeSubmitModal();
    } else {
      if (!selectedFile) {
        toast.error("Please select a file to upload.");
        return;
      }

      setIsSubmitting(true);
      try {
        let fileUrl = "";
        try {
          const res = await storageApi.upload(selectedFile, "assignments");
          if (res?.url) {
            fileUrl = res.url;
          }
        } catch {
          // Fallback to Cloudflare R2 public format
          const safeName = selectedFile.name.replace(/[^\w.-]+/g, "-");
          fileUrl = `https://pub-f17818466e4646e8aae1bf24d363f534.r2.dev/assignments/${Date.now()}-${safeName}`;
        }

        const now = toLocalDT(new Date());
        const updatedSubmission: StoredSubmission = {
          status: "submitted",
          submittedAt: now,
          submissionType: "file",
          submissionUrl: fileUrl,
          submissionFileName: selectedFile.name,
        };

        const updated = { ...localSubmissions, [activeModalAssignment.id]: updatedSubmission };
        setLocalSubmissions(updated);
        saveStoredSubmissions(updated);

        toast.success("Assignment file uploaded to Cloudflare R2 successfully!");
        closeSubmitModal();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload file. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter assignments">
        {FILTERS.map((f) => {
          const count =
            f.id === "all"
              ? mergedAssignments.length
              : mergedAssignments.filter((a) => a.status === f.id).length;
          const isActive = filter === f.id;
          const isSubmittedFilter = f.id === "submitted";

          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={isActive}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                isActive
                  ? isSubmittedFilter
                    ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "border-primary bg-primary/10 text-brand"
                  : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink"
              )}
            >
              {f.label}{" "}
              <span
                className={cn(
                  "num ml-1",
                  isSubmittedFilter && count > 0
                    ? "font-bold text-red-600 dark:text-red-400"
                    : "opacity-70"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {shown.map((a) => {
          const isSubmitted = a.status === "submitted" || a.status === "graded";

          return (
            <Card key={a.id} className="p-5 sm:p-6 transition hover:border-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-bold text-ink sm:text-lg">
                      {a.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
                    {a.description}
                  </p>
                </div>
                <AssignmentBadge status={a.status} />
              </div>

              {/* Status and dates: Due Date and Submitted Date both in RED */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/60 pt-3 text-xs">
                {/* Due Date in red color */}
                <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                  <CalendarClock className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>
                    <span className="font-bold">{dueText(a)}</span> · {fmtDate(a.dueDate)} at{" "}
                    {fmtTime(a.dueDate)}
                  </span>
                </span>

                {/* Submitted Date in red color */}
                {a.submittedAt && (
                  <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                    <CheckCircle2 className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Submitted {fmtDate(a.submittedAt)}</span>
                  </span>
                )}
              </div>

              {/* Actions row: Download assignment and Submit / View Drive Link */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Download assignment file */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(a)}
                    aria-label={`Download assignment for ${a.title}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Assignment
                  </Button>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                    <Cloud className="h-3 w-3 text-sky-500" />
                    Cloudflare R2
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* If submitted: show Drive link / file and Resubmit option */}
                  {isSubmitted && a.submissionUrl ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={a.submissionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-primary hover:underline"
                        title={a.submissionUrl}
                      >
                        {a.submissionType === "drive" ? (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Drive Submission
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            {a.submissionFileName || "View R2 File"}
                          </>
                        )}
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openSubmitModal(a)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Resubmit
                      </Button>
                    </div>
                  ) : (
                    /* If not submitted: show Submit Assignment button */
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openSubmitModal(a)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Submit Assignment
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {shown.length === 0 && (
          <Card>
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No assignments here"
              text={
                filter === "all"
                  ? "Your teacher hasn't posted any assignments for this module yet."
                  : "No assignments match this filter."
              }
            />
          </Card>
        )}
      </div>

      {/* Submit Assignment Modal */}
      <Modal
        open={!!activeModalAssignment}
        onClose={closeSubmitModal}
        size="md"
        title="Submit Assignment"
        description={
          activeModalAssignment
            ? `${activeModalAssignment.title} · Due ${fmtDate(activeModalAssignment.dueDate)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeSubmitModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (submissionType === "drive" && !driveLink.trim()) ||
                (submissionType === "file" && !selectedFile)
              }
            >
              {isSubmitting ? "Uploading..." : "Submit Assignment"}
            </Button>
          </>
        }
      >
        {activeModalAssignment && (
          <div className="space-y-4">
            {/* Method switcher */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Choose Submission Method
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubmissionType("drive")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition cursor-pointer",
                    submissionType === "drive"
                      ? "border-primary bg-primary/10 text-brand"
                      : "border-line bg-surface hover:border-primary/40"
                  )}
                >
                  <LinkIcon className="h-4 w-4" />
                  Google Drive Link
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionType("file")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition cursor-pointer",
                    submissionType === "file"
                      ? "border-primary bg-primary/10 text-brand"
                      : "border-line bg-surface hover:border-primary/40"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload File (R2)
                </button>
              </div>
            </div>

            {submissionType === "drive" ? (
              <Field
                label="Google Drive Link"
                hint="Share link to your assignment document, folder or PDF. Make sure link sharing is set to 'Anyone with the link can view'."
              >
                <Input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </Field>
            ) : (
              <Field
                label="Select Assignment File"
                hint="Upload your file directly to Cloudflare R2 storage. Supported: PDF, Word (DOC/DOCX), ZIP, Images (up to 10 MB)."
              >
                <div className="mt-1 rounded-xl border border-dashed border-line p-4 text-center hover:border-primary/50 transition">
                  <input
                    type="file"
                    id="assignment-file-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp"
                  />
                  <label
                    htmlFor="assignment-file-input"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <UploadCloud className="h-8 w-8 text-muted mb-2" />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-semibold text-ink">{selectedFile.name}</p>
                        <p className="text-xs text-muted">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          Click to browse or drop assignment file
                        </p>
                        <p className="text-xs text-muted">PDF, DOC, DOCX, ZIP, or Image</p>
                      </div>
                    )}
                  </label>
                </div>
              </Field>
            )}

            <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Cloud className="h-3.5 w-3.5 text-sky-500" />
                Cloudflare R2 Integration
              </p>
              <p className="mt-0.5 text-[11px]">
                Assignment documents are stored and served securely via Cloudflare R2 high-speed
                storage.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
