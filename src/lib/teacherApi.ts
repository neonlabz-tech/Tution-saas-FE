// Teacher-portal service layer.
//
// REAL backend (existing wrappers): auth (JWT, role "teacher"), teachers, modules, students,
// online classes, notices, notifications, R2 storage upload.
// LOCAL store (no endpoint yet, see TEACHER_BACKEND_CONTRACT.md): physical classes, class-change
// reasons, materials, recordings, assignments, submissions, marks, publications, salary.
// Every mutation passes through the guards in `teacherPolicy.ts`.
import { listModules } from "@/api/modules";
import { listStudents } from "@/api/students";
import { listOnlineClasses, updateOnlineClass } from "@/api/onlineClasses";
import { createNotification } from "@/api/notifications";
import { noticesApi, storageApi, teachersApi, type AuthUser, type NoticePayload } from "@/lib/api";
import {
  ForbiddenError,
  ValidationError,
  ALLOWED_MATERIAL_EXT,
  ALLOWED_RECORDING_EXT,
  assertCanChangeClass,
  assertOwnerId,
  assertOwnsBatch,
  assertOwnsBatchName,
  validateMarks,
  validateReason,
  validateReschedule,
  validateUpload,
  validateUrl,
  type Actor,
} from "@/lib/teacherPolicy";
import { buildSalary, ensureBatchSeed, ensureSubmissions, loadStore, newId, saveStore } from "@/lib/teacherStore";
import { addDays, pad, toISO, toLocalDT, todayISO } from "@/lib/utils";
import { hashStr } from "@/data/mock/student";
import type { Notice } from "@/types";
import type {
  AssignmentSubmission,
  MarksPublication,
  MarksRow,
  NoticeKind,
  SalaryPayment,
  TeacherAssignment,
  TeacherBatch,
  TeacherClass,
  TeacherMaterial,
  TeacherProfile,
  TeacherRecording,
  TeacherStudent,
} from "@/types/teacher";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const makeBatchId = (moduleId: string, batch: string) => `${moduleId}__${slug(batch)}`;

/* ------------------------------------------------------------------ identity */
export async function resolveProfile(user: AuthUser): Promise<TeacherProfile> {
  let rec: { id: string; phone?: string; qualification?: string; specialization?: string; fullName?: string } | undefined;
  try {
    const res = await teachersApi.list({ q: user.email });
    rec = res.data?.find((t) => t.email?.toLowerCase() === user.email.toLowerCase());
  } catch {
    /* teacher role may not be allowed to list teachers: fall back to the user id */
  }
  const teacherId = rec?.id ?? user.id;
  return {
    userId: user.id,
    teacherId,
    fullName: rec?.fullName ?? user.fullName,
    email: user.email,
    phone: rec?.phone ?? "",
    qualification: rec?.qualification ?? "",
    specialization: rec?.specialization ?? "",
    employeeNo: `TCH-${String(hashStr(teacherId) % 10000).padStart(4, "0")}`,
  };
}

/* ------------------------------------------------------------------ batches & students */
export async function loadBatches(profile: TeacherProfile): Promise<TeacherBatch[]> {
  const modules = (await listModules({ teacherId: profile.teacherId })).filter((m) => (m.teacherId ?? m.teacher?.id) === profile.teacherId);
  const pairs = modules.flatMap((m) => (m.batches ?? []).map((batch) => ({ m, batch })));
  // Count only students the client can confirm belong to the module+batch (never trust server-side filtering alone).
  const counts = await Promise.all(pairs.map(({ m, batch }) => fetchBatchStudents(m.id, batch).then((r) => r.length).catch(() => 0)));
  return pairs.map(({ m, batch }, i) => ({
    id: makeBatchId(m.id, batch),
    moduleId: m.id,
    moduleCode: m.code,
    moduleName: m.name,
    batch,
    studentCount: counts[i],
    schedule: m.duration ? `Duration ${m.duration}` : "Schedule to be announced",
    status: m.status,
  }));
}

