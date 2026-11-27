// Local persistence for teacher-only data that has NO backend endpoint yet
// (materials metadata, recordings, assignments, submissions, marks, class-change reasons, salary).
// It is namespaced per teacher and only ever touched through `teacherApi.ts`, which applies the
// policy guards. Swap the bodies in teacherApi for `request()` calls once endpoints exist.
import { hashStr } from "@/data/mock/student";
import { addDays, pad, toISO } from "@/lib/utils";
import type {
  AssignmentSubmission,
  ClassChange,
  MarksPublication,
  NoticeOwnership,
  SalaryPayment,
  TeacherAssignment,
  TeacherBatch,
  TeacherMaterial,
  TeacherRecording,
  TeacherStudent,
} from "@/types/teacher";

export interface TeacherStoreData {
  version: 1;
  seededBatches: string[];
  materials: TeacherMaterial[];
  recordings: TeacherRecording[];
  assignments: TeacherAssignment[];
  submissions: AssignmentSubmission[];
  publications: MarksPublication[];
  noticeOwnership: NoticeOwnership[];
  classChanges: Record<string, ClassChange>;
}

const key = (teacherId: string) => `eduflow-teacher-store-v1:${teacherId}`;
const empty = (): TeacherStoreData => ({ version: 1, seededBatches: [], materials: [], recordings: [], assignments: [], submissions: [], publications: [], noticeOwnership: [], classChanges: {} });

const cache = new Map<string, TeacherStoreData>();

export function loadStore(teacherId: string): TeacherStoreData {
  const hit = cache.get(teacherId);
  if (hit) return hit;
  let data = empty();
  try {
    const raw = localStorage.getItem(key(teacherId));
    if (raw) data = { ...empty(), ...(JSON.parse(raw) as TeacherStoreData) };
  } catch {
    /* corrupted or unavailable storage → start clean */
  }
  cache.set(teacherId, data);
  return data;
}
export function saveStore(teacherId: string, data: TeacherStoreData): void {
  cache.set(teacherId, data);
  try {
    localStorage.setItem(key(teacherId), JSON.stringify(data));
  } catch {
    /* quota / private mode: in-memory only for this page load */
  }
}
/** Test/demo helper: forget cached + stored data for a teacher. */
export function resetStore(teacherId: string): void {
  cache.delete(teacherId);
  try {
    localStorage.removeItem(key(teacherId));
  } catch {
    /* ignore */
  }
}

const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const TOPICS = ["Fundamentals", "Core Concepts", "Applications", "Revision", "Past-paper Practice", "Advanced Problems"];
let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const newId = nid;

