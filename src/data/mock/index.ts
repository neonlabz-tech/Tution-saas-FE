import type {
  AttendanceRecord,
  AttendanceStatus,
  Module,
  Notice,
  OnlineClass,
  Student,
  Teacher,
  Transaction,
} from "@/types";
import { addDays, makeRef, pad, toISO, toLocalDT, parseISO, diffDays } from "@/lib/utils";

export const BATCHES = ["2025-A Morning", "2025-B Evening", "2026-A Weekend", "2026-B Morning"];
export const INCOME_CATEGORIES = ["Tuition fees", "Registration fees", "Exam fees", "Other income"];
export const EXPENSE_CATEGORIES = [
  "Electricity bills",
  "Lecturer fees",
  "Internet bills",
  "Rent",
  "Equipment",
  "Maintenance",
  "Other expenses",
];
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Card (front desk)"];

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODULE_SEED: Omit<Module, "teacherId">[] = [
  { id: "mod_mth", code: "MTH-101", name: "Advanced Mathematics", description: "Calculus, algebra and structured problem-solving for exam excellence.", fee: 72000, duration: "6 months", batches: [BATCHES[0], BATCHES[1], BATCHES[3]], status: "active" },
  { id: "mod_phy", code: "PHY-102", name: "Physics", description: "Mechanics, waves, electricity and modern physics with weekly labs.", fee: 68000, duration: "6 months", batches: [BATCHES[0], BATCHES[1]], status: "active" },
  { id: "mod_che", code: "CHE-103", name: "Chemistry", description: "Organic, inorganic and physical chemistry with practical sessions.", fee: 66000, duration: "6 months", batches: [BATCHES[1], BATCHES[2]], status: "active" },
  { id: "mod_bio", code: "BIO-104", name: "Biology", description: "Cell biology, genetics, human physiology and ecology.", fee: 64000, duration: "6 months", batches: [BATCHES[0], BATCHES[2], BATCHES[3]], status: "active" },
  { id: "mod_eng", code: "ENG-105", name: "Spoken English", description: "Confidence-building conversation, writing and presentation skills.", fee: 48000, duration: "4 months", batches: BATCHES, status: "active" },
  { id: "mod_ict", code: "ICT-106", name: "ICT & Programming", description: "Programming fundamentals, databases and web development projects.", fee: 78000, duration: "8 months", batches: [BATCHES[2], BATCHES[3]], status: "active" },
  { id: "mod_acc", code: "ACC-107", name: "Accounting", description: "Financial accounting, costing and business statements.", fee: 60000, duration: "6 months", batches: [BATCHES[1], BATCHES[3]], status: "active" },
  { id: "mod_eco", code: "ECO-108", name: "Economics", description: "Micro and macroeconomics with real-world case studies.", fee: 56000, duration: "5 months", batches: [BATCHES[0], BATCHES[2]], status: "upcoming" },
];

const SESSION_DOWS = [[1, 3], [2, 4], [1, 4], [2, 5], [3, 5], [1, 3], [2, 4], [3, 5]];
const SLOTS = ["08:30", "10:30", "14:00", "16:00", "18:00", "19:30"];

