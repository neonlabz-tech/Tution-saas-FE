import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, GraduationCap, KeyRound, LogIn, Mail, Send } from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { FormAlert, PasswordInput, inputErr } from "@/components/student/AuthParts";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { authApi, clearAuthToken } from "@/lib/api";
import { vEmail, vLoginPassword } from "@/lib/studentValidation";

export default function TeacherLoginPage() {
  const { user, loading, config, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const from = ((useLocation().state ?? {}) as { from?: string }).from;
  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (!loading && user?.role === "teacher") return <Navigate to={from ?? "/teacher"} replace />;

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const next = { email: vEmail(email), password: vLoginPassword(password) };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setSubmitting(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      if (res.user.role !== "teacher") {
        clearAuthToken(); // never keep a non-teacher token from this portal
        setFormError(`This portal is for teachers. Your account is registered as ${res.user.role.replace("_", " ")}.`);
        return;
      }
      await refreshUser();
      toast.success("Signed in successfully");
      navigate(from ?? "/teacher", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    const err = vEmail(email);
    setErrors({ email: err });
    setFormError(null);
    if (err) return;
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (e2) {
      setFormError(e2 instanceof Error ? e2.message : "We couldn't send the reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="flex min-h-[480px] w-full max-w-[400px] flex-col justify-center px-7 py-10 shadow-pop sm:px-9 sm:py-12">
        <div className="mb-7 text-center">
          <div className="mb-4 flex items-center justify-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary via-primary to-accent shadow-lg shadow-primary/30">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 8c3-3 5-3 8 0s5 3 8 0" /><path d="M4 15c3-3 5-3 8 0s5 3 8 0" opacity="0.65" /></svg>
            </div>
            <div><p className="font-heading text-xl font-extrabold leading-tight">EduFlow</p><p className="text-xs text-muted">{config?.instituteName ?? "Tuition Management System"}</p></div>
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted"><GraduationCap className="h-3 w-3 text-brand" /> Teacher Portal</div>
          <h1 className="font-heading text-2xl font-extrabold">{view === "login" ? "Welcome back" : "Reset password"}</h1>
          <p className="mt-1 text-xs text-muted">{view === "login" ? "Sign in to manage your classes, batches and notices." : "Enter your account email and we'll send you a reset link."}</p>
        </div>

        {view === "login" ? (
          <form onSubmit={onLogin} noValidate className="space-y-5">
            {formError && <FormAlert tone="error">{formError}</FormAlert>}
            <Field label="Email" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input type="email" autoComplete="email" value={email} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} className={`pl-10 ${inputErr(errors.email)}`} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: vEmail(e.target.value) })); }} onBlur={() => setErrors((p) => ({ ...p, email: vEmail(email) }))} />
              </div>
            </Field>
            <Field label="Password" error={errors.password}>
              <PasswordInput autoComplete="current-password" value={password} placeholder="Enter your password" invalid={Boolean(errors.password)} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: vLoginPassword(e.target.value) })); }} onBlur={() => setErrors((p) => ({ ...p, password: vLoginPassword(password) }))} />
            </Field>
            <div className="-mt-2 text-right text-xs"><button type="button" onClick={() => { setView("forgot"); setFormError(null); setSent(false); }} className="cursor-pointer font-semibold text-brand hover:underline">Forgot password?</button></div>
            <Button type="submit" className="w-full" disabled={submitting}><LogIn className="h-4 w-4" />{submitting ? "Signing in…" : "Sign in"}</Button>
          </form>
        ) : sent ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-brand"><CheckCircle2 className="h-6 w-6" /></div>
            <p className="text-sm text-muted">If <strong className="text-ink">{email.trim()}</strong> belongs to a teacher account, a password reset link is on its way.</p>
            <Button variant="secondary" className="w-full" onClick={() => setView("login")}><ArrowLeft className="h-4 w-4" /> Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={onForgot} noValidate className="space-y-5">
            {formError && <FormAlert tone="error">{formError}</FormAlert>}
            <Field label="Email" error={errors.email}>
              <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input type="email" autoComplete="email" value={email} placeholder="you@example.com" className={`pl-10 ${inputErr(errors.email)}`} onChange={(e) => setEmail(e.target.value)} /></div>
            </Field>
            <Button type="submit" className="w-full" disabled={submitting}><Send className="h-4 w-4" />{submitting ? "Sending…" : "Send reset link"}</Button>
            <button type="button" onClick={() => setView("login")} className="mx-auto flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand hover:underline"><KeyRound className="h-3.5 w-3.5" /> Back to sign in</button>
          </form>
        )}
      </Card>
    </div>
  );
}
