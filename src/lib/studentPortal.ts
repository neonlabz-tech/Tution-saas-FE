// Assembles everything the Student Portal shows for one student from the shared admin data set.
// Pure function over the mock data today; a backend `GET /student/portal` response would replace it.
import { buildMockData, type MockData } from "@/data/mock";
import { buildAssignments, buildMaterials, buildPhysicalClasses, buildRecordings, describePattern, hashStr } from "@/data/mock/student";
import type { DuePayment, PhysicalClass, StudentAccount, StudentModule, StudentPayment, StudentPortalData } from "@/types/student";
import type { Module, Notice, OnlineClass, Student, StudentAttendanceRecord, StudentAttendanceSummary, StudentDetail } from "@/types";
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
    attendanceSummary: { rate: 0, present: 0, late: 0, absent: 0, excused: 0, total: 0 },
    attendanceRecords: [],
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

  const myAttendance = (d.attendance || []).filter((a) => a.studentId === student.id);
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const r of myAttendance) {
    if (r.status === "present") present += 1;
    else if (r.status === "late") late += 1;
    else if (r.status === "absent") absent += 1;
    else if (r.status === "excused") excused += 1;
  }
  const counted = present + late + absent;
  const rate = counted === 0 ? 0 : Math.round(((present + late) / counted) * 1000) / 10;
  const attendanceSummary: StudentAttendanceSummary = {
    rate,
    present,
    late,
    absent,
    excused,
    total: myAttendance.length,
  };
  const attendanceRecords: StudentAttendanceRecord[] = myAttendance.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    moduleId: a.moduleId,
    moduleName: (d.modules || []).find((m) => m.id === a.moduleId)?.name ?? a.moduleId,
    date: a.date,
    status: a.status as any,
    method: (a.method ?? "manual") as "manual" | "qr",
  }));

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
    attendanceSummary,
    attendanceRecords,
  };
}

export async function getLivePortalData(account: StudentAccount): Promise<StudentPortalData> {
  const d = getSharedData();
  const today = todayISO();
  const nowDT = toLocalDT(new Date());

  // 1. Fetch real student profile from MongoDB by studentId or email
  let studentDetail: StudentDetail | null = null;
  if (account.studentId) {
    studentDetail = await safeFetch<StudentDetail>(`/students/${encodeURIComponent(account.studentId)}`);
  }
  if (!studentDetail && account.email) {
    const list = await safeFetch<Student[] | { data: Student[] }>(`/students?q=${encodeURIComponent(account.email)}`);
    const items = Array.isArray(list) ? list : (list as { data?: Student[] })?.data ?? [];
    const matched = items.find((s) => s.email.toLowerCase() === account.email.toLowerCase()) ?? null;
    if (matched) {
      studentDetail = await safeFetch<StudentDetail>(`/students/${encodeURIComponent(matched.id)}`);
    }
  }

  // Fallback to local student record if not found in MongoDB
  const mockStudent = (!studentDetail)
    ? ((account.studentId ? d.students.find((s) => s.id === account.studentId) : null) ??
       d.students.find((s) => s.email.toLowerCase() === account.email.toLowerCase()) ?? null)
    : null;

  const student = studentDetail ?? mockStudent;
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

  // 5. Build enriched student modules
  const assignments = buildAssignments(myModules, student.id);
  const materials = buildMaterials(myModules);
  const recordings = buildRecordings(onlineClasses).sort((a, b) => b.date.localeCompare(a.date));

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

  // 6. Payments and Financial Calculations
  let payments: StudentPayment[] = [];
  if (studentDetail?.payments && studentDetail.payments.length > 0) {
    payments = studentDetail.payments.map((t) => ({
      id: t.id,
      receiptNo: receiptNo(t.id, t.date),
      date: t.date,
      description: t.description ? t.description.replace(/\s—\s.*$/, "") : "Tuition fee payment",
      category: t.category,
      amount: t.amount,
      method: t.method ?? "Cash",
      status: "paid" as const,
    })).sort((a, b) => b.date.localeCompare(a.date));
  } else if (!studentDetail) {
    payments = (d.transactions || [])
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
  }

  const computedTotalFees = myModules.reduce((s, m) => s + (m.fee || 0), 0);
  const totalFees = (studentDetail && typeof studentDetail.feeTotal === "number")
    ? studentDetail.feeTotal
    : (computedTotalFees > 0 ? computedTotalFees : feeOf(d, student.moduleIds));

  const computedPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const paid = (studentDetail && typeof studentDetail.paidTotal === "number")
    ? studentDetail.paidTotal
    : (computedPaid > 0 ? computedPaid : tuitionPaid(d, student.id));

  const outstanding = (studentDetail && typeof studentDetail.outstanding === "number")
    ? studentDetail.outstanding
    : Math.max(0, totalFees - paid);

  let pendingVerification = 0;
  if (!studentDetail && outstanding > 0 && hashStr(student.id) % 2 === 0) {
    pendingVerification = Math.min(outstanding, 15000);
    const date = toISO(addDays(new Date(), -2));
    payments.push({ id: `pend_${student.id}`, receiptNo: "—", date, description: "Tuition instalment (bank transfer slip uploaded)", category: "Tuition fees", amount: pendingVerification, method: "Bank Transfer", status: "pending" });
  }
  payments.sort((a, b) => b.date.localeCompare(a.date));

  // 7. Dues calculation
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

  // 8. Attendance Summary & Records
  let attendanceSummary: StudentAttendanceSummary;
  let attendanceRecords: StudentAttendanceRecord[] = [];

  if (studentDetail?.attendanceSummary) {
    const att = studentDetail.attendanceSummary;
    attendanceSummary = {
      rate: att.rate ?? 0,
      present: att.present ?? 0,
      late: att.late ?? 0,
      absent: att.absent ?? 0,
      excused: att.excused ?? 0,
      total: (att.present ?? 0) + (att.late ?? 0) + (att.absent ?? 0) + (att.excused ?? 0),
    };
    attendanceRecords = studentDetail.attendanceRecords ?? [];
  } else {
    const myAttendance = (d.attendance || []).filter((a) => a.studentId === student.id);
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    for (const r of myAttendance) {
      if (r.status === "present") present += 1;
      else if (r.status === "late") late += 1;
      else if (r.status === "absent") absent += 1;
      else if (r.status === "excused") excused += 1;
    }
    const counted = present + late + absent;
    const rate = counted === 0 ? 0 : Math.round(((present + late) / counted) * 1000) / 10;
    attendanceSummary = {
      rate,
      present,
      late,
      absent,
      excused,
      total: myAttendance.length,
    };
    attendanceRecords = myAttendance.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      moduleId: a.moduleId,
      moduleName: (d.modules || []).find((m) => m.id === a.moduleId)?.name ?? a.moduleId,
      date: a.date,
      status: a.status as any,
      method: (a.method ?? "manual") as "manual" | "qr",
    }));
  }

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
      overdue: dues.filter((x) => x.status === "overdue").reduce((s, x) => s + x.amount, 0),
    },
    instituteName: INSTITUTE_NAME,
    attendanceSummary,
    attendanceRecords,
  };
}