const TEACHER_SEED: Omit<Teacher, "batches">[] = [
  { id: "TCH-001", fullName: "Dr. Anura Wijesekara", email: "anura.w@eduflow.lk", phone: "0771234501", qualification: "PhD in Mathematics", specialization: "Calculus & Algebra", joiningDate: "2019-02-11", status: "active" },
  { id: "TCH-002", fullName: "Ms. Priyanka Jayawardena", email: "priyanka.j@eduflow.lk", phone: "0771234502", qualification: "MSc in Physics", specialization: "Mechanics & Waves", joiningDate: "2020-06-01", status: "active" },
  { id: "TCH-003", fullName: "Mr. Saman Kumara", email: "saman.k@eduflow.lk", phone: "0771234503", qualification: "BSc (Hons) Chemistry", specialization: "Organic Chemistry", joiningDate: "2021-01-18", status: "active" },
  { id: "TCH-004", fullName: "Dr. Nilmini Rodrigo", email: "nilmini.r@eduflow.lk", phone: "0771234504", qualification: "PhD in Molecular Biology", specialization: "Genetics", joiningDate: "2018-09-03", status: "active" },
  { id: "TCH-005", fullName: "Ms. Hasini de Mel", email: "hasini.d@eduflow.lk", phone: "0771234505", qualification: "MA in English Literature", specialization: "Communication Skills", joiningDate: "2022-03-14", status: "active" },
  { id: "TCH-006", fullName: "Mr. Rohan Peiris", email: "rohan.p@eduflow.lk", phone: "0771234506", qualification: "BSc in Software Engineering", specialization: "Web & Databases", joiningDate: "2022-08-22", status: "active" },
  { id: "TCH-007", fullName: "Mrs. Chathuri Amarasinghe", email: "chathuri.a@eduflow.lk", phone: "0771234507", qualification: "ACA, MBA", specialization: "Financial Accounting", joiningDate: "2020-11-09", status: "active" },
  { id: "TCH-008", fullName: "Mr. Kalum Ranasinghe", email: "kalum.r@eduflow.lk", phone: "0771234508", qualification: "MSc in Economics", specialization: "Macroeconomics", joiningDate: "2023-01-30", status: "on-leave" },
];

const FIRST = ["Nimal", "Kasun", "Dilani", "Sachini", "Tharindu", "Ishara", "Ruwan", "Amaya", "Chamath", "Nethmi", "Lahiru", "Sanduni", "Pasindu", "Hiruni", "Dineth", "Oshadi", "Vihanga", "Thisaru", "Kavindi", "Ravindu", "Malsha", "Yasiru", "Senuri", "Dasun"];
const LAST = ["Perera", "Fernando", "Silva", "Jayasinghe", "Wickramasinghe", "Gunawardena", "Rathnayake", "Bandara", "Dissanayake", "Herath", "Karunaratne", "Senanayake", "Abeysekera", "Weerasinghe", "Pathirana", "Samarasinghe"];
const STREETS = ["Temple Road", "Galle Road", "Lake View Avenue", "Kandy Road", "Station Lane", "Hospital Road", "Main Street", "Park Avenue"];
const CITIES = ["Colombo 07", "Nugegoda", "Kandy", "Galle", "Kotte", "Dehiwala", "Gampaha", "Negombo", "Matara"];

export interface MockData {
  students: Student[];
  teachers: Teacher[];
  modules: Module[];
  attendance: AttendanceRecord[];
  transactions: Transaction[];
  classes: OnlineClass[];
  notices: Notice[];
}

