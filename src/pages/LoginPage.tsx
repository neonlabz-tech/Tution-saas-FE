import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_EMAIL_KEY = "eduflow_remember_email";
const REMEMBER_ME_KEY = "eduflow_remember_me";

function encodeStored(value: string): string {
  try {
    return btoa(encodeURIComponent(value));
  } catch {
    return value;
  }
}

function decodeStored(value: string): string {
  try {
    return decodeURIComponent(atob(value));
  } catch {
    return value;
  }
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address";
  return undefined;
}

function validatePassword(value: string, minLength = 8): string | undefined {
  if (!value) return "Password is required";
  if (value.length < minLength) return `Password must be at least ${minLength} characters`;
  return undefined;
}

export default function LoginPage() {
  const { user, config, loading, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const minPasswordLen = config?.passwordMinLength ?? 8;

  // View state: strictly login or forgot password
  const [view, setView] = useState<"login" | "forgot">("login");

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string>("");

  useEffect(() => {
    if (!submitting) {
      setLoginNotice("");
      return;
    }
    const t1 = setTimeout(() => {
      setLoginNotice("Connecting to server...");
    }, 2500);
    const t2 = setTimeout(() => {
      setLoginNotice("Server is waking up from idle, please hold on...");
    }, 7000);
    const t3 = setTimeout(() => {
      setLoginNotice("Initial wake-up may take up to 40 seconds. Still communicating with server...");
    }, 15000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [submitting]);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | undefined>();
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | undefined>();

  // Restore remembered email on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
      const savedRemember = localStorage.getItem(REMEMBER_ME_KEY) === "true";
      if (savedRemember && savedEmail) {
        setEmail(decodeStored(savedEmail));
        setRememberMe(true);
      }
    }
  }, []);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Handle Login submission
  const onLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {
      email: validateEmail(email),
      password: validatePassword(password, minPasswordLen),
    };

    if (nextErrors.email || nextErrors.password) {
      setLoginErrors(nextErrors);
      return;
    }

    setLoginErrors({});
    setSubmitting(true);
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, encodeStored(email.trim()));
        localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      await login(email.trim(), password);
      toast.success("Signed in successfully");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Forgot Password submission
  const onForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(forgotEmail);
    if (err) {
      setForgotError(err);
      return;
    }
    setForgotError(undefined);
    setForgotSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: forgotEmail.trim() });
      toast.success(res.message);
      setForgotSent(true);
      if (res.devResetUrl) {
        const tokenMatch = res.devResetUrl.match(/token=([a-zA-Z0-9]+)/);
        const normalizedUrl = tokenMatch
          ? `${window.location.origin}/reset-password?token=${tokenMatch[1]}`
          : res.devResetUrl;
        setDevResetUrl(normalizedUrl);
      } else {
        setDevResetUrl(undefined);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const brandName = config?.instituteName || "Tuition Management System";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-3 sm:p-4 py-3 sm:py-6">
      <Card className="flex w-full max-w-[370px] flex-col justify-center px-6 py-6 sm:px-8 sm:py-8 shadow-pop my-auto">
        {/* Brand Header */}
        <div className="mb-5 text-center">
          <div className="mb-3 flex items-center justify-center gap-3 text-left">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary via-primary to-accent shadow-lg shadow-primary/30">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 sm:h-6 sm:w-6 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M4 8c3-3 5-3 8 0s5 3 8 0" />
                <path d="M4 15c3-3 5-3 8 0s5 3 8 0" opacity="0.65" />
              </svg>
            </div>
            <div>
              <p className="font-heading text-lg sm:text-xl font-extrabold leading-tight">EduFlow</p>
              <p className="text-xs text-muted">{brandName}</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted mb-1.5">
            <Shield className="h-3 w-3 text-brand" /> Admin Portal
          </div>

          <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-ink">
            {view === "login" ? "Welcome back" : "Reset Password"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {view === "login"
              ? "Enter your credentials to access the administrative dashboard."
              : "Enter your admin email to receive a password reset link."}
          </p>
        </div>

        {/* VIEW 1: FORGOT PASSWORD */}
        {view === "forgot" ? (
          forgotSent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#7D41AB]/15 text-[#7D41AB]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-base font-bold">Reset link sent!</p>
                <p className="mt-1 text-xs text-muted">
                  If <strong className="text-ink">{forgotEmail}</strong> is an active administrator of {brandName}, a password reset link has been dispatched.
                </p>
              </div>

              {devResetUrl && (
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-left">
                  <p className="text-[11px] font-semibold text-brand">Dev test link:</p>
                  <a href={devResetUrl} className="mt-1 block break-all text-xs text-brand underline">
                    Click to reset password
                  </a>
                </div>
              )}

              <Button
                variant="soft"
                className="w-full min-h-[40px]"
                onClick={() => {
                  setView("login");
                  setForgotSent(false);
                  setDevResetUrl(undefined);
                }}
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={onForgotSubmit} noValidate className="space-y-3.5">
              <Field label="Admin Email address" error={forgotError}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      if (forgotError) setForgotError(validateEmail(e.target.value));
                    }}
                    placeholder="admin@example.com"
                    aria-invalid={Boolean(forgotError)}
                    className={cn(
                      "pl-10",
                      forgotError && "border-[#4D1882] focus:border-[#4D1882] focus:ring-[#4D1882]/15",
                    )}
                  />
                </div>
              </Field>

              <Button type="submit" className="w-full min-h-[40px]" disabled={forgotSubmitting}>
                <KeyRound className="h-4 w-4" />
                {forgotSubmitting ? "Sending link..." : "Send reset link"}
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setForgotError(undefined);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] py-1 text-xs font-semibold text-muted hover:text-ink transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
              </div>
            </form>
          )
        ) : (
          /* VIEW 2: SIGN IN */
          <form onSubmit={onLoginSubmit} noValidate className="space-y-3.5">
            <Field label="Email" error={loginErrors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (loginErrors.email) setLoginErrors((p) => ({ ...p, email: validateEmail(e.target.value) }));
                  }}
                  placeholder="admin@example.com"
                  aria-invalid={Boolean(loginErrors.email)}
                  className={cn("pl-10", loginErrors.email && "border-[#4D1882] focus:border-[#4D1882]")}
                />
              </div>
            </Field>

            <Field label="Password" error={loginErrors.password}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginErrors.password) {
                      setLoginErrors((p) => ({ ...p, password: validatePassword(e.target.value, minPasswordLen) }));
                    }
                  }}
                  placeholder="Enter password"
                  aria-invalid={Boolean(loginErrors.password)}
                  className={cn("pl-10 pr-10", loginErrors.password && "border-[#4D1882] focus:border-[#4D1882]")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted hover:text-ink min-h-[36px] py-1">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-primary focus:ring-primary/20"
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setView("forgot");
                    setForgotEmail(email);
                    setForgotError(undefined);
                    setForgotSent(false);
                  }}
                  className="min-h-[36px] py-1 text-xs font-semibold text-brand hover:underline inline-flex items-center"
                >
                  Forgot password?
                </button>
              </div>
            </Field>

            <Button type="submit" className="w-full mt-1.5 min-h-[42px]" disabled={submitting}>
              <LogIn className="h-4 w-4" />
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            {submitting && loginNotice && (
              <p className="mt-2 text-center text-xs text-muted animate-pulse">
                {loginNotice}
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
