import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, GraduationCap } from "lucide-react";
import type { BatchCategory, BatchItem } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createBatch, updateBatch } from "@/api/batches";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required (e.g. 2026-A Morning, Grade 6)"),
  code: z.string().trim().optional(),
  year: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const CURRENT_YEAR = new Date().getFullYear();

const ABBREVIATIONS: Record<string, string> = {
  "maths": "MATH",
  "combined": "MATH",
  "math": "MATH",
  "mathematics": "MATH",
  "biology": "BIO",
  "bio": "BIO",
  "physics": "PHY",
  "chemistry": "CHEM",
  "commerce": "COMM",
  "accounting": "ACC",
  "economics": "ECON",
  "business": "BS",
  "technology": "TECH",
  "engineering": "ET",
  "science": "SCI",
  "morning": "MORN",
  "evening": "EVE",
  "weekend": "WKND",
  "weekday": "WKDY",
  "revision": "REV",
  "theory": "THY",
  "paper": "PAPER",
  "english": "ENG",
  "sinhala": "SIN",
  "tamil": "TAM",
};

export function generateCodeFromName(name: string, _category: BatchCategory, year?: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Check for Grade patterns: e.g. "Grade 6", "Gr 7", "Grade 11", "Grade 11 O/L"
  const gradeMatch = trimmed.match(/(?:grade|gr)\s*(\d+)/i);
  if (gradeMatch) {
    const num = parseInt(gradeMatch[1], 10);
    const gPart = num < 10 ? `G0${num}` : `G${num}`;
    const isOL = /\b(o\/?l|ordinary\s*level)\b/i.test(trimmed);
    const yrInName = trimmed.match(/\b(20\d\d)\b/)?.[1];
    const yr = yrInName || year?.trim();
    const parts = [gPart];
    if (isOL) parts.push("OL");
    if (yr) parts.push(yr);
    return parts.join("-");
  }

  // A/L and general cohorts
  const clean = trimmed.replace(/[()[\]{}_/\\-]/g, " ");
  const words = clean.split(/\s+/).filter(Boolean);

  const segments: string[] = [];
  const seen = new Set<string>();

  for (const rawWord of words) {
    const w = rawWord.toLowerCase();
    if (["and", "the", "of", "for", "in", "with", "batch", "class", "group"].includes(w)) {
      continue;
    }

    if (w === "a/l" || w === "al") {
      if (!seen.has("AL")) {
        segments.push("AL");
        seen.add("AL");
      }
      continue;
    }

    if (ABBREVIATIONS[w]) {
      const abbr = ABBREVIATIONS[w];
      if (!seen.has(abbr)) {
        segments.push(abbr);
        seen.add(abbr);
      }
      continue;
    }

    // Four-digit Year (e.g. 2026, 2027)
    if (/^\d{4}$/.test(rawWord)) {
      if (!seen.has(rawWord)) {
        segments.push(rawWord);
        seen.add(rawWord);
      }
      continue;
    }

    // Short section / number (e.g. "A", "B", "1", "2")
    if (rawWord.length <= 3) {
      const up = rawWord.toUpperCase();
      if (!seen.has(up)) {
        segments.push(up);
        seen.add(up);
      }
      continue;
    }

    // Word abbreviation (first 4 uppercase letters)
    const short = rawWord.slice(0, 4).toUpperCase();
    if (!seen.has(short)) {
      segments.push(short);
      seen.add(short);
    }
  }

  // If no year was included yet in segments and category is AL / year provided
  const yrInName = trimmed.match(/\b(20\d\d)\b/)?.[1];
  const activeYear = yrInName || year?.trim();
  if (activeYear && !seen.has(activeYear)) {
    segments.unshift(activeYear);
  }

  const result = segments.join("-");
  return result || trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 15);
}

