import { useState, useMemo } from "react";
import { ArrowRightLeft, BookOpen, GraduationCap } from "lucide-react";
import type { BatchItem } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { moveStudentsToBatch } from "@/api/students";
import { BATCHES } from "@/lib/constants";

interface MoveBatchModalProps {
  open: boolean;
  studentIds: string[];
  batches: BatchItem[];
  onClose: () => void;
  onSuccess: (targetBatch: string, count: number) => void;
}

export function MoveBatchModal({
  open,
  studentIds,
  batches,
  onClose,
  onSuccess,
}: MoveBatchModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Group batches into Grade vs AL
  const { gradeBatches, alBatches } = useMemo(() => {
    const grade: string[] = [];
    const al: string[] = [];

    // All available batch names from DB
    batches.forEach((b) => {
      if (b.category === "grade" || /grade\s*\d+/i.test(b.name)) {
        if (!grade.includes(b.name)) grade.push(b.name);
      } else {
        if (!al.includes(b.name)) al.push(b.name);
      }
    });

    // Fallback/standard batches from constants
    BATCHES.forEach((name) => {
      if (/grade\s*\d+/i.test(name)) {
        if (!grade.includes(name)) grade.push(name);
      } else {
        if (!al.includes(name)) al.push(name);
      }
    });

    return { gradeBatches: grade, alBatches: al };
  }, [batches]);

  const defaultBatch = gradeBatches[0] || alBatches[0] || "";
  const [targetBatch, setTargetBatch] = useState(defaultBatch);

  // Keep targetBatch in sync with available batches when opened
  const currentTarget = targetBatch || defaultBatch;

  const handleConfirm = async () => {
    if (!currentTarget) {
      toast.error("Please select a target batch");
      return;
    }

    setSubmitting(true);
    try {
      const res = await moveStudentsToBatch(studentIds, currentTarget);
      toast.success(
        `Successfully moved ${res.updatedCount ?? studentIds.length} student${
          (res.updatedCount ?? studentIds.length) > 1 ? "s" : ""
        } to "${currentTarget}"`,
      );
      onSuccess(currentTarget, res.updatedCount ?? studentIds.length);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to move students to target batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Move Students to Batch"
      description="Transfer or promote selected students to an academic cohort or next grade."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={submitting}
            disabled={submitting || !currentTarget}
          >
            Move {studentIds.length} Student{studentIds.length > 1 ? "s" : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div className="text-muted leading-relaxed">
            <p className="font-semibold text-ink">
              Moving {studentIds.length} selected student{studentIds.length > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5">
              Their batch assignment will be updated immediately. For school students, select the
              next grade to promote them for the new academic year.
            </p>
          </div>
        </div>

        {/* Destination Batch Selector */}
        <Field label="Destination Batch *">
          <Select
            value={currentTarget}
            onChange={(e) => setTargetBatch(e.target.value)}
            disabled={submitting}
          >
            {gradeBatches.length > 0 && (
              <optgroup label="Secondary / School Grades (Grade 6–11)">
                {gradeBatches.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
            {alBatches.length > 0 && (
              <optgroup label="Advanced Level (A/L Cohorts)">
                {alBatches.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {/* Quick select pills */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
            Quick Select
          </label>
          <div className="space-y-2">
            {gradeBatches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] text-muted mr-1">
                  <BookOpen className="h-3 w-3 text-secondary" /> Grades:
                </span>
                {gradeBatches.slice(0, 5).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTargetBatch(name)}
                    className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                      currentTarget === name
                        ? "border-secondary bg-secondary/15 text-secondary font-bold"
                        : "border-line bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {alBatches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] text-muted mr-1">
                  <GraduationCap className="h-3 w-3 text-primary" /> A/L:
                </span>
                {alBatches.slice(0, 4).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTargetBatch(name)}
                    className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                      currentTarget === name
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-line bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
