import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* ---------- Button ---------- */
const variants = {
  primary: "bg-gradient-to-br from-primary to-[#6D3599] text-white shadow-lg shadow-primary/25 hover:brightness-110",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  soft: "bg-primary/10 text-brand hover:bg-primary/15",
  danger: "bg-[#4D1882] text-white shadow-lg shadow-[#4D1882]/20 hover:bg-[#3D1168]",
  dangerSoft: "bg-[#4D1882]/10 text-[#4D1882] hover:bg-[#4D1882]/15 dark:text-[#CBADE3]",
};
const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-11 gap-2 rounded-xl px-5 text-sm",
  icon: "h-9 w-9 rounded-xl",
};
export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Card ---------- */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-line bg-surface shadow-card", className)} {...props} />;
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 p-5 pb-0", className)}>
      <div className="min-w-0">
        <h3 className="font-heading text-base font-bold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
const tones = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary/15 text-brand",
  teal: "bg-[#BC99D9]/20 text-[#6D3599] dark:text-[#E8DAF3]",
  amber: "bg-[#A771CF]/20 text-[#552780] dark:text-[#DEC8ED]",
  rose: "bg-[#4D1882]/15 text-[#3D1168] dark:text-[#CBADE3]",
  green: "bg-[#7D41AB]/15 text-[#6D3599] dark:text-[#DEC8ED]",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", tones[tone], className)}>{children}</span>;
}
const STATUS_TONE: Record<string, Tone> = {
  active: "green", present: "green", completed: "green", published: "green", paid: "green", income: "green",
  inactive: "rose", archived: "neutral", expired: "neutral", draft: "neutral", low: "teal",
  pending: "amber", late: "amber", upcoming: "amber", scheduled: "primary", medium: "amber", partial: "amber",
  absent: "rose", cancelled: "rose", suspended: "rose", high: "rose", unpaid: "rose", expense: "rose",
  excused: "primary", graduated: "primary",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace("-", " ")}
    </Badge>
  );
}

/* ---------- Form controls ---------- */
const control =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-[88px] resize-y py-2.5", className)} {...props} />;
}
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-10 cursor-pointer appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input className={cn(control, "h-10 pl-10")} {...props} />
    </div>
  );
}
export function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-ink/80">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-500">{error}</span>}
    </label>
  );
}

export function MultiSelect({
  options,
  value,
  onChange,
  className,
  allowCustom = false,
  customPlaceholder = "Add new batch…",
  onAddCustom,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  onAddCustom?: (newValue: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const mergedOptions = [...options];
  for (const selected of value) {
    if (selected && !mergedOptions.some((o) => o.value === selected)) {
      mergedOptions.push({ value: selected, label: selected });
    }
  }

  const addCustom = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    onAddCustom?.(trimmed);
    setDraft("");
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap gap-2">
        {mergedOptions.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                on ? "border-primary bg-primary/10 text-brand" : "border-line bg-surface text-muted hover:border-primary/40 hover:text-ink",
              )}
            >
              {on ? "✓ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addCustom();
              }
            }}
            placeholder={customPlaceholder}
            className="h-9 max-w-[230px] text-xs"
          />
          <Button type="button" size="sm" variant="soft" onClick={addCustom} disabled={!draft.trim()}>
            + Add
          </Button>
        </div>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors", checked ? "bg-primary" : "bg-line")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ---------- Misc ---------- */
const GRADS = [
  "from-[#8B51BE] to-[#6D3599]",
  "from-[#BC99D9] to-[#713E99]",
  "from-[#A771CF] to-[#552780]",
  "from-[#CBADE3] to-[#A774D1]",
  "from-[#A774D1] to-[#461A71]",
  "from-[#4D1882] to-[#2B0A4D]",
  "from-[#693AA0] to-[#2F164E]",
];
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const s = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" }[size];
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-heading font-bold text-white", GRADS[h % GRADS.length], s, className)}>
      {initials(name)}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const gid = useId();
  return (
    <div className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1", className)}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn("relative flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors", value === it.id ? "text-ink" : "text-muted hover:text-ink")}
        >
          {value === it.id && <motion.span layoutId={`tab-${gid}`} className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
          <span className="relative flex items-center gap-2">
            {it.icon}
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary", className }: { value: number; tone?: "primary" | "teal" | "amber" | "rose"; className?: string }) {
  const c = { primary: "bg-primary", teal: "bg-secondary", amber: "bg-accent", rose: "bg-[#4D1882]" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={cn("h-full rounded-full", c)} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon ?? <X className="h-6 w-6" />}</div>
      <h4 className="font-heading text-base font-bold">{title}</h4>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{children}</span>
    </div>
  );
}

export function MockNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-surface-2/60 px-3 py-2 text-[11px] leading-relaxed text-muted">{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}