async function fetchBatchStudents(moduleId: string, batchName: string): Promise<TeacherStudent[]> {
  const out: TeacherStudent[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await listStudents({ batch: batchName, moduleId, limit: 100, page, sortBy: "fullName", sortOrder: "asc" });
    for (const s of res.items) {
      if (!s.moduleIds?.includes(moduleId) || s.batch !== batchName) continue;
      out.push({ id: s.id, fullName: s.fullName, email: s.email, phone: s.phone, status: s.status, enrollmentDate: s.enrollmentDate });
    }
    if (page >= res.pagination.totalPages) break;
  }
  return out;
}

export async function listBatchStudents(a: Actor, batch: TeacherBatch): Promise<TeacherStudent[]> {
  assertOwnsBatch(a, batch.id);
  return fetchBatchStudents(batch.moduleId, batch.batch);
}

/* ------------------------------------------------------------------ classes */
const PHYS_HOURS = [9, 11, 14, 16];
const LOCATIONS = ["Hall A", "Room 204", "Computer Lab 3", "Room 108", "Language Lab", "Physics Lab"];

function physicalFor(batches: TeacherBatch[]): TeacherClass[] {
  const out: TeacherClass[] = [];
  batches.forEach((b, i) => {
    const dow = i % 2 === 0 ? 6 : 0;
    const hour = PHYS_HOURS[Math.floor(i / 2) % PHYS_HOURS.length];
    for (let d = -21; d <= 49; d++) {
      const day = addDays(new Date(), d);
      if (day.getDay() !== dow) continue;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0);
      const end = new Date(start.getTime() + 120 * 60000);
      out.push({
        id: `phy_${b.id}_${toISO(day)}`,
        kind: "physical",
        title: `${b.moduleName} (on-site)`,
        moduleId: b.moduleId,
        moduleName: b.moduleName,
        moduleCode: b.moduleCode,
        batchId: b.id,
        batch: b.batch,
        start: toLocalDT(start),
        end: toLocalDT(end),
        status: "scheduled",
        location: LOCATIONS[i % LOCATIONS.length],
      });
    }
  });
  return out;
}

export async function loadClasses(a: Actor, profile: TeacherProfile, batches: TeacherBatch[]): Promise<TeacherClass[]> {
  const byId = new Map(batches.map((b) => [b.id, b]));
  const store = loadStore(a.teacherId);
  const online = (await listOnlineClasses({ teacherId: profile.teacherId }))
    .filter((c) => c.teacherId === profile.teacherId || c.teacher?.id === profile.teacherId)
    .flatMap((c): TeacherClass[] => {
      const b = byId.get(makeBatchId(c.moduleId, c.batch));
      if (!b) return []; // class for a batch the teacher doesn't manage → never shown
      return [{ id: c.id, kind: "online", title: c.title, moduleId: c.moduleId, moduleName: b.moduleName, moduleCode: b.moduleCode, batchId: b.id, batch: b.batch, start: c.start, end: c.end, status: c.status, link: c.link }];
    });
  const now = toLocalDT(new Date());
  return [...online, ...physicalFor(batches)]
    .map((c): TeacherClass => {
      const ch = store.classChanges[c.id];
      if (ch) return { ...c, status: ch.status, reason: ch.reason, originalStart: ch.originalStart, originalEnd: ch.originalEnd };
      if (c.status === "scheduled" && c.end < now) return { ...c, status: "completed" };
      return c;
    })
    .sort((x, y) => x.start.localeCompare(y.start));
}

export type ClassChangeInput = { type: "cancel"; reason: string } | { type: "postpone"; reason: string; start: string; end: string };

