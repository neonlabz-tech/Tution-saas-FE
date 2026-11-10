import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Clock, LayoutGrid, List, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import type { Module } from "@/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, InfoRow, MultiSelect, PageHeader, SearchInput, Select, StatusBadge, Tabs } from "@/components/ui/primitives";
import { DataTable, type Columns } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/hooks/useAppData";
import { BATCHES } from "@/data/mock";
import { ModuleFormModal } from "@/components/modules/ModuleFormModal";
import { fmtLKR } from "@/lib/utils";

const GRADS = ["from-indigo-500 to-violet-500", "from-teal-500 to-emerald-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500", "from-sky-500 to-indigo-500", "from-fuchsia-500 to-purple-500"];

function RegisterStudents({ module, onClose }: { module: Module; onClose: () => void }) {
  const { students, setModuleStudents } = useAppData();
  const toast = useToast();
  const [sel, setSel] = useState<string[]>(() => students.filter((s) => s.moduleIds.includes(module.id)).map((s) => s.id));
  const [q, setQ] = useState("");
  const list = students.filter((s) => s.status !== "graduated" && (s.fullName.toLowerCase().includes(q.toLowerCase()) || s.id.toLowerCase().includes(q.toLowerCase())));
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Modal
      open
      onClose={onClose}
      title={`Register students — ${module.name}`}
      description={`${sel.length} selected`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setModuleStudents(module.id, sel); toast.success(`Enrollment updated for ${module.name}`); onClose(); }}>Save enrollment</Button>
        </>
      }
    >
      <SearchInput placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      <div className="max-h-[50vh] divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line">
        {list.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
            <input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
            <Avatar name={s.fullName} size="sm" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.fullName}</span><span className="num text-[11px] text-muted">{s.id} · {s.batch}</span></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export default function ModulesPage() {
  const { modules, students, teachers, getTeacher, saveModule, deleteModule, setModuleStudents } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("all");
  const [teacher, setTeacher] = useState("all");
  const [batch, setBatch] = useState("all");
  const [form, setForm] = useState<{ open: boolean; item: Module | null }>({ open: false, item: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [regId, setRegId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("q")) setQ(params.get("q")!);
    if (params.get("new") === "1") { setForm({ open: true, item: null }); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const enrolled = (id: string) => students.filter((s) => s.moduleIds.includes(id));
  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    return modules.filter(
      (m) =>
        (!s || m.name.toLowerCase().includes(s) || m.code.toLowerCase().includes(s)) &&
        (status === "all" || m.status === status) &&
        (teacher === "all" || m.teacherId === teacher) &&
        (batch === "all" || m.batches.includes(batch)),
    );
  }, [modules, q, status, teacher, batch]);

  const columns = useMemo<Columns<Module>>(
    () => [
      { id: "name", header: "Module", accessorFn: (m) => m.name, cell: ({ row }) => <div><p className="font-semibold">{row.original.name}</p><p className="num text-[11px] text-muted">{row.original.code}</p></div> },
      { id: "teacher", header: "Teacher", accessorFn: (m) => getTeacher(m.teacherId)?.fullName ?? "—", cell: (c) => <span className="text-sm">{c.getValue() as string}</span> },
      { accessorKey: "duration", header: "Duration" },
      { id: "fee", header: "Fee", accessorFn: (m) => m.fee, cell: (c) => <span className="num text-sm font-semibold">{fmtLKR(c.getValue() as number)}</span> },
      { id: "enrolled", header: "Enrolled", accessorFn: (m) => enrolled(m.id).length, cell: (c) => <span className="num font-semibold">{c.getValue() as number}</span> },
      { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.getValue() as string} /> },
      {
        id: "actions", header: "", enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ open: true, item: row.original })}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, teachers],
  );

  const detail = detailId ? modules.find((m) => m.id === detailId) : undefined;
  const delM = delId ? modules.find((m) => m.id === delId) : undefined;
  const regM = regId ? modules.find((m) => m.id === regId) : undefined;

  return (
    <>
      <PageHeader
        title="Modules"
        description="Courses offered by the institute — fees, teachers, batches and enrollments."
        actions={
          <>
            <Tabs value={view} onChange={setView} items={[{ id: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> }, { id: "list", label: "List", icon: <List className="h-4 w-4" /> }]} />
            <Button onClick={() => setForm({ open: true, item: null })}><Plus className="h-4 w-4" /> Create module</Button>
          </>
        }
      />
      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput placeholder="Search modules…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="all">All statuses</option><option value="active">Active</option><option value="upcoming">Upcoming</option><option value="archived">Archived</option></Select>
        <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher"><option value="all">All teachers</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>
        <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch"><option value="all">All batches</option>{BATCHES.map((b) => <option key={b}>{b}</option>)}</Select>
      </Card>

      {view === "list" ? (
        <Card><DataTable data={data} columns={columns} pageSize={8} onRowClick={(m) => setDetailId(m.id)} emptyTitle="No modules found" /></Card>
      ) : data.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="h-6 w-6" />} title="No modules found" text="Adjust your filters or create a new module." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((m, i) => {
            const t = getTeacher(m.teacherId);
            const n = enrolled(m.id).length;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <Card className="group flex h-full cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop">
                  <div onClick={() => setDetailId(m.id)} className="flex flex-1 flex-col">
                    <div className={`relative h-24 bg-gradient-to-br ${GRADS[i % GRADS.length]} p-4 text-white`}>
                      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" />
                      <div className="absolute bottom-0 right-10 h-14 w-14 rounded-full bg-white/10" />
                      <p className="num relative text-xs font-semibold opacity-90">{m.code}</p>
                      <h3 className="relative mt-1 font-heading text-lg font-extrabold leading-tight">{m.name}</h3>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-center justify-between"><StatusBadge status={m.status} /><span className="num text-base font-bold">{fmtLKR(m.fee)}</span></div>
                      <p className="line-clamp-2 text-sm text-muted">{m.description}</p>
                      <div className="mt-4 flex items-center gap-2">
                        {t ? <Avatar name={t.fullName} size="sm" /> : <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-surface-2 text-muted"><Users className="h-4 w-4" /></div>}
                        <span className="truncate text-xs font-semibold">{t?.fullName ?? "No teacher assigned"}</span>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><b className="num text-ink">{n}</b> students</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{m.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 border-t border-line px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => setRegId(m.id)}><UserPlus className="h-3.5 w-3.5" /> Register</Button>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setForm({ open: true, item: m })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" className="hover:text-rose-500" onClick={() => setDelId(m.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <ModuleFormModal open={form.open} item={form.item} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      {regM && <RegisterStudents key={regM.id} module={regM} onClose={() => setRegId(null)} />}

      <Drawer open={!!detail} onClose={() => setDetailId(null)} title={detail?.name} description={detail?.code}>
        {detail && (
          <div className="space-y-5">
            <p className="text-sm text-muted">{detail.description}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-surface-2 p-3 text-center"><p className="num text-lg font-bold">{fmtLKR(detail.fee).replace("LKR ", "")}</p><p className="text-[11px] text-muted">Fee (LKR)</p></div>
              <div className="rounded-2xl bg-surface-2 p-3 text-center"><p className="num text-lg font-bold">{enrolled(detail.id).length}</p><p className="text-[11px] text-muted">Enrolled</p></div>
              <div className="rounded-2xl bg-surface-2 p-3 text-center"><p className="text-lg font-bold">{detail.duration}</p><p className="text-[11px] text-muted">Duration</p></div>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <InfoRow label="Status"><StatusBadge status={detail.status} /></InfoRow>
              <InfoRow label="Revenue potential"><span className="num">{fmtLKR(detail.fee * enrolled(detail.id).length)}</span></InfoRow>
            </div>
            <Field label="Assigned teacher">
              <Select value={detail.teacherId ?? ""} onChange={(e) => { saveModule({ ...detail, teacherId: e.target.value || null }, detail.id); toast.success("Teacher assignment updated"); }}>
                <option value="">Unassigned</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </Select>
            </Field>
            <Field label="Assigned batches">
              <MultiSelect value={detail.batches} options={BATCHES.map((b) => ({ value: b, label: b }))} onChange={(v) => v.length ? saveModule({ ...detail, batches: v }, detail.id) : toast.error("A module needs at least one batch")} />
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold">Enrolled students</h4>
                <Button size="sm" variant="soft" onClick={() => setRegId(detail.id)}><UserPlus className="h-3.5 w-3.5" /> Register students</Button>
              </div>
              {enrolled(detail.id).length === 0 ? (
                <p className="text-sm text-muted">No students registered yet.</p>
              ) : (
                <div className="max-h-72 divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line">
                  {enrolled(detail.id).map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                      <Avatar name={s.fullName} size="sm" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.fullName}</p><p className="num text-[11px] text-muted">{s.id}</p></div>
                      <Badge tone="neutral">{s.batch}</Badge>
                      <button aria-label="Remove" onClick={() => setModuleStudents(detail.id, enrolled(detail.id).filter((x) => x.id !== s.id).map((x) => x.id))} className="rounded-lg p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => setForm({ open: true, item: detail })}><Pencil className="h-4 w-4" /> Edit module</Button>
              <Button variant="dangerSoft" onClick={() => setDelId(detail.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!delM}
        onClose={() => setDelId(null)}
        title="Delete module?"
        text={<><b>{delM?.name}</b> will be removed from all students, along with its online classes and attendance records.</>}
        onConfirm={() => { if (delId) { deleteModule(delId); if (detailId === delId) setDetailId(null); toast.success("Module deleted"); } }}
      />
    </>
  );
}
