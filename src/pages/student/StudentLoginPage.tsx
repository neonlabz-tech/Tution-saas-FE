import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, LogIn, Mail } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { studentAuthApi } from "@/lib/studentApi";
import { AuthLink, AuthShell, FormAlert, PasswordInput, PasswordRules, inputErr } from "@/components/student/AuthParts";
import { hasErrors, vConfirm, vEmail, vLoginPassword, vNewPassword } from "@/lib/studentValidation";

export default function StudentLoginPage() {
  const { account, loading, login, updatePassword } = useStudentAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { from?: string; notice?: string };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const isFirstLogin = params.get("firstLogin") === "true";
    if (emailParam) {
      setEmail(emailParam);
    }
    if (isFirstLogin) {
      setIsChangingPassword(true);
    }
  }, [location.search]);

  const checkEmailStatus = async (enteredEmail: string) => {
    const clean = enteredEmail.trim();
    if (!clean || vEmail(clean)) return;
    try {
      const res = await studentAuthApi.checkAccount(clean);
      if (res.exists && res.mustChangePassword) {
        setIsChangingPassword(true);
      }
    } catch {
      /* ignore */
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {
      email: vEmail(email),
      password: vLoginPassword(password),
    };

    if (isChangingPassword) {
      next.newPassword = vNewPassword(newPassword);
      next.confirmPassword = vConfirm(newPassword, confirmPassword);
    }

    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;

    setSubmitting(true);
    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();

      if (isChangingPassword) {
        // If already authenticated with temporary password in session, update directly; otherwise login with newPassword
        if (account?.mustChangePassword) {
          await updatePassword(newPassword.trim());
        } else {
          await login(cleanEmail, cleanPassword, newPassword.trim());
        }
        toast.success("Password updated and signed in successfully!");
        navigate(state.from ?? "/student", { replace: true });
      } else {
        const logged = await login(cleanEmail, cleanPassword);
        if (logged.mustChangePassword) {
          setIsChangingPassword(true);
          return;
        }
        toast.success("Signed in successfully");
        navigate(state.from ?? "/student", { replace: true });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={isChangingPassword ? "Set personal password" : "Welcome back"}
      subtitle={
        isChangingPassword
          ? "You are signing in with a temporary password created by admin. Choose your personal password below."
          : "Sign in to your student portal to access your classes and modules."
      }
      footer={
        <>
          New to the student portal? <AuthLink to="/student/register">Register as a student</AuthLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {state.notice && <FormAlert tone="success">{state.notice}</FormAlert>}
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <Field label="Email address" error={errors.email}>
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
              onBlur={() => {
                setErrors((p) => ({ ...p, email: vEmail(email) }));
                void checkEmailStatus(email);
              }}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              className={`pl-10 ${inputErr(errors.email)}`}
            />
          </div>
        </Field>

        <Field
          label={isChangingPassword ? "Temporary / Current password" : "Password"}
          error={errors.password}
        >
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((p) => ({ ...p, password: vLoginPassword(e.target.value) }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, password: vLoginPassword(password) }))}
            placeholder={isChangingPassword ? "Enter password received via email" : "Enter your password"}
            invalid={Boolean(errors.password)}
          />
        </Field>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted hover:text-ink">
            <input
              type="checkbox"
              checked={isChangingPassword}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsChangingPassword(checked);
                setFormError(null);
                if (!checked) {
                  setNewPassword("");
                  setConfirmPassword("");
                }
              }}
              className="h-3.5 w-3.5 rounded border-line text-brand focus:ring-brand/20"
            />
            <span>Change password</span>
          </label>
          <Link to="/student/forgot-password" className="text-xs font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        {isChangingPassword && (
          <div className="space-y-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 pt-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Set Your Personal Password</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setFormError(null);
                }}
                className="text-xs text-muted hover:text-ink underline"
              >
                Cancel
              </button>
            </div>

            <Field label="New password" error={errors.newPassword}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Choose a new password"
                value={newPassword}
                invalid={Boolean(errors.newPassword)}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: vNewPassword(e.target.value) }));
                }}
                onBlur={() => setErrors((p) => ({ ...p, newPassword: vNewPassword(newPassword) }))}
              />
              <PasswordRules value={newPassword} />
            </Field>

            <Field label="Confirm new password" error={errors.confirmPassword}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirmPassword}
                invalid={Boolean(errors.confirmPassword)}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors((p) => ({ ...p, confirmPassword: vConfirm(newPassword, e.target.value) }));
                  }
                }}
                onBlur={() => setErrors((p) => ({ ...p, confirmPassword: vConfirm(newPassword, confirmPassword) }))}
              />
            </Field>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {isChangingPassword ? <KeyRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {submitting
            ? isChangingPassword
              ? "Updating password…"
              : "Signing in…"
            : isChangingPassword
            ? "Update Password & Sign In"
            : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
