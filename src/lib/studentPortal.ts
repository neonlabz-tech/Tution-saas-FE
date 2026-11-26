// Assembles everything the Student Portal shows for one student from the shared admin data set.
// Pure function over the mock data today; a backend `GET /student/portal` response would replace it.
import { buildMockData, type MockData } from "@/data/mock";
import { buildAssignments, buildMaterials, buildPhysicalClasses, buildRecordings, describePattern, hashStr } from "@/data/mock/student";
import type { DuePayment, PhysicalClass, StudentAccount, StudentModule, StudentPayment, StudentPortalData } from "@/types/student";
import type { Module, Notice, OnlineClass, Student } from "@/types";
import { addDays, toISO, toLocalDT, todayISO } from "@/lib/utils";

export const INSTITUTE_NAME = "Bright Future Institute";

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")
  : `${(import.meta.env.VITE_SERVER_URL ?? "").replace(/\/+$/, "")}/api`;

async function safeFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data?.items ?? json?.data ?? json) as T;
  } catch {
    return null;
  }
}

let cache: MockData | null = null;
export function getSharedData(): MockData {
  return (cache ??= buildMockData());
}

const feeOf = (d: MockData, moduleIds: string[] = []) =>
  (moduleIds || []).reduce((s, id) => s + ((d.modules || []).find((m) => m.id === id)?.fee ?? 0), 0);
const tuitionPaid = (d: MockData, studentId: string) =>
  (d.transactions || []).filter((t) => t.type === "income" && t.category === "Tuition fees" && t.studentId === studentId).reduce((s, t) => s + t.amount, 0);

/** The admin-side student used for the seeded demo account (active, 3 modules, has a balance). */
export function pickDemoStudentId(): string {
  const d = getSharedData();
  const pool = (d.students || []).filter((s) => s.status === "active" && (s.moduleIds || []).length >= 3);
  const withBalance = pool.find((s) => feeOf(d, s.moduleIds) - tuitionPaid(d, s.id) > 20000);
  return (withBalance ?? pool[0] ?? d.students[0])?.id ?? "STD-001";
}

export function findStudentByEmail(email: string) {
  return (getSharedData().students || []).find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
}
export function findStudentById(id: string) {
  return (getSharedData().students || []).find((s) => s.id.toLowerCase() === id.trim().toLowerCase());
}

const receiptNo = (id: string, date: string) => {
  const n = Number(id.split("_")[1]);
  return `RCT-${date.slice(0, 4)}-${String(Number.isFinite(n) ? n : hashStr(id) % 100000).padStart(5, "0")}`;
};

function emptyPortal(): StudentPortalData {
  return {
    linked: false,
    profile: null,
    modules: [],
    onlineClasses: [],
    physicalClasses: [],
    notices: [],
    assignments: [],
    materials: [],
    recordings: [],
    payments: [],
    dues: [],
    paymentSummary: { totalFees: 0, paid: 0, outstanding: 0, pendingVerification: 0, overdue: 0 },
    instituteName: INSTITUTE_NAME,
  };
}

