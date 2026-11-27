import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { AuthShell, FormAlert, inputErr } from "@/components/student/AuthParts";
import { studentAuthApi } from "@/lib/studentApi";
import { vEmail } from "@/lib/studentValidation";

export default function StudentForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ message?: string; devResetUrl?: string; demoResetLink?: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = vEmail(email);
    setError(err);
    setFormError(null);
    if (err) return;
    setSubmitting(true);
    try {
      const res = await studentAuthApi.forgotPassword(email);
      setSent(res);
    } catch {
      setFormError("We couldn't send the reset link. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a link to reset it."
      footer={
        <Link to="/student/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <FormAlert tone="success">
            {sent.message || `If an account exists for ${email.trim()}, a password reset link is on its way. The link expires in 1 hour.`}
          </FormAlert>
          {(sent.devResetUrl || sent.demoResetLink) && (
            <FormAlert tone="info">
              <p className="font-semibold">Dev preview (reset link generated):</p>
              <Link to={sent.devResetUrl || sent.demoResetLink || "#"} className="mt-2 inline-block font-semibold underline">
                Open reset password page →
              </Link>
            </FormAlert>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setSent(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <Field label="Email" error={error}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(vEmail(e.target.value));
                }}
                onBlur={() => setError(vEmail(email))}
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                className={`pl-10 ${inputErr(error)}`}
              />
            </div>
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            <Send className="h-4 w-4" />
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
