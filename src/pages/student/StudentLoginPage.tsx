import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Mail } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { AuthLink, AuthShell, FormAlert, PasswordInput, inputErr } from "@/components/student/AuthParts";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/studentApi";
import { hasErrors, vEmail, vLoginPassword } from "@/lib/studentValidation";

export default function StudentLoginPage() {
  const { account, loading, login } = useStudentAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { from?: string; notice?: string };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && account) return <Navigate to={state.from ?? "/student"} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { email: vEmail(email), password: vLoginPassword(password) };
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Signed in successfully");
      navigate(state.from ?? "/student", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your classes, assignments and payments."
      footer={
        <>
          New to EduFlow? <AuthLink to="/student/register">Create a student account</AuthLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {state.notice && <FormAlert tone="success">{state.notice}</FormAlert>}
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <Field label="Email" error={errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: vEmail(e.target.value) }));
              }}
              onBlur={() => setErrors((p) => ({ ...p, email: vEmail(email) }))}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              className={`pl-10 ${inputErr(errors.email)}`}
            />
          </div>
        </Field>

        <Field label="Password" error={errors.password}>
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((p) => ({ ...p, password: vLoginPassword(e.target.value) }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, password: vLoginPassword(password) }))}
            placeholder="Enter your password"
            invalid={Boolean(errors.password)}
          />
        </Field>

        <div className="-mt-2 text-right text-xs">
          <Link to="/student/forgot-password" className="font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          <LogIn className="h-4 w-4" />
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-3 text-xs text-muted">
          <p className="font-semibold text-ink">Demo account</p>
          <p className="num mt-1">{DEMO_EMAIL} · {DEMO_PASSWORD}</p>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
              setErrors({});
              setFormError(null);
            }}
            className="mt-2 cursor-pointer font-semibold text-brand hover:underline"
          >
            Fill demo credentials
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
