import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  IdCard,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  User,
  UserPlus,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  MultiSelect,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  AuthLink,
  AuthShell,
  FormAlert,
  PasswordInput,
  PasswordRules,
  inputErr,
} from "@/components/student/AuthParts";
import { listBatches } from "@/api/batches";
import { listModules } from "@/api/modules";
import type { Module } from "@/types";

const ALLOWED_NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey || ALLOWED_NAV_KEYS.has(e.key)) return;
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

function sanitizePhone(val: string): string {
  return val.replace(/\D/g, "").slice(0, 10);
}

export default function StudentRegisterPage() {
  const { account, loading, register } = useStudentAuth();
  const toast = useToast();

  const [batches, setBatches] = useState<string[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [batch, setBatch] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    studentId?: string;
    message: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listBatches().catch(() => []),
      listModules().catch(() => []),
    ]).then(([batchList, moduleList]) => {
      if (!active) return;
      const bNames = (batchList || [])
        .filter((b) => b.status === "active" || !b.status)
        .map((b) => b.name);
      setBatches(bNames);
      setModules(moduleList || []);
      setLoadingOptions(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!loading && account) return <Navigate to="/student" replace />;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      errs.fullName = "Full name must be at least 3 characters";
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      errs.email = "Enter a valid email address";
    }
    if (!/^0\d{9}$/.test(phone.trim())) {
      errs.phone = "Phone must be 10 digits starting with 0 (e.g. 0771234567)";
    }
    if (!dob) {
      errs.dob = "Date of birth is required";
    }
    if (!address.trim() || address.trim().length < 5) {
      errs.address = "Address must be at least 5 characters";
    }
    if (!guardianName.trim() || guardianName.trim().length < 3) {
      errs.guardianName = "Guardian name is required";
    }
    if (!/^0\d{9}$/.test(guardianPhone.trim())) {
      errs.guardianPhone = "Guardian phone must be 10 digits starting with 0";
    }
    if (!batch.trim()) {
      errs.batch = "Please select a batch";
    }
    if (!moduleIds || moduleIds.length === 0) {
      errs.moduleIds = "Select at least one module";
    }
    if (!password || password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dob,
        address: address.trim(),
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        batch: batch.trim(),
        moduleIds,
        password,
      });

      setSubmittedData({
        message: res.message,
        email: email.trim(),
      });
      toast.success("Registration submitted successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedData) {
    return (
      <AuthShell
        title="Registration Received!"
        subtitle="Your account is pending administrator verification"
        footer={
          <Link
            to="/student/login"
            className="font-semibold text-brand hover:underline"
          >
            ← Back to Student Sign In
          </Link>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-amber-500/10 p-6 text-center text-amber-600 dark:text-amber-400">
            <Clock className="mb-2 h-10 w-10 animate-pulse text-amber-500" />
            <h3 className="font-heading text-base font-bold text-ink">
              Pending Admin Verification
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {submittedData.message}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/60 p-4 text-xs text-muted space-y-2">
            <p className="font-semibold text-ink">What happens next?</p>
            <p>
              1. The tuition administration has been notified of your registration.
            </p>
            <p>
              2. Once your details and selected modules are verified, you will receive an approval email at{" "}
              <strong className="text-ink">{submittedData.email}</strong>.
            </p>
            <p>
              3. You can then sign in directly with your email and the password you set.
            </p>
          </div>

          <Link to="/student/login">
            <Button className="w-full">Go to Sign in</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  const iconClass = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted";

  return (
    <AuthShell
      wide
      title="Create Student Account"
      subtitle="Fill in your student enrolment information to register for your student portal."
      footer={
        <>
          Already registered? <AuthLink to="/student/login">Sign in here</AuthLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <Field label="Full name" error={errors.fullName}>
          <div className="relative">
            <User className={iconClass} />
            <Input
              autoComplete="name"
              placeholder="e.g. Nimal Perera"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`pl-10 ${inputErr(errors.fullName)}`}
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" error={errors.email}>
            <div className="relative">
              <Mail className={iconClass} />
              <Input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`pl-10 ${inputErr(errors.email)}`}
              />
            </div>
          </Field>

          <Field label="Mobile phone" error={errors.phone}>
            <div className="relative">
              <Phone className={iconClass} />
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                onKeyDown={handlePhoneKeyDown}
                placeholder="0771234567"
                value={phone}
                onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                className={`num pl-10 ${inputErr(errors.phone)}`}
              />
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" error={errors.dob}>
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputErr(errors.dob)}
            />
          </Field>

          <Field label="Batch" error={errors.batch}>
            <Select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className={inputErr(errors.batch)}
            >
              <option value="">Select your batch</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Address" error={errors.address}>
          <Textarea
            placeholder="Street address, city"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`min-h-[64px] ${inputErr(errors.address)}`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Guardian name" error={errors.guardianName}>
            <Input
              placeholder="Parent / Guardian name"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className={inputErr(errors.guardianName)}
            />
          </Field>

          <Field label="Guardian phone" error={errors.guardianPhone}>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              onKeyDown={handlePhoneKeyDown}
              placeholder="0712345678"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(sanitizePhone(e.target.value))}
              className={`num ${inputErr(errors.guardianPhone)}`}
            />
          </Field>
        </div>

        <Field
          label="Registered modules"
          error={errors.moduleIds}
          hint="Select the subjects/modules you are enrolling in"
        >
          {loadingOptions ? (
            <p className="text-xs text-muted">Loading available modules…</p>
          ) : (
            <MultiSelect
              value={moduleIds}
              onChange={setModuleIds}
              options={modules.map((m) => ({
                value: m.id,
                label: `${m.code} — ${m.name}`,
              }))}
            />
          )}
        </Field>

        <div className="border-t border-line pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Create Portal Password
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Choose password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={Boolean(errors.password)}
              />
            </Field>

            <Field label="Confirm password" error={errors.confirmPassword}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                invalid={Boolean(errors.confirmPassword)}
              />
            </Field>
          </div>
          <PasswordRules value={password} />
        </div>

        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={submitting || loadingOptions}
        >
          <UserPlus className="h-4 w-4" />
          {submitting ? "Submitting Registration…" : "Submit Registration"}
        </Button>
      </form>
    </AuthShell>
  );
}