/** First-time content for a batch so a brand-new teacher account isn't an empty shell. Runs once per batch. */
export function ensureBatchSeed(teacherId: string, batch: TeacherBatch): TeacherStoreData {
  const s = loadStore(teacherId);
  if (s.seededBatches.includes(batch.id)) return s;
  const next: TeacherStoreData = { ...s, seededBatches: [...s.seededBatches, batch.id] };
  const h = hashStr(batch.id);
  const code = batch.moduleCode;
  const now = new Date();

  const dues = [-28, -12, 6, 20];
  next.assignments = [
    ...s.assignments,
    ...dues.map((d, i): TeacherAssignment => ({
      id: `asg_${batch.id}_${i + 1}`,
      batchId: batch.id,
      teacherId,
      title: `${TOPICS[(h + i) % TOPICS.length]}: ${i % 2 ? "Worksheet" : "Problem set"}`,
      description: `Complete the ${TOPICS[(h + i) % TOPICS.length].toLowerCase()} exercises for ${batch.moduleName}. Show your working; submit one PDF or photo scan.`,
      dueDate: `${toISO(addDays(now, d))}T23:59`,
      maxMarks: i === 3 ? 100 : 50,
      createdAt: addDays(now, d - 10).toISOString(),
    })),
  ];
  next.materials = [
    ...s.materials,
    ...["Lecture notes", "Past paper pack"].map((t, i): TeacherMaterial => ({
      id: `mat_${batch.id}_${i + 1}`,
      batchId: batch.id,
      teacherId,
      title: `${code} · ${t}`,
      description: i ? "Recent past papers with marking schemes." : "Complete lecture notes with worked examples.",
      kind: "file",
      fileName: `${code.toLowerCase()}-${t.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 240_000 + (h % 900_000) + i * 130_000,
      url: "",
      uploadedAt: addDays(now, -(12 + i * 8)).toISOString(),
    })),
    {
      id: `mat_${batch.id}_3`,
      batchId: batch.id,
      teacherId,
      title: "Recommended reading (external)",
      description: "Open-access reference for this module.",
      kind: "link",
      url: "https://en.wikipedia.org/wiki/Main_Page",
      uploadedAt: addDays(now, -5).toISOString(),
    },
  ];
  next.recordings = [
    ...s.recordings,
    ...[-21, -9].map((d, i): TeacherRecording => ({
      id: `rec_${batch.id}_${i + 1}`,
      batchId: batch.id,
      teacherId,
      title: `${batch.moduleName}: ${TOPICS[(h + i + 2) % TOPICS.length]}`,
      description: "Recorded live session.",
      date: toISO(addDays(now, d)),
      videoUrl: SAMPLE_VIDEO,
      source: "link",
    })),
  ];
  saveStore(teacherId, next);
  return next;
}

/** Create (once) a submission row per student for an assignment; deterministic demo values for past-due work. */
export function ensureSubmissions(teacherId: string, assignment: TeacherAssignment, students: TeacherStudent[]): TeacherStoreData {
  const s = loadStore(teacherId);
  const have = new Set(s.submissions.filter((x) => x.assignmentId === assignment.id).map((x) => x.studentId));
  const missing = students.filter((st) => !have.has(st.id));
  if (!missing.length) return s;
  const due = new Date(assignment.dueDate);
  const past = due.getTime() < Date.now();
  const rows = missing.map((st): AssignmentSubmission => {
    const h = hashStr(`${assignment.id}:${st.id}`) % 100;
    const submitted = past ? h < 82 : h < 18;
    const late = submitted && h % 9 === 0;
    const at = submitted ? new Date(due.getTime() - ((h % 40) + 1) * 3600_000 + (late ? 30 * 3600_000 : 0)).toISOString() : null;
    return {
      id: `sub_${assignment.id}_${st.id}`,
      assignmentId: assignment.id,
      studentId: st.id,
      submittedAt: at,
      fileName: submitted ? `${st.fullName.toLowerCase().replace(/[^a-z]+/g, "-")}-${assignment.id.slice(-1)}.pdf` : null,
      late,
      marks: null,
      markedAt: null,
    };
  });
  const next = { ...s, submissions: [...s.submissions, ...rows] };
  saveStore(teacherId, next);
  return next;
}

/* ---------------- salary (read-only for teachers) ---------------- */
export function buildSalary(teacherId: string, joined?: string): SalaryPayment[] {
  const today = new Date();
  const h = hashStr(teacherId);
  const basic = 55000 + (h % 12) * 2500;
  const out: SalaryPayment[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (joined && `${period}-28` < joined) continue;
    const allowances = 5000 + ((h >> (i % 8)) % 4) * 1000;
    const deductions = Math.round(basic * 0.08);
    const current = i === 0;
    const payDay = Math.min(25, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
    out.push({
      id: `sal_${period}`,
      teacherId,
      period,
      basic,
      allowances,
      deductions,
      net: basic + allowances - deductions,
      status: current ? "pending" : "paid",
      paymentDate: current ? null : `${period}-${pad(payDay)}`,
      reference: `SAL-${period.replace("-", "")}-${String(hashStr(`${teacherId}${period}`) % 10000).padStart(4, "0")}`,
      method: "Bank Transfer",
      description: `Monthly salary: ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
    });
  }
  return out;
}