export function buildPortalData(studentId: string | null): StudentPortalData {
  const d = getSharedData();
  const student = studentId ? d.students.find((s) => s.id === studentId) : undefined;
  if (!student) return emptyPortal();

  const today = todayISO();
  const nowDT = toLocalDT(new Date());
  const myModules = (student.moduleIds || []).map((id) => (d.modules || []).find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const ids = new Set(myModules.map((m) => m.id));

  const onlineClasses = (d.classes || []).filter((c) => ids.has(c.moduleId)).sort((a, b) => a.start.localeCompare(b.start));
  const physicalClasses = buildPhysicalClasses(myModules);
  const assignments = buildAssignments(myModules, student.id);
  const materials = buildMaterials(myModules);
  const recordings = buildRecordings(onlineClasses).sort((a, b) => b.date.localeCompare(a.date));

  const rawNotices: Notice[] = (d as unknown as { notices?: Notice[] }).notices ?? [];
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const notices = (Array.isArray(rawNotices) ? rawNotices : [])
    .filter((n) => n && n.status === "published" && n.publishDate <= today && n.expiryDate >= today && (!n.batches || n.batches.length === 0 || n.batches.includes(student.batch)))
    .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || b.publishDate.localeCompare(a.publishDate));

  const modules: StudentModule[] = myModules.map((m) => {
    const online = onlineClasses.filter((c) => c.moduleId === m.id);
    const physical = physicalClasses.filter((c) => c.moduleId === m.id);
    const mAssign = assignments.filter((a) => a.moduleId === m.id);
    const upcoming = [
      ...online.filter((c) => c.status === "scheduled" && c.end >= nowDT).map((c) => ({ kind: "online" as const, start: c.start })),
      ...physical.filter((c) => c.status === "scheduled" && c.end >= nowDT).map((c) => ({ kind: "physical" as const, start: c.start })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    return {
      ...m,
      teacher: d.teachers.find((t) => t.id === m.teacherId) ?? null,
      physicalSchedule: describePattern(physical.slice(0, 1), physical[0]?.location),
      onlineSchedule: describePattern(online.slice(0, 4)),
      nextSession: upcoming[0] ?? null,
      openAssignments: mAssign.filter((a) => a.status === "pending" || a.status === "overdue").length,
      totalAssignments: mAssign.length,
      materialsCount: materials.filter((x) => x.moduleId === m.id).length,
      recordingsCount: recordings.filter((x) => x.moduleId === m.id).length,
    };
  });

  // Payments
  const payments: StudentPayment[] = (d.transactions || [])
    .filter((t) => t.type === "income" && t.studentId === student.id)
    .map((t) => ({
      id: t.id,
      receiptNo: receiptNo(t.id, t.date),
      date: t.date,
      description: t.description.replace(/\s—\s.*$/, ""),
      category: t.category,
      amount: t.amount,
      method: t.method ?? "Cash",
      status: "paid" as const,
    }));

  const totalFees = feeOf(d, student.moduleIds);
  const paid = tuitionPaid(d, student.id);
  const outstanding = Math.max(0, totalFees - paid);

  // A bank transfer that is still being verified by the front desk (demo data for the "pending" state).
  let pendingVerification = 0;
  if (outstanding > 0 && hashStr(student.id) % 2 === 0) {
    pendingVerification = Math.min(outstanding, 15000);
    const date = toISO(addDays(new Date(), -2));
    payments.push({ id: `pend_${student.id}`, receiptNo: "—", date, description: "Tuition instalment (bank transfer slip uploaded)", category: "Tuition fees", amount: pendingVerification, method: "Bank Transfer", status: "pending" });
  }
  payments.sort((a, b) => b.date.localeCompare(a.date));

  // Split the unpaid balance into per-module dues, filling modules in enrolment order.
  const h = hashStr(student.id);
  const offsets = [-8 + (h % 16), 12 + (h % 10), 32];
  let credit = paid;
  const dues: DuePayment[] = [];
  myModules.forEach((m) => {
    const covered = Math.min(credit, m.fee);
    credit -= covered;
    const remaining = m.fee - covered;
    if (remaining <= 0) return;
    const dueDate = toISO(addDays(new Date(), offsets[Math.min(dues.length, offsets.length - 1)]));
    const diff = Math.round((new Date(`${dueDate}T00:00`).getTime() - new Date(`${today}T00:00`).getTime()) / 86400000);
    dues.push({ id: `due_${m.id}`, moduleId: m.id, moduleName: m.name, amount: remaining, dueDate, status: diff < 0 ? "overdue" : diff <= 7 ? "due-soon" : "upcoming" });
  });
  dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    linked: true,
    profile: student,
    modules,
    onlineClasses,
    physicalClasses,
    notices,
    assignments,
    materials,
    recordings,
    payments,
    dues,
    paymentSummary: { totalFees, paid, outstanding, pendingVerification, overdue: dues.filter((x) => x.status === "overdue").reduce((s, x) => s + x.amount, 0) },
    instituteName: INSTITUTE_NAME,
  };
}

export async function getLivePortalData(account: StudentAccount): Promise<StudentPortalData> {
  const d = getSharedData();
  const today = todayISO();
  const nowDT = toLocalDT(new Date());

  // 1. Fetch real student profile from MongoDB by studentId or email
  let student: Student | null = null;
  if (account.studentId) {
    student = await safeFetch<Student>(`/students/${encodeURIComponent(account.studentId)}`);
  }
  if (!student && (account.studentId || account.email)) {
    const lookupCode = account.studentId || account.email;
    student = await safeFetch<Student>(`/students/lookup?code=${encodeURIComponent(lookupCode)}`);
  }
  if (!student && account.email) {
    const list = await safeFetch<Student[] | { data: Student[] }>(`/students?q=${encodeURIComponent(account.email)}`);
    const items = Array.isArray(list) ? list : (list as { data?: Student[] })?.data ?? [];
    student = items.find((s) => s.email.toLowerCase() === account.email.toLowerCase()) ?? null;
  }
  // Fallback to local student record if not found in MongoDB
  if (!student) {
    student = (account.studentId ? d.students.find((s) => s.id === account.studentId) : null) ??
      d.students.find((s) => s.email.toLowerCase() === account.email.toLowerCase()) ?? null;
  }
  if (!student) return emptyPortal();

  // 2. Fetch live modules from MongoDB
  const liveModules = await safeFetch<Module[]>("/modules");
  const modulePool = (Array.isArray(liveModules) && liveModules.length > 0) ? liveModules : (d.modules || []);
  const myModules = (student.moduleIds || [])
    .map((id) => modulePool.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const enrolledIds = new Set(myModules.map((m) => m.id));

  // 3. Fetch live classes from MongoDB
  const liveClasses = await safeFetch<OnlineClass[]>("/online-classes");
  const classPool = Array.isArray(liveClasses) ? liveClasses : (d.classes || []);
  
  // Online classes matching student's enrolled modules or batch
  const onlineClasses = classPool
    .filter((c) => (c.classType === "online" || !c.classType) && (enrolledIds.has(c.moduleId) || (student?.batch && c.batch === student.batch)))
    .sort((a, b) => a.start.localeCompare(b.start));

  // Physical classes matching student's enrolled modules or batch
  let physicalClasses: PhysicalClass[] = classPool
    .filter((c) => c.classType === "physical" && (enrolledIds.has(c.moduleId) || (student?.batch && c.batch === student.batch)))
    .map((c) => ({
      id: c.id,
      moduleId: c.moduleId,
      title: c.title,
      start: c.start,
      end: c.end,
      location: (c as { hall?: string }).hall || (c as { location?: string }).location || "Main Hall",
      status: (c.status as "scheduled" | "completed" | "cancelled") || "scheduled",
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (physicalClasses.length === 0 && myModules.length > 0) {
    physicalClasses = buildPhysicalClasses(myModules);
  }

  // 4. Fetch live notices from MongoDB (filtered by student batch)
  const noticeQuery = student.batch ? `/notices?batch=${encodeURIComponent(student.batch)}` : "/notices";
  const liveNotices = await safeFetch<Notice[]>(noticeQuery);
  const rawNotices: Notice[] = (Array.isArray(liveNotices) && liveNotices.length > 0) ? liveNotices : (d as unknown as { notices?: Notice[] }).notices ?? [];
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const notices = (Array.isArray(rawNotices) ? rawNotices : [])
    .filter((n) => n && n.status === "published" && n.publishDate <= today && n.expiryDate >= today && (!n.batches || n.batches.length === 0 || !student?.batch || n.batches.includes(student.batch)))
    .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || b.publishDate.localeCompare(a.publishDate));

  // 5. Build enriched student modules & recordings
  const assignments = buildAssignments(myModules, student.id);
  const materials = buildMaterials(myModules);

  // Live class recordings: extract any classes with recordingUrl, fallback to completed classes
  const liveRecordings: ClassRecording[] = [];
  onlineClasses.forEach((c) => {
    const recUrl = (c as { recordingUrl?: string }).recordingUrl;
    if (recUrl) {
      liveRecordings.push({
        id: `rec_${c.id}`,
        moduleId: c.moduleId,
        title: c.title,
        date: c.start.slice(0, 10),
        durationMin: (c as { recordingDuration?: number }).recordingDuration || (c.duration ? Math.round(c.duration) : 60),
        videoUrl: recUrl,
      });
    }
  });
  const recordings = liveRecordings.length > 0
    ? liveRecordings.sort((a, b) => b.date.localeCompare(a.date))
    : buildRecordings(onlineClasses).sort((a, b) => b.date.localeCompare(a.date));

  const modules: StudentModule[] = myModules.map((m) => {
    const online = onlineClasses.filter((c) => c.moduleId === m.id);
    const physical = physicalClasses.filter((c) => c.moduleId === m.id);
    const mAssign = assignments.filter((a) => a.moduleId === m.id);
    const upcoming = [
      ...online.filter((c) => c.status === "scheduled" && c.end >= nowDT).map((c) => ({ kind: "online" as const, start: c.start })),
      ...physical.filter((c) => c.status === "scheduled" && c.end >= nowDT).map((c) => ({ kind: "physical" as const, start: c.start })),
    ].sort((a, b) => a.start.localeCompare(b.start));

    const teacher = (m as { teacher?: any }).teacher ?? d.teachers.find((t) => t.id === m.teacherId) ?? null;

    return {
      ...m,
      teacher,
      physicalSchedule: describePattern(physical.slice(0, 1), physical[0]?.location),
      onlineSchedule: describePattern(online.slice(0, 4)),
      nextSession: upcoming[0] ?? null,
      openAssignments: mAssign.filter((a) => a.status === "pending" || a.status === "overdue").length,
      totalAssignments: mAssign.length,
      materialsCount: materials.filter((x) => x.moduleId === m.id).length,
      recordingsCount: recordings.filter((x) => x.moduleId === m.id).length,
    };
  });

  // 6. Payments - Query live from MongoDB
  const livePayments = await safeFetch<any[]>(`/payments?studentId=${encodeURIComponent(student.id)}`);
  const hasLivePayments = Array.isArray(livePayments) && livePayments.length > 0;

  const payments: StudentPayment[] = hasLivePayments
    ? livePayments.map((p) => ({
        id: p.id || p._id,
        receiptNo: p.receiptNo || receiptNo(p.id || "PAY_0", p.date || today),
        date: p.date ? p.date.slice(0, 10) : today,
        description: p.description || `${p.category || "Tuition fees"} - ${student?.fullName || "Student"}`,
        category: p.category || "Tuition fees",
        amount: Number(p.amount) || 0,
        method: p.method || "Cash",
        status: (p.status === "completed" || p.status === "paid") ? ("paid" as const) : ("pending" as const),
      }))
    : (d.transactions || [])
        .filter((t) => t.type === "income" && t.studentId === student.id)
        .map((t) => ({
          id: t.id,
          receiptNo: receiptNo(t.id, t.date),
          date: t.date,
          description: t.description.replace(/\s—\s.*$/, ""),
          category: t.category,
          amount: t.amount,
          method: t.method ?? "Cash",
          status: "paid" as const,
        }));

  // Dynamically compute fees and balance from enrolled modules & confirmed payments
  const totalFees = myModules.reduce((s, m) => s + (Number(m.fee) || 0), 0);
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = Math.max(0, totalFees - paid);

  let pendingVerification = payments.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);
  if (!hasLivePayments && outstanding > 0 && hashStr(student.id) % 2 === 0) {
    pendingVerification = Math.min(outstanding, 15000);
    const date = toISO(addDays(new Date(), -2));
    payments.push({
      id: `pend_${student.id}`,
      receiptNo: "—",
      date,
      description: "Tuition instalment (bank transfer slip uploaded)",
      category: "Tuition fees",
      amount: pendingVerification,
      method: "Bank Transfer",
      status: "pending",
    });
  }
  payments.sort((a, b) => b.date.localeCompare(a.date));

  // Split the unpaid balance into per-module dues
  const h = hashStr(student.id);
  const offsets = [-8 + (h % 16), 12 + (h % 10), 32];
  let credit = paid;
  const dues: DuePayment[] = [];
  myModules.forEach((m) => {
    const fee = Number(m.fee) || 0;
    const covered = Math.min(credit, fee);
    credit -= covered;
    const remaining = fee - covered;
    if (remaining <= 0) return;
    const dueDate = toISO(addDays(new Date(), offsets[Math.min(dues.length, offsets.length - 1)]));
    const diff = Math.round((new Date(`${dueDate}T00:00`).getTime() - new Date(`${today}T00:00`).getTime()) / 86400000);
    dues.push({
      id: `due_${m.id}`,
      moduleId: m.id,
      moduleName: m.name,
      amount: remaining,
      dueDate,
      status: diff < 0 ? "overdue" : diff <= 7 ? "due-soon" : "upcoming",
    });
  });
  dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdue = dues.filter((x) => x.status === "overdue").reduce((s, x) => s + x.amount, 0);

  return {
    linked: true,
    profile: student,
    modules,
    onlineClasses,
    physicalClasses,
    notices,
    assignments,
    materials,
    recordings,
    payments,
    dues,
    paymentSummary: {
      totalFees,
      paid,
      outstanding,
      pendingVerification,
      overdue,
    },
    instituteName: INSTITUTE_NAME,
  };
}
