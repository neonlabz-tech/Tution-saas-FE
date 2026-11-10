import { useRef, useState } from "react";
import { Bell, Building2, Check, ImagePlus, Monitor, Moon, Palette, Sun, Trash2, UserCog } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Field, Input, MockNote, PageHeader, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ACCENTS, useTheme, type ThemeMode } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const NOTIFS = [
  { id: "payments", label: "Payment received", hint: "Alert when a student payment is recorded" },
  { id: "overdue", label: "Overdue balances", hint: "Weekly digest of outstanding fees" },
  { id: "absence", label: "Student absences", hint: "Notify when a student misses 3 classes in a row" },
  { id: "classes", label: "Class reminders", hint: "30 minutes before each online class" },
  { id: "notices", label: "Notice expiry", hint: "When a notice is about to expire" },
];

export default function SettingsPage() {
  const toast = useToast();
  const { mode, setMode, accent, setAccent } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [inst, setInst] = useState({ name: "Bright Future Institute", email: "hello@brightfuture.lk", phone: "0112345678", address: "42, Temple Road, Colombo 07", about: "A modern tuition institute for GCE Advanced Level and professional courses." });
  const [profile, setProfile] = useState({ name: "Amara Perera", email: "amara@brightfuture.lk", role: "Administrator" });
  const [notif, setNotif] = useState<Record<string, boolean>>({ payments: true, overdue: true, absence: false, classes: true, notices: false });
  const [channels, setChannels] = useState({ email: true, push: true, sms: false });

  const onLogo = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file (PNG, JPG, SVG).");
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB.");
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  };
  const save = (what: string) => toast.success(`${what} saved locally (demo — not persisted to a backend)`);

  const modes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "System", icon: Monitor }];

  return (
    <>
      <PageHeader title="Settings" description="Institute profile, appearance, notifications and your account." />
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
              <p className="text-center text-[11px] text-muted">PNG, JPG or SVG up to 2 MB. Preview only.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institute name"><Input value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} /></Field>
              <Field label="Contact email"><Input type="email" value={inst.email} onChange={(e) => setInst({ ...inst, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={inst.phone} onChange={(e) => setInst({ ...inst, phone: e.target.value })} className="num" /></Field>
              <Field label="Address"><Input value={inst.address} onChange={(e) => setInst({ ...inst, address: e.target.value })} /></Field>
              <Field label="About" className="sm:col-span-2"><Textarea value={inst.about} onChange={(e) => setInst({ ...inst, about: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Button onClick={() => save("Institute profile")}>Save profile</Button></div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Palette className="h-4 w-4 text-brand" /> Theme</span>} subtitle="Applied instantly and remembered on this device" />
          <div className="space-y-6 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold">Mode</p>
              <div className="grid grid-cols-3 gap-3">
                {modes.map((m) => (
                  <button key={m.id} onClick={() => setMode(m.id)} className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition", mode === m.id ? "border-primary bg-primary/10 text-brand" : "border-line text-muted hover:border-primary/40")}>
                    <m.icon className="h-5 w-5" />{m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold">Accent colour</p>
              <div className="flex flex-wrap gap-3">
                {ACCENTS.map((a) => (
                  <button key={a.id} onClick={() => setAccent(a.id)} aria-label={a.label} className={cn("flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition", accent === a.id ? "border-primary bg-primary/10" : "border-line hover:border-primary/40")}>
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
            <div className="flex items-center gap-4"><Avatar name={profile.name} size="xl" /><div><p className="font-heading text-lg font-bold">{profile.name}</p><p className="text-sm text-muted">{profile.role}</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
              <Field label="New password" hint="UI only"><Input type="password" placeholder="••••••••" /></Field>
              <Field label="Confirm password"><Input type="password" placeholder="••••••••" /></Field>
            </div>
            <Button onClick={() => save("Profile")}>Update profile</Button>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /> Notification preferences</span>} subtitle="Choose what you want to be alerted about" />
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
            <div className="divide-y divide-line/70 rounded-2xl border border-line">
              {NOTIFS.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div><p className="text-sm font-semibold">{n.label}</p><p className="text-xs text-muted">{n.hint}</p></div>
                  <Switch checked={notif[n.id]} onChange={(v) => setNotif({ ...notif, [n.id]: v })} label={n.label} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold">Channels</p>
              {(["email", "push", "sms"] as const).map((c) => (
                <div key={c} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3"><span className="text-sm font-semibold capitalize">{c === "sms" ? "SMS" : c}</span><Switch checked={channels[c]} onChange={(v) => setChannels({ ...channels, [c]: v })} label={c} /></div>
              ))}
              <Button className="w-full" onClick={() => save("Notification preferences")}>Save preferences</Button>
              <MockNote>Frontend UI only. No account or backend configuration is changed.</MockNote>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
