import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { IdCard, Mail, Phone, User, UserPlus } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { AuthLink, AuthShell, FormAlert, PasswordInput, PasswordRules, inputErr } from "@/components/student/AuthParts";
import { hasErrors, vConfirm, vEmail, vName, vNewPassword, vPhone, vStudentId } from "@/lib/studentValidation";

const EMPTY = { fullName: "", email: "", phone: "", studentId: "", password: "", confirm: "" };
type Form = typeof EMPTY;
type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  return { fullName: vName(f.fullName), email: vEmail(f.email), phone: vPhone(f.phone), studentId: vStudentId(f.studentId), password: vNewPassword(f.password), confirm: vConfirm(f.password, f.confirm) };
}

export default function StudentRegisterPage() {
  const { account, loading, register } = useStudentAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && account) return <Navigate to="/student" replace />;

  const set = (k: keyof Form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (touched[k] || errors[k]) {
      const all = validate(next);
      setErrors((p) => ({ ...p, [k]: all[k], ...(k === "password" && touched.confirm ? { confirm: all.confirm } : {}) }));
    }
  };
  const blur = (k: keyof Form) => {
    setTouched((p) => ({ ...p, [k]: true }));
    setErrors((p) => ({ ...p, [k]: validate(form)[k] }));
  };
  const bind = (k: keyof Form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value), onBlur: () => blur(k), "aria-invalid": Boolean(errors[k]) });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSubmitting(true);
    try {
      await register({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password, studentId: form.studentId });
      toast.success("Account created. Welcome to EduFlow!");
      navigate("/student", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const icon = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted";
  return (
    <AuthShell
      wide
      title="Create your student account"
      subtitle="Use your enrolment details so we can show your modules and payments."
      footer={
        <>
          Already registered? <AuthLink to="/student/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <Field label="Full name" error={errors.fullName}>
          <div className="relative">
            <User className={icon} />
            <Input autoComplete="name" placeholder="As on your enrolment form" className={`pl-10 ${inputErr(errors.fullName)}`} {...bind("fullName")} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email}>
            <div className="relative">
              <Mail className={icon} />
              <Input type="email" autoComplete="email" placeholder="you@example.com" className={`pl-10 ${inputErr(errors.email)}`} {...bind("email")} />
            </div>
          </Field>
          <Field label="Mobile number" error={errors.phone}>
            <div className="relative">
              <Phone className={icon} />
              <Input type="tel" autoComplete="tel" placeholder="0771234567" className={`pl-10 ${inputErr(errors.phone)}`} {...bind("phone")} />
            </div>
          </Field>
        </div>

        <Field label="Student ID (optional)" error={errors.studentId} hint="Printed on your enrolment card, e.g. STU-2025-001. Leave blank if the institute has your email on file.">
          <div className="relative">
            <IdCard className={icon} />
            <Input placeholder="STU-2025-001" className={`num pl-10 ${inputErr(errors.studentId)}`} {...bind("studentId")} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password}>
            <PasswordInput autoComplete="new-password" placeholder="Password" invalid={Boolean(errors.password)} {...bind("password")} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <PasswordInput autoComplete="new-password" placeholder="Confirm" invalid={Boolean(errors.confirm)} {...bind("confirm")} />
          </Field>
        </div>
        <PasswordRules value={form.password} />

        <Button type="submit" className="w-full" disabled={submitting}>
          <UserPlus className="h-4 w-4" />
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