export function BatchFormModal({
  open,
  item = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  item?: BatchItem | null;
  onClose: () => void;
  onSaved?: (batch: BatchItem) => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<BatchCategory>("al");
  const [isCodeManual, setIsCodeManual] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      year: String(CURRENT_YEAR),
      description: "",
    },
  });

  useEffect(() => {
    if (item) {
      setCategory(item.category || (/\b(grade|ol|o\/l)\b/i.test(item.name) ? "grade" : "al"));
      setIsCodeManual(Boolean(item.code));
      reset({
        name: item.name ?? "",
        code: item.code ?? "",
        year: item.year ?? "",
        description: item.description ?? "",
      });
    } else {
      setCategory("al");
      setIsCodeManual(false);
      reset({
        name: "",
        code: "",
        year: String(CURRENT_YEAR),
        description: "",
      });
    }
  }, [item, open, reset]);

  const handleCategorySwitch = (nextCat: BatchCategory) => {
    setCategory(nextCat);
    if (!isCodeManual) {
      const currentName = watch("name");
      if (currentName) {
        const generated = generateCodeFromName(currentName, nextCat, watch("year"));
        setValue("code", generated);
      }
    }
  };

  const handleNameChange = (val: string) => {
    if (!isCodeManual) {
      const generated = generateCodeFromName(val, category, watch("year"));
      setValue("code", generated);
    }
  };

  const handleYearChange = (val: string) => {
    if (!isCodeManual) {
      const generated = generateCodeFromName(watch("name"), category, val);
      setValue("code", generated);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      let saved: BatchItem;
      const payload = {
        name: values.name.trim(),
        code: values.code?.trim() || undefined,
        year: values.year?.trim() || undefined,
        description: values.description?.trim() || undefined,
        category,
        status: item?.status || "active",
      };

      if (item) {
        saved = await updateBatch(item.id, payload);
        const labelType = category === "grade" ? "Grade" : "Batch";
        toast.success(`${labelType} "${saved.name}" updated successfully`);
      } else {
        saved = await createBatch(payload);
        const labelType = category === "grade" ? "Grade" : "Batch";
        toast.success(`${labelType} "${saved.name}" created successfully`);
      }

      reset();
      setIsCodeManual(false);
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${item ? "update" : "create"} batch`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    setIsCodeManual(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        category === "grade"
          ? item
            ? `Edit Grade "${item.name}"`
            : "Create New Grade"
          : item
            ? `Edit Batch "${item.name}"`
            : "Create New Batch"
      }
      description={
        category === "grade"
          ? item
            ? `Update details and code for grade ${item.name}.`
            : "Add a secondary school grade (Grade 6–11 / O/L) for annual progression."
          : item
            ? `Update details and cohort settings for batch ${item.name}.`
            : "Add an academic cohort for student enrollments and modules."
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-batch-form"
            loading={submitting}
            disabled={submitting}
          >
            {item ? "Save changes" : category === "grade" ? "Create Grade" : "Create Batch"}
          </Button>
        </>
      }
    >
      <form id="create-batch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Category Segmented Control */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            Category
          </label>
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-line bg-surface-2/40 p-1.5">
            <button
              type="button"
              onClick={() => handleCategorySwitch("al")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all sm:text-sm",
                category === "al"
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Advanced Level (A/L)</span>
            </button>
            <button
              type="button"
              onClick={() => handleCategorySwitch("grade")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all sm:text-sm",
                category === "grade"
                  ? "bg-secondary text-white shadow-md shadow-secondary/25"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <BookOpen className="h-4 w-4" />
              <span>Grades 6–11 (O/L)</span>
            </button>
          </div>
        </div>

        {/* Inputs - Dynamic Label: "Grade *" for Grades, "Batch Name *" for A/L */}
        <Field
          label={category === "grade" ? "Grade *" : "Batch Name *"}
          error={errors.name?.message}
        >
          <Input
            placeholder={
              category === "al"
                ? "e.g. 2026-A Morning, 2027 A/L Revision"
                : "e.g. Grade 6, Grade 7, Grade 11 (O/L)"
            }
            {...register("name", {
              onChange: (e) => handleNameChange(e.target.value),
            })}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={category === "grade" ? "Grade Code" : "Batch Code"}
            error={errors.code?.message}
          >
            <Input
              placeholder={category === "al" ? "e.g. 2026-A-MORN" : "e.g. G06-2026"}
              {...register("code", {
                onChange: (e) => {
                  // Mark as manual when user enters custom code, or re-enable auto-gen if cleared
                  setIsCodeManual(Boolean(e.target.value.trim()));
                },
              })}
            />
          </Field>

          <Field label="Academic Year" error={errors.year?.message}>
            <Input
              placeholder="e.g. 2026"
              {...register("year", {
                onChange: (e) => handleYearChange(e.target.value),
              })}
            />
          </Field>
        </div>

        <Field label="Description" error={errors.description?.message}>
          <Textarea
            rows={2.5}
            placeholder="Optional details about schedule, syllabus target, or campus location..."
            {...register("description")}
          />
        </Field>
      </form>
    </Modal>
  );
}
