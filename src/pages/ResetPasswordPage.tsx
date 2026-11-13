import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const toast = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters long";
    return undefined;
  };

  const validateConfirmPassword = (val: string, pwdVal: string) => {
    if (!val) return "Please confirm your password";
    if (val !== pwdVal) return "Passwords do not match";
    return undefined;
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
    if (confirmPassword && errors.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(confirmPassword, val),
      }));
    }
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (errors.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(val, password),
      }));
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid or missing password reset token");
      return;
    }

    const nextErrors: FormErrors = {
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };

    if (nextErrors.password || nextErrors.confirmPassword) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        token,
        newPassword: password,
      });
      toast.success(res.message);
      setSuccess(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="flex min-h-[480px] w-full max-w-[380px] flex-col justify-center px-7 py-12 shadow-pop sm:px-8 sm:py-14">
        {/* Header branding */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-secondary shadow-lg shadow-primary/30">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-white"
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
              <p className="font-heading text-lg font-extrabold leading-tight">EduFlow</p>
              <p className="text-xs text-muted">Admin Security</p>
            </div>
          </div>

          <h2 className="font-heading text-2xl font-extrabold">
            {success ? "Password Reset" : "Reset Password"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {success
              ? "Your password has been successfully updated."
              : "Enter and confirm your new password below."}
          </p>
        </div>

        {!token && !success ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-heading text-base font-bold">Invalid or missing reset token</p>
              <p className="mt-1 text-xs text-muted">
                The password reset link is invalid or may have expired. Please request a new link from the login page.
              </p>
            </div>
            <Link to="/login" className="inline-block w-full">
              <Button variant="soft" className="w-full">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="font-heading text-base font-bold">All set!</p>
              <p className="mt-1 text-xs text-muted">
                Your new password has been saved. You can now use it to sign in to the dashboard.
              </p>
            </div>
            <Button onClick={() => navigate("/login")} className="w-full">
              <ShieldCheck className="h-4 w-4" /> Sign in with new password
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <Field label="New Password" error={errors.password}>
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
                  placeholder="At least 8 characters"
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

            <Field label="Confirm New Password" error={errors.confirmPassword}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: validateConfirmPassword(confirmPassword, password),
                    }))
                  }
                  placeholder="Re-type your password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className={cn(
                    "pl-10 pr-10",
                    errors.confirmPassword && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" className="w-full" disabled={submitting}>
              <ShieldCheck className="h-4 w-4" />
              {submitting ? "Updating password..." : "Set new password"}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
