import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, TxType } from "@/types";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/data/mock";
import { fmtLKR, todayISO } from "@/lib/utils";

const schema = z.object({
  category: z.string().min(1, "Select a category"),
  amount: z.number({ message: "Enter an amount" }).positive("Must be greater than zero"),
  date: z.string().min(1, "Required"),
  description: z.string().min(3, "Add a short description"),
  method: z.string().min(1),
});
type Values = z.infer<typeof schema>;

function Inner({ type, item, onClose }: { type: TxType; item: Transaction | null; onClose: () => void }) {
  const { saveTransaction } = useAppData();
  const toast = useToast();
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { category: item.category, amount: item.amount, date: item.date, description: item.description, method: item.method ?? PAYMENT_METHODS[1] }
      : { category: cats[0], amount: undefined as unknown as number, date: todayISO(), description: "", method: PAYMENT_METHODS[1] },
  });
  const onSubmit = (v: Values) => {
    saveTransaction({ ...item, ...v, type }, item?.id);
    toast.success(`${type === "income" ? "Income" : "Expense"} ${item ? "updated" : "added"}: ${fmtLKR(v.amount)} (demo entry)`);
    onClose();
  };
  return (
    <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Category" error={errors.category?.message}>
        <Select {...register("category")}>
          {cats.map((c) => <option key={c}>{c}</option>)}
          {item && !cats.includes(item.category) && <option>{item.category}</option>}
        </Select>
      </Field>
      <Field label="Amount (LKR)" error={errors.amount?.message}><Input type="number" step={100} {...register("amount", { valueAsNumber: true })} className="num" placeholder="0" /></Field>
      <Field label="Date" error={errors.date?.message}><Input type="date" {...register("date")} /></Field>
      <Field label={type === "income" ? "Received via" : "Paid via"}>
        <Select {...register("method")}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
      </Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2"><Input {...register("description")} placeholder={type === "income" ? "e.g. Hall rental" : "e.g. Monthly rent"} /></Field>
    </form>
  );
}

export function TransactionFormModal({ open, type, item, onClose }: { open: boolean; type: TxType; item: Transaction | null; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${item ? "Edit" : "Add"} ${type}`}
      description="Demo ledger entry — stored in local mock data only"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="tx-form">{item ? "Save changes" : `Add ${type}`}</Button>
        </>
      }
    >
      <Inner type={type} item={item} onClose={onClose} />
    </Modal>
  );
}
