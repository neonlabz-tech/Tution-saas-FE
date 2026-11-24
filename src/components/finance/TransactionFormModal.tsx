import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, TxType } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createTransaction, updateTransaction } from "@/api/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import { formatLkrPrice, todayISO } from "@/lib/utils";

const schema = z.object({
  category: z.string().min(1, "Select a category"),
  amount: z.number({ message: "Enter an amount" }).positive("Must be greater than zero"),
  date: z.string().min(1, "Required"),
  description: z.string().min(3, "Add a short description"),
  method: z.string().min(1),
});
type Values = z.infer<typeof schema>;

function toDateInput(dateStr?: string | null): string {
  if (!dateStr) return todayISO();
  return dateStr.slice(0, 10);
}

function Inner({
  type,
  item,
  onClose,
  onSaved,
  onSubmittingChange,
}: {
  type: TxType;
  item: Transaction | null;
  onClose: () => void;
  onSaved?: (tx: Transaction) => void;
  onSubmittingChange: (loading: boolean) => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState("");
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          category: item.category,
          amount: item.amount,
          date: toDateInput(item.date),
          description: item.description,
          method: item.method ?? PAYMENT_METHODS[0],
        }
      : {
          category: cats[0],
          amount: undefined as unknown as number,
          date: todayISO(),
          description: "",
          method: PAYMENT_METHODS[0],
        },
  });

  const onSubmit = async (v: Values) => {
    setServerError("");
    onSubmittingChange(true);
    try {
      let saved: Transaction;
      if (item) {
        saved = await updateTransaction(item.id, {
          type,
          category: v.category,
          amount: v.amount,
          date: v.date,
          description: v.description,
          method: v.method,
          ...(item.studentId ? { studentId: item.studentId } : {}),
        });
        toast.success(`${type === "income" ? "Income" : "Expense"} updated: ${formatLkrPrice(v.amount)}`);
      } else {
        saved = await createTransaction({
          type,
          category: v.category,
          amount: v.amount,
          date: v.date,
          description: v.description,
          method: v.method,
        });
        toast.success(`${type === "income" ? "Income" : "Expense"} added: ${formatLkrPrice(v.amount)}`);
      }
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.details && typeof err.details === "object") {
          for (const [key, msg] of Object.entries(err.details)) {
            setError(key as keyof Values, { message: String(msg) });
          }
        }
        setServerError(err.message || "Failed to save transaction");
      } else {
        setServerError(err instanceof Error ? err.message : "Failed to save transaction");
      }
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">
          {serverError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={errors.category?.message}>
          <Select {...register("category")} disabled={isSubmitting}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {item && !cats.includes(item.category as (typeof cats)[number]) && (
              <option>{item.category}</option>
            )}
          </Select>
        </Field>
        <Field label="Amount (LKR)" error={errors.amount?.message}>
          <Input
            type="number"
            step={100}
            min={0}
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            {...register("amount", { valueAsNumber: true })}
            className="num"
            placeholder="0"
          />
        </Field>
        <Field label="Date" error={errors.date?.message}>
          <Input type="date" disabled={isSubmitting} {...register("date")} />
        </Field>
        <Field label={type === "income" ? "Received via" : "Paid via"} error={errors.method?.message}>
          <Select {...register("method")} disabled={isSubmitting}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Description"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Input
            {...register("description")}
            disabled={isSubmitting}
            placeholder={type === "income" ? "e.g. Hall rental" : "e.g. Monthly rent"}
          />
        </Field>
      </div>
    </form>
  );
}

export function TransactionFormModal({
  open,
  type,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  type: TxType;
  item: Transaction | null;
  onClose: () => void;
  onSaved?: (tx: Transaction) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={`${item ? "Edit" : "Add"} ${type}`}
      description={item ? "Update transaction details" : "Record a new entry in the institute ledger"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="tx-form" disabled={submitting}>
            {submitting ? "Saving…" : item ? "Save changes" : `Add ${type}`}
          </Button>
        </>
      }
    >
      {open && (
        <Inner
          key={item?.id ?? type}
          type={type}
          item={item}
          onClose={onClose}
          onSaved={onSaved}
          onSubmittingChange={setSubmitting}
        />
      )}
    </Modal>
  );
}
