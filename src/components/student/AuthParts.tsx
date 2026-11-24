import { useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Check, Eye, EyeOff, Info, Lock, Circle } from "lucide-react";
import { Card, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { passwordRules } from "@/lib/studentValidation";
import { INSTITUTE_NAME } from "@/lib/studentPortal";

/** Same centred-card look as the admin login, with the brand mark above it. */
export function AuthShell({ title, subtitle, children, footer, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 py-8">
      <div className={cn("w-full", wide ? "max-w-[480px]" : "max-w-[400px]")}>
        <Card className="px-6 py-9 shadow-pop sm:px-9 sm:py-11">
          <div className="mb-7 text-center">
            <div className="mb-5 flex items-center justify-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-secondary shadow-lg shadow-primary/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M4 8c3-3 5-3 8 0s5 3 8 0" />
                  <path d="M4 15c3-3 5-3 8 0s5 3 8 0" opacity="0.65" />
                </svg>
              </div>
              <div>
                <p className="font-heading text-lg font-extrabold leading-tight">EduFlow</p>
                <p className="text-xs text-muted">{INSTITUTE_NAME} · Student Portal</p>
              </div>
            </div>
            <h1 className="font-heading text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
        </Card>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export const AuthLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="font-semibold text-brand hover:underline">
    {children}
  </Link>
);

const alertTone = {
  error: { cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: AlertCircle },
  success: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  info: { cls: "border-primary/25 bg-primary/10 text-brand", icon: Info },
};
export function FormAlert({ tone, children, className }: { tone: keyof typeof alertTone; children: ReactNode; className?: string }) {
  const { cls, icon: Icon } = alertTone[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 leading-snug">{children}</div>
    </div>
  );
}

export function PasswordInput({ invalid, className, ...props }: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        {...props}
        type={show ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn("pl-10 pr-10", invalid && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15", className)}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-ink">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {passwordRules(value).map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1.5 text-[11px]", r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted")}>
          {r.ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {r.label}
        </li>
      ))}
    </ul>
  );
}

export const inputErr = (e?: string) => (e ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15" : "");
