import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  return undefined;
}

export default function LoginPage() {
  const { user, config, loading, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in successfully");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="flex min-h-[480px] w-full max-w-[360px] flex-col justify-center px-7 py-12 shadow-pop sm:px-8 sm:py-14">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-secondary shadow-lg shadow-primary/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 8c3-3 5-3 8 0s5 3 8 0" />
                <path d="M4 15c3-3 5-3 8 0s5 3 8 0" opacity="0.65" />
              </svg>
            </div>
            <div>
              <p className="font-heading text-lg font-extrabold leading-tight">EduFlow</p>
              <p className="text-xs text-muted">{config?.instituteName ?? "Bright Future Institute"}</p>
            </div>
          </div>
          <h2 className="font-heading text-2xl font-extrabold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">
            Enter your email and password to access the dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <Field label="Email" error={errors.email}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() =>
                  setErrors((prev) => ({
                    ...prev,
                    email: validateEmail(email),
                  }))
                }
                placeholder="Enter your email"
                aria-invalid={Boolean(errors.email)}
                className={cn(
                  "pl-10",
                  errors.email && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15",
                )}
              />
            </div>
          </Field>

          <Field label="Password" error={errors.password}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() =>
                  setErrors((prev) => ({
                    ...prev,
                    password: validatePassword(password),
                  }))
                }
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                className={cn(
                  "pl-10 pr-10",
                  errors.password && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" className="w-full" disabled={submitting}>
            <LogIn className="h-4 w-4" />
            {submitting ? "Please wait..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