export async function changeClass(a: Actor, cls: TeacherClass, input: ClassChangeInput): Promise<{ updated: TeacherClass; notified: boolean }> {
  assertCanChangeClass(a, cls);
  const reason = validateReason(input.reason);
  if (input.type === "postpone") validateReschedule(cls, input.start, input.end);

  if (cls.kind === "online") {
    await updateOnlineClass(cls.id, input.type === "cancel" ? { status: "cancelled" } : { start: input.start, end: input.end });
  }
  const store = loadStore(a.teacherId);
  const prev = store.classChanges[cls.id];
  const originalStart = prev?.originalStart ?? cls.start;
  const originalEnd = prev?.originalEnd ?? cls.end;
  saveStore(a.teacherId, {
    ...store,
    classChanges: {
      ...store.classChanges,
      [cls.id]: { classId: cls.id, status: input.type === "cancel" ? "cancelled" : "postponed", reason, originalStart, originalEnd, changedAt: new Date().toISOString(), changedBy: a.userId },
    },
  });
  const updated: TeacherClass =
    input.type === "cancel"
      ? { ...cls, status: "cancelled", reason, originalStart, originalEnd }
      : { ...cls, status: "postponed", start: input.start, end: input.end, reason, originalStart, originalEnd };

  let notified = true;
  try {
    const when = (dt: string) => new Date(dt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await createNotification({
      type: "class",
      title: input.type === "cancel" ? `Class cancelled: ${cls.title}` : `Class rescheduled: ${cls.title}`,
      subtitle: input.type === "cancel" ? `${when(cls.start)} · Reason: ${reason}` : `Moved from ${when(originalStart)} to ${when(input.start)} · Reason: ${reason}`,
      link: "/student",
      actorId: a.userId,
      actorRole: "teacher",
      targetRoles: ["student"],
      targetBatch: cls.batch,
      priority: "high",
      metadata: { classId: cls.id, moduleId: cls.moduleId, change: input.type },
    });
  } catch {
    notified = false;
  }
  return { updated, notified };
}

/* ------------------------------------------------------------------ materials */
export function listMaterials(a: Actor, batch: TeacherBatch): TeacherMaterial[] {
  assertOwnsBatch(a, batch.id);
  return ensureBatchSeed(a.teacherId, batch).materials.filter((m) => m.batchId === batch.id).sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
}
export interface MaterialInput {
  title: string;
  description: string;
  kind: "file" | "link";
  file?: File | null;
  url?: string;
}
function checkTitle(title: string): string {
  const t = title.trim();
  if (t.length < 3) throw new ValidationError("Title must be at least 3 characters.");
  if (t.length > 120) throw new ValidationError("Title is too long (max 120 characters).");
  return t;
}
export async function saveMaterial(a: Actor, batch: TeacherBatch, input: MaterialInput, existing?: TeacherMaterial): Promise<TeacherMaterial> {
  assertOwnsBatch(a, batch.id);
  if (existing) assertOwnerId(a, existing.teacherId, "materials");
  const title = checkTitle(input.title);
  let patch: Partial<TeacherMaterial>;
  if (input.kind === "link") {
    patch = { kind: "link", url: validateUrl(input.url ?? ""), fileName: undefined, mimeType: undefined, sizeBytes: undefined, storageKey: undefined };
  } else if (input.file) {
    validateUpload(input.file, ALLOWED_MATERIAL_EXT);
    const up = await storageApi.upload(input.file, `teacher-materials/${a.teacherId}`);
    if (existing?.storageKey) void storageApi.delete(existing.storageKey).catch(() => undefined);
    patch = { kind: "file", url: up.url, storageKey: up.key, fileName: input.file.name, mimeType: input.file.type || up.mimeType, sizeBytes: input.file.size };
  } else if (existing && existing.kind === "file") {
    patch = {};
  } else {
    throw new ValidationError("Choose a file to upload.");
  }
  const store = loadStore(a.teacherId);
  if (existing) {
    const next: TeacherMaterial = { ...existing, ...patch, title, description: input.description.trim() };
    saveStore(a.teacherId, { ...store, materials: store.materials.map((m) => (m.id === existing.id ? next : m)) });
    return next;
  }
  const created: TeacherMaterial = { id: newId("mat"), batchId: batch.id, teacherId: a.teacherId, title, description: input.description.trim(), kind: "file", url: "", uploadedAt: new Date().toISOString(), ...patch } as TeacherMaterial;
  saveStore(a.teacherId, { ...store, materials: [created, ...store.materials] });
  return created;
}
export async function deleteMaterial(a: Actor, m: TeacherMaterial): Promise<void> {
  assertOwnsBatch(a, m.batchId);
  assertOwnerId(a, m.teacherId, "materials");
  if (m.storageKey) void storageApi.delete(m.storageKey).catch(() => undefined);
  const store = loadStore(a.teacherId);
  saveStore(a.teacherId, { ...store, materials: store.materials.filter((x) => x.id !== m.id) });
}

/* ------------------------------------------------------------------ recordings */
export function listRecordings(a: Actor, batch: TeacherBatch): TeacherRecording[] {
  assertOwnsBatch(a, batch.id);
  return ensureBatchSeed(a.teacherId, batch).recordings.filter((r) => r.batchId === batch.id).sort((x, y) => y.date.localeCompare(x.date));
}
export interface RecordingInput {
  title: string;
  description: string;
  date: string;
  videoUrl?: string;
  file?: File | null;
}
export async function saveRecording(a: Actor, batch: TeacherBatch, input: RecordingInput, existing?: TeacherRecording): Promise<TeacherRecording> {
  assertOwnsBatch(a, batch.id);
  if (existing) assertOwnerId(a, existing.teacherId, "recordings");
  const title = checkTitle(input.title);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationError("Choose the class date.");
  if (input.date > todayISO()) throw new ValidationError("A recording can't be dated in the future.");
  let videoUrl = existing?.videoUrl ?? "";
  let source: TeacherRecording["source"] = existing?.source ?? "link";
  let storageKey = existing?.storageKey;
  if (input.file) {
    validateUpload(input.file, ALLOWED_RECORDING_EXT);
    const up = await storageApi.upload(input.file, `teacher-recordings/${a.teacherId}`);
    if (existing?.storageKey) void storageApi.delete(existing.storageKey).catch(() => undefined);
    videoUrl = up.url;
    storageKey = up.key;
    source = "upload";
  } else if (input.videoUrl?.trim()) {
    videoUrl = validateUrl(input.videoUrl);
    source = "link";
    storageKey = undefined;
  } else if (!existing) {
    throw new ValidationError("Add a video link or upload a recording.");
  }
  const store = loadStore(a.teacherId);
  const rec: TeacherRecording = { id: existing?.id ?? newId("rec"), batchId: batch.id, teacherId: a.teacherId, title, description: input.description.trim(), date: input.date, videoUrl, source, storageKey };
  saveStore(a.teacherId, { ...store, recordings: existing ? store.recordings.map((r) => (r.id === existing.id ? rec : r)) : [rec, ...store.recordings] });
  return rec;
}
export async function deleteRecording(a: Actor, r: TeacherRecording): Promise<void> {
  assertOwnsBatch(a, r.batchId);
  assertOwnerId(a, r.teacherId, "recordings");
  if (r.storageKey) void storageApi.delete(r.storageKey).catch(() => undefined);
  const store = loadStore(a.teacherId);
  saveStore(a.teacherId, { ...store, recordings: store.recordings.filter((x) => x.id !== r.id) });
}

/* ------------------------------------------------------------------ assignments & marks */
export function listAssignments(a: Actor, batch: TeacherBatch): TeacherAssignment[] {
  assertOwnsBatch(a, batch.id);
  return ensureBatchSeed(a.teacherId, batch).assignments.filter((x) => x.batchId === batch.id).sort((x, y) => x.dueDate.localeCompare(y.dueDate));
}
export interface SubmissionRow {
  student: TeacherStudent;
  submission: AssignmentSubmission;
}
export function listSubmissions(a: Actor, batch: TeacherBatch, assignmentId: string, students: TeacherStudent[]): { assignment: TeacherAssignment; rows: SubmissionRow[]; publication: MarksPublication | null } {
  assertOwnsBatch(a, batch.id);
  const store = ensureBatchSeed(a.teacherId, batch);
  const assignment = store.assignments.find((x) => x.id === assignmentId && x.batchId === batch.id);
  if (!assignment) throw new ForbiddenError("That assignment isn't part of this batch.");
  const s2 = ensureSubmissions(a.teacherId, assignment, students);
  const bySt = new Map(s2.submissions.filter((x) => x.assignmentId === assignmentId).map((x) => [x.studentId, x]));
  return {
    assignment,
    rows: students.flatMap((st) => (bySt.has(st.id) ? [{ student: st, submission: bySt.get(st.id)! }] : [])),
    publication: s2.publications.find((p) => p.assignmentId === assignmentId) ?? null,
  };
}
export function setMarks(a: Actor, batch: TeacherBatch, assignmentId: string, studentId: string, marks: number | null, feedback?: string): AssignmentSubmission {
  assertOwnsBatch(a, batch.id);
  const store = loadStore(a.teacherId);
  const asg = store.assignments.find((x) => x.id === assignmentId && x.batchId === batch.id);
  if (!asg) throw new ForbiddenError("That assignment isn't part of this batch.");
  assertOwnerId(a, asg.teacherId, "assignments");
  if (store.publications.some((p) => p.assignmentId === assignmentId)) throw new ForbiddenError("Marks for this assignment are published and locked.");
  const sub = store.submissions.find((x) => x.assignmentId === assignmentId && x.studentId === studentId);
  if (!sub) throw new ValidationError("This student has no submission record.");
  if (!sub.submittedAt) throw new ValidationError("This student hasn't submitted yet, so there is nothing to mark.");
  if (marks !== null) validateMarks(marks, asg.maxMarks);
  const next: AssignmentSubmission = { ...sub, marks, markedAt: marks === null ? null : new Date().toISOString(), feedback: feedback?.trim() || sub.feedback };
  saveStore(a.teacherId, { ...store, submissions: store.submissions.map((x) => (x.id === sub.id ? next : x)) });
  return next;
}
export function buildMarksTable(a: Actor, batch: TeacherBatch, students: TeacherStudent[]): { assignments: TeacherAssignment[]; rows: MarksRow[]; published: Set<string> } {
  const assignments = listAssignments(a, batch);
  let store = loadStore(a.teacherId);
  for (const asg of assignments) store = ensureSubmissions(a.teacherId, asg, students);
  const rows = students.map((student): MarksRow => {
    const marks: Record<string, number | null> = {};
    let total = 0;
    for (const asg of assignments) {
      const sub = store.submissions.find((x) => x.assignmentId === asg.id && x.studentId === student.id);
      marks[asg.id] = sub?.marks ?? null;
      total += sub?.marks ?? 0;
    }
    return { student, marks, total };
  });
  return { assignments, rows, published: new Set(store.publications.map((p) => p.assignmentId)) };
}

/* ------------------------------------------------------------------ notices */
export interface TeacherNoticeView {
  notice: Notice;
  owned: boolean;
  kind: NoticeKind | "admin";
}
export async function listNotices(a: Actor): Promise<TeacherNoticeView[]> {
  const res = await noticesApi.list();
  const own = new Map(loadStore(a.teacherId).noticeOwnership.map((o) => [o.noticeId, o]));
  return res.items
    .flatMap((n): TeacherNoticeView[] => {
      const o = own.get(n.id);
      if (o) return [{ notice: n, owned: true, kind: o.kind }];
      const relevant = n.status === "published" && (n.allBatches || n.batches.length === 0 || n.batches.some((b) => a.batchNames.has(b)));
      return relevant && n.state !== "expired" ? [{ notice: n, owned: false, kind: "admin" }] : [];
    })
    .sort((x, y) => y.notice.publishDate.localeCompare(x.notice.publishDate));
}
export interface NoticeInput {
  title: string;
  description: string;
  batches: string[];
  priority: Notice["priority"];
  expiryDate: string;
}
function checkNotice(a: Actor, i: NoticeInput) {
  const title = i.title.trim();
  const description = i.description.trim();
  if (title.length < 3) throw new ValidationError("Title must be at least 3 characters.");
  if (description.length < 5) throw new ValidationError("Please add a description.");
  if (!i.batches.length) throw new ValidationError("Choose at least one of your batches.");
  i.batches.forEach((b) => assertOwnsBatchName(a, b));
  if (!i.expiryDate || i.expiryDate < todayISO()) throw new ValidationError("Expiry date can't be in the past.");
  return { title, description };
}
const noticePayload = (i: NoticeInput, t: { title: string; description: string }): NoticePayload => ({
  title: t.title,
  description: t.description,
  allBatches: false,
  batches: [...new Set(i.batches)],
  publishDate: todayISO(),
  expiryDate: i.expiryDate,
  expiryTime: "23:59",
  priority: i.priority,
  status: "published",
});
export async function createNotice(a: Actor, i: NoticeInput, kind: NoticeKind = "academic", assignmentId?: string): Promise<Notice> {
  const t = checkNotice(a, i);
  const n = await noticesApi.create(noticePayload(i, t));
  const store = loadStore(a.teacherId);
  saveStore(a.teacherId, { ...store, noticeOwnership: [...store.noticeOwnership, { noticeId: n.id, teacherId: a.teacherId, kind, assignmentId }] });
  return n;
}
function assertOwnsNotice(a: Actor, id: string) {
  if (!loadStore(a.teacherId).noticeOwnership.some((o) => o.noticeId === id && o.teacherId === a.teacherId)) throw new ForbiddenError("Administrative notices can't be modified by teachers.");
}
export async function updateNotice(a: Actor, id: string, i: NoticeInput): Promise<Notice> {
  assertOwnsNotice(a, id);
  const t = checkNotice(a, i);
  const { publishDate: _p, ...rest } = noticePayload(i, t);
  return noticesApi.update(id, rest);
}
export async function deleteNotice(a: Actor, id: string): Promise<void> {
  assertOwnsNotice(a, id);
  await noticesApi.remove(id);
  const store = loadStore(a.teacherId);
  saveStore(a.teacherId, { ...store, noticeOwnership: store.noticeOwnership.filter((o) => o.noticeId !== id), publications: store.publications.filter((p) => p.noticeId !== id) });
}

/** Publish an assignment's marks. Notices carry ONLY class-level aggregates, never a student's individual marks. */
export async function publishMarks(a: Actor, batch: TeacherBatch, assignmentId: string, students: TeacherStudent[]): Promise<MarksPublication> {
  assertOwnsBatch(a, batch.id);
  const { assignment, rows, publication } = listSubmissions(a, batch, assignmentId, students);
  assertOwnerId(a, assignment.teacherId, "assignments");
  if (publication) throw new ValidationError("These marks are already published.");
  const submitted = rows.filter((r) => r.submission.submittedAt);
  if (!submitted.length) throw new ValidationError("There are no submissions to publish.");
  const missing = submitted.filter((r) => r.submission.marks === null).length;
  if (missing) throw new ValidationError(`${missing} submission${missing > 1 ? "s are" : " is"} still unmarked. Enter all marks before publishing.`);
  const marked = submitted.map((r) => r.submission.marks as number);
  const avg = marked.reduce((s, m) => s + m, 0) / marked.length;
  const notice = await createNotice(
    a,
    {
      title: `Results published: ${assignment.title}`,
      description: `Marks for “${assignment.title}” (${batch.moduleName}, ${batch.batch}) are now available. ${marked.length} submission${marked.length > 1 ? "s" : ""} marked · class average ${avg.toFixed(1)}/${assignment.maxMarks} · highest ${Math.max(...marked)}/${assignment.maxMarks}. Open your Student Portal to see your own mark.`,
      batches: [batch.batch],
      priority: "medium",
      expiryDate: toISO(addDays(new Date(), 30)),
    },
    "result",
    assignmentId,
  );
  const store = loadStore(a.teacherId);
  const pub: MarksPublication = { id: newId("pub"), assignmentId, batchId: batch.id, noticeId: notice.id, publishedAt: new Date().toISOString(), publishedBy: a.userId };
  saveStore(a.teacherId, { ...store, publications: [...store.publications, pub] });
  return pub;
}

/* ------------------------------------------------------------------ salary (read-only) */
export function listSalary(a: Actor): SalaryPayment[] {
  return buildSalary(a.teacherId);
}
export function getSalary(a: Actor, id: string): SalaryPayment {
  const p = listSalary(a).find((x) => x.id === id);
  if (!p) throw new ForbiddenError("That payment doesn't exist or isn't yours.");
  return p;
}
export const periodLabel = (period: string) => new Date(`${period}-01T00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
export { pad };

/** A single student's work in this batch (read-only view for the student drawer). */
export function studentSubmissions(a: Actor, batch: TeacherBatch, students: TeacherStudent[], studentId: string): { assignment: TeacherAssignment; submission: AssignmentSubmission | null; published: boolean }[] {
  assertOwnsBatch(a, batch.id);
  if (!students.some((s) => s.id === studentId)) throw new ForbiddenError("That student isn't in this batch.");
  const assignments = listAssignments(a, batch);
  let store = loadStore(a.teacherId);
  for (const asg of assignments) store = ensureSubmissions(a.teacherId, asg, students);
  return assignments.map((assignment) => ({
    assignment,
    submission: store.submissions.find((x) => x.assignmentId === assignment.id && x.studentId === studentId) ?? null,
    published: store.publications.some((p) => p.assignmentId === assignment.id),
  }));
}