export function buildMockData(): MockData {
  const rand = rng(20260);
  const int = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const today = new Date();
  const todayStr = toISO(today);

  // Modules & teachers
  const modules: Module[] = MODULE_SEED.map((m, i) => ({ ...m, teacherId: TEACHER_SEED[i].id }));
  const teachers: Teacher[] = TEACHER_SEED.map((t, i) => ({ ...t, batches: MODULE_SEED[i].batches }));

  // Students
  const students: Student[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 58; i++) {
    let name = "";
    do name = `${pick(FIRST)} ${pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    const batch = BATCHES[i % 4];
    const candidates = modules.filter((m) => m.batches.includes(batch));
    const count = Math.min(candidates.length, int(2, 3));
    const chosen: string[] = [];
    const pool = [...candidates];
    while (chosen.length < count) chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
    const enroll = addDays(today, -int(5, 330));
    const last = name.split(" ")[1];
    const r = rand();
    students.push({
      id: `STU-${enroll.getFullYear()}-${pad(i + 1).padStart(3, "0")}`,
      ref: makeRefSeeded(rand),
      fullName: name,
      email: `${name.toLowerCase().replace(" ", ".")}@mail.lk`,
      phone: `07${int(10000000, 79999999)}`,
      dob: `${int(2005, 2009)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
      address: `${int(4, 180)}, ${pick(STREETS)}, ${pick(CITIES)}`,
      guardianName: `${pick(["Mr.", "Mrs."])} ${pick(FIRST)} ${last}`,
      guardianPhone: `07${int(10000000, 79999999)}`,
      batch,
      moduleIds: chosen,
      enrollmentDate: toISO(enroll),
      status: r < 0.86 ? "active" : r < 0.94 ? "inactive" : "graduated",
    });
  }
  students.sort((a, b) => a.enrollmentDate.localeCompare(b.enrollmentDate));
  students.forEach((s, i) => (s.id = `STU-${s.enrollmentDate.slice(0, 4)}-${String(i + 1).padStart(3, "0")}`));

  // Attendance (last 60 days)
  const attendance: AttendanceRecord[] = [];
  const statuses: AttendanceStatus[] = ["present", "late", "absent", "excused"];
  for (let d = 60; d >= 0; d--) {
    const day = addDays(today, -d);
    const iso = toISO(day);
    modules.forEach((m, mi) => {
      const isSession = SESSION_DOWS[mi].includes(day.getDay()) || d === 0;
      if (!isSession) return;
      students.forEach((s) => {
        if (!s.moduleIds.includes(m.id) || s.enrollmentDate > iso) return;
        if (d === 0 && rand() < 0.25) return; // some unmarked today
        const r = rand();
        const status = r < 0.78 ? statuses[0] : r < 0.86 ? statuses[1] : r < 0.95 ? statuses[2] : statuses[3];
        attendance.push({ id: `att_${s.id}_${m.id}_${iso}`, studentId: s.id, moduleId: m.id, date: iso, status, method: rand() < 0.4 ? "qr" : "manual" });
      });
    });
  }

  // Transactions
  const tx: Transaction[] = [];
  let n = 1;
  const feeOf = (s: Student) => s.moduleIds.reduce((sum, id) => sum + (modules.find((m) => m.id === id)?.fee ?? 0), 0);
  students.forEach((s) => {
    tx.push({ id: `tx_${n++}`, type: "income", category: "Registration fees", amount: 2500, date: s.enrollmentDate, description: `Registration fee — ${s.fullName}`, studentId: s.id, method: pick(PAYMENT_METHODS) });
    const total = feeOf(s);
    const r = rand();
    const frac = r < 0.22 ? 1 : r < 0.3 ? 0.15 : 0.35 + rand() * 0.6;
    const paid = Math.round((total * frac) / 500) * 500;
    const installments = frac === 1 ? int(2, 4) : int(1, 3);
    let remaining = paid;
    for (let k = 0; k < installments && remaining > 0; k++) {
      const amt = k === installments - 1 ? remaining : Math.min(remaining, Math.round((paid / installments / 500) * (0.8 + rand() * 0.4)) * 500);
      const date = addDays(s.enrollmentDate, 3 + k * 30 + int(0, 6));
      if (date > today) continue;
      remaining -= amt;
      tx.push({ id: `tx_${n++}`, type: "income", category: "Tuition fees", amount: amt, date: toISO(date), description: `Tuition instalment ${k + 1} — ${s.fullName}`, studentId: s.id, method: pick(PAYMENT_METHODS) });
    }
  });
  for (let m = 11; m >= 0; m--) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const mk = (day: number) => {
      const d = new Date(base.getFullYear(), base.getMonth(), day);
      return d > today ? todayStr : toISO(d);
    };
    const add = (type: "income" | "expense", category: string, amount: number, day: number, description: string) =>
      tx.push({ id: `tx_${n++}`, type, category, amount: Math.round(amount / 100) * 100, date: mk(day), description, method: type === "income" ? "Bank Transfer" : pick(["Bank Transfer", "Cash"]) });
    add("income", "Other income", 8000 + rand() * 14000, 12, "Hall rental & stationery sales");
    if (m % 3 === 0) add("income", "Exam fees", 38000 + rand() * 24000, 20, "Term examination fee collection");
    add("expense", "Rent", 85000, 2, "Monthly premises rent");
    add("expense", "Electricity bills", 17000 + rand() * 9000, 8, "CEB electricity bill");
    add("expense", "Internet bills", 9500, 9, "Fibre internet subscription");
    add("expense", "Lecturer fees", 300000 + rand() * 45000, 25, "Monthly lecturer payouts");
    add("expense", "Other expenses", 5000 + rand() * 12000, 15, "Refreshments & printing");
    if (m % 4 === 1) add("expense", "Equipment", 25000 + rand() * 60000, 17, "Projector, whiteboards & lab kits");
    if (m % 3 === 2) add("expense", "Maintenance", 12000 + rand() * 25000, 21, "AC servicing & repairs");
  }
  const transactions = tx.sort((a, b) => b.date.localeCompare(a.date));

  // Online classes (−14 to +21 days)
  const topics = ["Weekly Lecture", "Problem Solving Clinic", "Revision Session", "Model Paper Discussion"];
  const classes: OnlineClass[] = [];
  let c = 1;
  modules.forEach((m, mi) => {
    for (let d = -14; d <= 21; d++) {
      const day = addDays(today, d);
      if (!SESSION_DOWS[mi].includes(day.getDay())) continue;
      const [h, min] = SLOTS[mi % SLOTS.length].split(":").map(Number);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
      const end = new Date(start.getTime() + 90 * 60000);
      const past = end < today;
      classes.push({
        id: `cls_${c++}`,
        title: `${m.name}: ${topics[(c + mi) % topics.length]}`,
        moduleId: m.id,
        teacherId: m.teacherId!,
        batch: m.batches[c % m.batches.length],
        start: toLocalDT(start),
        end: toLocalDT(end),
        link: `https://meet.example.com/eduflow-${m.code.toLowerCase()}`,
        description: "Join with your student ID ready. Recording will be shared after the session.",
        status: past ? "completed" : rand() < 0.05 ? "cancelled" : "scheduled",
      });
    }
  });

  const D = (n2: number) => toISO(addDays(today, n2));
  const notices: Notice[] = [
    { id: "ntc_1", title: "Today's class has been cancelled", description: "Due to unforeseen circumstances, the evening Physics class scheduled for today is cancelled. A make-up session will be announced shortly.", batches: [BATCHES[0], BATCHES[1]], publishDate: D(0), expiryDate: D(1), priority: "high", status: "published" },
    { id: "ntc_2", title: "The exam has been postponed until next week", description: "The Term 2 mock examination is now scheduled for next Saturday. Please collect the revised timetable from the front desk.", batches: [], publishDate: D(-1), expiryDate: D(9), priority: "high", status: "published" },
    { id: "ntc_3", title: "A new online class schedule is available", description: "The updated weekly online class timetable is live on the Online Classes page. Check your batch and module for changes.", batches: [], publishDate: D(-2), expiryDate: D(14), priority: "medium", status: "published" },
    { id: "ntc_4", title: "Fee payment reminder", description: "Students with outstanding balances are kindly requested to settle instalments before the end of this month.", batches: [BATCHES[1], BATCHES[3]], publishDate: D(-4), expiryDate: D(12), priority: "medium", status: "published" },
    { id: "ntc_5", title: "Weekend ICT lab orientation", description: "New weekend batch students are invited to a lab orientation on Saturday at 9:00 AM.", batches: [BATCHES[2]], publishDate: D(-3), expiryDate: D(5), priority: "low", status: "published" },
    { id: "ntc_6", title: "Institute holiday — Poya day", description: "The institute will remain closed for the Poya holiday. All classes will resume next day.", batches: [], publishDate: D(-20), expiryDate: D(-12), priority: "low", status: "published" },
    { id: "ntc_7", title: "Parent–teacher meeting", description: "Parent–teacher meetings for the 2025-A Morning batch. Slot bookings open at the front desk.", batches: [BATCHES[0]], publishDate: D(-25), expiryDate: D(-6), priority: "medium", status: "published" },
    { id: "ntc_8", title: "Scholarship programme announcement (draft)", description: "Details of the merit scholarship programme are being finalised and will be published soon.", batches: [], publishDate: D(3), expiryDate: D(30), priority: "low", status: "draft" },
  ];

  return { students, teachers, modules, attendance, transactions, classes, notices };
}

function makeRefSeeded(rand: () => number): string {
  let s = "";
  while (s.length < 16) s += Math.floor(rand() * 36).toString(36);
  return s;
}

export function daysSince(iso: string) {
  return diffDays(iso, toISO(new Date()));
}
export { parseISO };
export { makeRef };
