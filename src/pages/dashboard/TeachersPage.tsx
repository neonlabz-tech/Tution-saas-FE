import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, CalendarClock, Clock, Mail, Pencil, Phone, Plus, Trash2, Users, Video } from "lucide-react";
import type { Teacher } from "@/types";
import { Avatar, Badge, Button, Card, EmptyState, InfoRow, PageHeader, SearchInput, Select, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { TeacherFormModal } from "@/components/teachers/TeacherFormModal";
import { teachersApi, type TeacherListItem, type TeacherProfileResponse } from "@/lib/api";
import { fmtDate, fmtTime, todayISO } from "@/lib/utils";

const HOURS_PER_MODULE = 3;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TeachersPage() {
  const { teachers, teacherMetrics, teacherModules, modules, students, classes, deleteTeacher } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [moduleId, setModuleId] = useState("all");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<{ open: boolean; item: Teacher | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TeacherProfileResponse | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setForm({ open: true, item: null });
      setParams({}, { replace: true });
    } else if (params.get("q")) setQ(params.get("q")!);
  }, [params, setParams]);

  useEffect(() => {
    if (!detailId) {
      setProfile(null);
      return;
    }
    let active = true;
    teachersApi
      .get(detailId)
      .then((res) => {
        if (active) setProfile(res);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [detailId, teachers]);

  const workload = (t: TeacherListItem) => {
    if (t.assignedModules?.length && t.workload) {
      return {
        mods: t.assignedModules.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          studentCount: m.studentCount,
        })),
        students: t.workload.studentsCount,
        hours: t.workload.hoursPerWeek,
      };
    }
    const mods = teacherModules(t.id);
    const studentSet = new Set(students.filter((s) => s.moduleIds.some((id) => mods.some((m) => m.id === id))).map((s) => s.id));
    return {
      mods: mods.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        studentCount: students.filter((s) => s.moduleIds.includes(m.id)).length,
      })),
      students: studentSet.size,
      hours: mods.length * HOURS_PER_MODULE,
    };
  };

  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    return teachers.filter(
      (t) =>
        (!s || t.fullName.toLowerCase().includes(s) || t.specialization.toLowerCase().includes(s) || t.id.toLowerCase().includes(s)) &&
        (moduleId === "all" || t.assignedModules?.some((m) => m.id === moduleId) || modules.find((m) => m.id === moduleId)?.teacherId === t.id) &&
        (batch === "all" || t.batches.includes(batch)) &&
        (status === "all" || t.status === status),
    );
  }, [teachers, modules, q, moduleId, batch, status]);

  const totalHours = teacherMetrics.weeklyTeachingHours;
  const active = teacherMetrics.activeTeachers;
  const teachersWithoutModules = teacherMetrics.teachersWithoutModules;
  const detail = profile ?? (detailId ? teachers.find((t) => t.id === detailId) : undefined);
  const dw = detail ? workload(detail) : null;
  const schedule = useMemo(() => {
    if (profile?.upcomingSchedule) return profile.upcomingSchedule;
    if (!detail) return [];
    const today = todayISO();
    return classes.filter((c) => c.teacherId === detail.id && c.start.slice(0, 10) >= today && c.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);
  }, [profile, classes, detail]);
  const delT = delId ? teachers.find((t) => t.id === delId) : undefined;

  return (
    <>
      <PageHeader title="Teachers" description="Manage faculty, module assignments and teaching workload." actions={<Button onClick={() => setForm({ open: true, item: null })}><Plus className="h-4 w-4" /> Add teacher</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total teachers", v: teacherMetrics.totalTeachers, i: Users, c: "from-indigo-500 to-violet-500" },
          { l: "Active now", v: active, i: Clock, c: "from-teal-500 to-emerald-500" },
          { l: "Weekly teaching hours", v: totalHours, i: CalendarClock, c: "from-amber-500 to-orange-500" },
          { l: "Teachers without modules", v: teachersWithoutModules, i: BookOpen, c: "from-rose-500 to-pink-500" },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-4 p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${k.c}`}><k.i className="h-5 w-5" /></div>
            <div><p className="num text-2xl font-bold leading-none">{k.v}</p><p className="mt-1 text-xs text-muted">{k.l}</p></div>
          </Card>
        ))}
      </div>

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput placeholder="Search name, ID, subject…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)} aria-label="Filter by module">
          <option value="all">All modules</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Filter by batch">
          <option value="all">All batches</option>
          {BATCHES.map((b) => <option key={b}>{b}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on-leave">On leave</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Card>

      {data.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No teachers found" text="Try changing your filters or add a new teacher." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((t, i) => {
            const w = workload(t);
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <Card className="group h-full cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop" >
                  <div onClick={() => setDetailId(t.id)} className="h-full">
                    <div className="flex items-start gap-3">
                      <Avatar name={t.fullName} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-heading text-base font-bold">{t.fullName}</h3>
                        <p className="truncate text-xs text-muted">{t.specialization || "—"}</p>
                        <p className="num mt-1 text-[11px] text-muted">{t.id}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {w.mods.length ? w.mods.map((m) => <Badge key={m.id} tone="primary">{m.name}</Badge>) : <Badge>No modules assigned</Badge>}
                      {t.batches.map((b) => <Badge key={b} tone="teal">{b}</Badge>)}
                    </div>
                    <div className="mt-5 rounded-2xl bg-surface-2/70 p-3.5">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div><p className="num text-lg font-bold">{w.mods.length}</p><p className="text-[11px] text-muted">Modules</p></div>
                        <div><p className="num text-lg font-bold">{t.batches.length}</p><p className="text-[11px] text-muted">Batches</p></div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-muted">Joined {fmtDate(t.joiningDate)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ open: true, item: t })}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <TeacherFormModal open={form.open} item={form.item} onClose={() => setForm((f) => ({ ...f, open: false }))} />

      <Drawer open={!!detail} onClose={() => setDetailId(null)} title="Teacher profile" description={detail?.id}>
        {detail && dw && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={detail.fullName} size="xl" />
              <div className="min-w-0">
                <h3 className="font-heading text-xl font-extrabold">{detail.fullName}</h3>
                <p className="text-sm text-muted">{detail.qualification || "—"}</p>
                <div className="mt-2"><StatusBadge status={detail.status} /></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="soft" onClick={() => { setForm({ open: true, item: detail }); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="dangerSoft" onClick={() => setDelId(detail.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <InfoRow label="Email"><span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted" />{detail.email}</span></InfoRow>
              <InfoRow label="Phone"><span className="num inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted" />{detail.phone}</span></InfoRow>
              <InfoRow label="Specialization">{detail.specialization || "—"}</InfoRow>
              <InfoRow label="Joined">{fmtDate(detail.joiningDate)}</InfoRow>
              <InfoRow label="Batches"><span className="flex flex-wrap justify-end gap-1">{detail.batches.length ? detail.batches.map((b) => <Badge key={b} tone="teal">{b}</Badge>) : <span className="text-muted">—</span>}</span></InfoRow>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["Modules", dw.mods.length], ["Batches", detail.batches.length], ["Hours / wk", dw.hours]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl bg-surface-2 p-3 text-center"><p className="num text-xl font-bold">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
              ))}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Assigned modules</h4>
              <div className="space-y-2">
                {dw.mods.length === 0 && <p className="text-sm text-muted">No modules assigned yet.</p>}
                {dw.mods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
                    <div><p className="text-sm font-semibold">{m.name}</p><p className="num text-[11px] text-muted">{m.code}</p></div>
                    <Badge tone="primary">{m.studentCount} students</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Upcoming class schedule</h4>
              {schedule.length === 0 ? (
                <p className="text-sm text-muted">No upcoming online classes.</p>
              ) : (
                <div className="divide-y divide-line/70 rounded-2xl border border-line">
                  {schedule.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-12 shrink-0 rounded-xl bg-primary/10 py-1.5 text-center text-brand">
                        <p className="text-[10px] font-bold uppercase">{WEEKDAY[new Date(c.start).getDay()]}</p>
                        <p className="num text-sm font-bold">{c.start.slice(8, 10)}</p>
                      </div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.title}</p><p className="text-[11px] text-muted">{fmtTime(c.start)} – {fmtTime(c.end)} · {c.batch}</p></div>
                      <Video className="h-4 w-4 text-muted" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!delT}
        onClose={() => setDelId(null)}
        title="Delete teacher?"
        text={<>Removing <b>{delT?.fullName}</b> unassigns their modules and deletes their scheduled online classes.</>}
        onConfirm={() => {
          if (!delId) return;
          const targetId = delId;
          void deleteTeacher(targetId)
            .then(() => {
              if (detailId === targetId) setDetailId(null);
              toast.success("Teacher deleted");
            })
            .catch((err) => {
              toast.error(err instanceof Error ? err.message : "Failed to delete teacher");
            });
        }}
      />
    </>
  );
}
