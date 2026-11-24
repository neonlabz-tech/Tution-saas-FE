import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button, Field } from "@/components/ui/primitives";
import { AuthShell, FormAlert, PasswordInput, PasswordRules } from "@/components/student/AuthParts";
import { studentAuthApi } from "@/lib/studentApi";
import { hasErrors, vConfirm, vNewPassword } from "@/lib/studentValidation";

export default function StudentResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setStatus("invalid");
      return;
    }
    studentAuthApi
      .validateResetToken(token)
      .then((ok) => active && setStatus(ok ? "valid" : "invalid"))
      .catch(() => active && setStatus("invalid"));
    return () => {
      active = false;
    };
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { password: vNewPassword(password), confirm: vConfirm(password, confirm) };
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSubmitting(true);
    try {
      await studentAuthApi.resetPassword(token, password);
      navigate("/student/login", { replace: true, state: { notice: "Your password has been updated. Sign in with your new password." } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not reset your password.");
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={
        <Link to="/student/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {status === "checking" && <p className="py-6 text-center text-sm text-muted">Checking your reset link…</p>}
      {status === "invalid" && (
        <div className="space-y-4">
          <FormAlert tone="error">This reset link is missing, invalid or has expired.</FormAlert>
          <Link to="/student/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </div>
      )}
      {status === "valid" && (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <Field label="New password" error={errors.password}>
            <PasswordInput
              autoComplete="new-password"
              placeholder="Create a new password"
              value={password}
              invalid={Boolean(errors.password)}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: vNewPassword(e.target.value) }));
              }}
              onBlur={() => setErrors((p) => ({ ...p, password: vNewPassword(password) }))}
            />
            <PasswordRules value={password} />
          </Field>
          <Field label="Confirm new password" error={errors.confirm}>
            <PasswordInput
              autoComplete="new-password"
              placeholder="Repeat the new password"
              value={confirm}
              invalid={Boolean(errors.confirm)}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errors.confirm) setErrors((p) => ({ ...p, confirm: vConfirm(password, e.target.value) }));
              }}
              onBlur={() => setErrors((p) => ({ ...p, confirm: vConfirm(password, confirm) }))}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            <KeyRound className="h-4 w-4" />
            {submitting ? "Updating…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
