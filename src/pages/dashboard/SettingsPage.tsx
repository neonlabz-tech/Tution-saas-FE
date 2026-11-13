import { useEffect, useRef, useState } from "react";
import { Building2, Check, ImagePlus, Mail, Monitor, Moon, Palette, Sun, Trash2, UserCog } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { ACCENTS, useTheme, type ThemeMode } from "@/hooks/useTheme";
import { authApi, settingsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const { mode, setMode, accent, setAccent } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [logo, setLogo] = useState<string | null>(null);
  const [inst, setInst] = useState({
    name: "Bright Future Institute",
    email: "hello@brightfuture.lk",
    phone: "0112345678",
    address: "42, Temple Road, Colombo 07",
    about: "A modern tuition institute for GCE Advanced Level and professional courses.",
  });
  const [profile, setProfile] = useState({
    name: user?.fullName ?? "Admin",
    email: user?.email ?? "",
    role: user?.role ? user.role.replace("_", " ") : "Administrator",
  });
  const [saving, setSaving] = useState<"institute" | "profile" | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    let active = true;
    settingsApi
      .get()
      .then((res) => {
        if (!active) return;
        setInst({
          name: res.institute.name,
          email: res.institute.email,
          phone: res.institute.phone,
          address: res.institute.address,
          about: res.institute.about,
        });
        setLogo(res.institute.logo);
        setProfile((prev) => ({
          ...prev,
          name: res.profile.fullName,
          email: res.profile.email,
          role: res.profile.role.replace("_", " "),
        }));
      })
      .catch(() => {
        /* fallback to current defaults if offline */
      });
    return () => {
      active = false;
    };
  }, []);

  const onLogo = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file (PNG, JPG, SVG).");
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB.");
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  };

  const saveInstitute = async () => {
    setSaving("institute");
    try {
      await settingsApi.updateInstitute({ ...inst, logo });
      toast.success("Institute profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save institute profile");
    } finally {
      setSaving(null);
    }
  };

  const handleModeChange = (nextMode: ThemeMode) => {
    setMode(nextMode);
    void settingsApi.updateAppearance({ mode: nextMode }).catch(() => {
      /* local theme still applies */
    });
  };

  const handleAccentChange = (nextAccent: "indigo" | "violet" | "teal" | "rose") => {
    setAccent(nextAccent);
    void settingsApi.updateAppearance({ accent: nextAccent }).catch(() => {
      /* local theme still applies */
    });
  };

  const saveProfile = async () => {
    setSaving("profile");
    try {
      await settingsApi.updateProfile({
        fullName: profile.name,
        email: profile.email,
      });
      await refreshUser();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(null);
    }
  };

  const handleSendResetLink = async () => {
    if (!profile.email) {
      toast.error("No email address found");
      return;
    }
    setSendingReset(true);
    try {
      const res = await authApi.forgotPassword({ email: profile.email.trim() });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setSendingReset(false);
    }
  };

  const modes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Institute profile, appearance and your account." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-brand" /> Institute profile</span>} subtitle="Shown on student QR cards and reports" />
          <div className="grid gap-6 p-5 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-surface-2">
                {logo ? <img src={logo} alt="Institute logo preview" className="h-full w-full object-contain" /> : <div className="text-center text-muted"><ImagePlus className="mx-auto h-8 w-8" /><p className="mt-1 text-[11px]">Logo preview</p></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <div className="flex gap-2">
                <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}><ImagePlus className="h-3.5 w-3.5" /> Upload</Button>
                {logo && <Button size="sm" variant="dangerSoft" onClick={() => setLogo(null)} aria-label="Remove logo"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
              <p className="text-center text-[11px] text-muted">PNG, JPG or SVG up to 2 MB.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institute name"><Input value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} /></Field>
              <Field label="Contact email"><Input type="email" value={inst.email} onChange={(e) => setInst({ ...inst, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={inst.phone} onChange={(e) => setInst({ ...inst, phone: e.target.value })} className="num" /></Field>
              <Field label="Address"><Input value={inst.address} onChange={(e) => setInst({ ...inst, address: e.target.value })} /></Field>
              <Field label="About" className="sm:col-span-2"><Textarea value={inst.about} onChange={(e) => setInst({ ...inst, about: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Button onClick={() => void saveInstitute()} disabled={saving === "institute"}>
                  {saving === "institute" ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Palette className="h-4 w-4 text-brand" /> Theme</span>} subtitle="Applied instantly and saved to your account" />
          <div className="space-y-6 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold">Mode</p>
              <div className="grid grid-cols-3 gap-3">
                {modes.map((m) => (
                  <button key={m.id} onClick={() => handleModeChange(m.id)} className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition", mode === m.id ? "border-primary bg-primary/10 text-brand" : "border-line text-muted hover:border-primary/40")}>
                    <m.icon className="h-5 w-5" />{m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold">Accent colour</p>
              <div className="flex flex-wrap gap-3">
                {ACCENTS.map((a) => (
                  <button key={a.id} onClick={() => handleAccentChange(a.id)} aria-label={a.label} className={cn("flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition", accent === a.id ? "border-primary bg-primary/10" : "border-line hover:border-primary/40")}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: a.color }}>{accent === a.id && <Check className="h-3 w-3" />}</span>{a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><UserCog className="h-4 w-4 text-brand" /> Profile</span>} subtitle="Your administrator account" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name} size="xl" />
              <div>
                <p className="font-heading text-lg font-bold">{profile.name}</p>
                <p className="text-sm capitalize text-muted">{profile.role}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            </div>
            <Button onClick={() => void saveProfile()} disabled={saving === "profile"}>
              {saving === "profile" ? "Updating..." : "Update profile"}
            </Button>

            <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Password Reset via Email</p>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => void handleSendResetLink()}
                  disabled={sendingReset}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {sendingReset ? "Sending..." : "Send reset link"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
