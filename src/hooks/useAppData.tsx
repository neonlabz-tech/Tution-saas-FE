import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { buildMockData } from "@/data/mock";
import { useAuth } from "@/hooks/useAuth";
import { notificationsApi, teachersApi, type TeacherListItem, type TeachersMetrics } from "@/lib/api";
import { makeRef, todayISO, uid } from "@/lib/utils";

type SaveStudent = Omit<Student, "id" | "ref">;
type SaveTeacher = Omit<Teacher, "id">;
type SaveModule = Omit<Module, "id">;

interface PaymentInput {
  studentId: string;
  amount: number;
  method: string;
  note?: string;
  date?: string;
}

interface AppData {
  students: Student[];
  teachers: TeacherListItem[];
  teacherMetrics: TeachersMetrics;
  teachersLoading: boolean;
  refreshTeachers: () => Promise<void>;
  modules: Module[];
  attendance: AttendanceRecord[];
  transactions: Transaction[];
  classes: OnlineClass[];
  notices: Notice[];

  getStudent: (id: string) => Student | undefined;
  getTeacher: (id: string | null | undefined) => Teacher | undefined;
  getModule: (id: string) => Module | undefined;
  teacherModules: (teacherId: string) => Module[];
  moduleStudents: (moduleId: string) => Student[];
  feeTotal: (studentId: string) => number;
  paidTotal: (studentId: string) => number;
  outstanding: (studentId: string) => number;

  saveStudent: (data: SaveStudent, id?: string) => Student;
  deleteStudent: (id: string) => void;
  saveTeacher: (data: SaveTeacher, moduleIds: string[], id?: string) => Promise<Teacher>;
  deleteTeacher: (id: string) => Promise<void>;
  saveModule: (data: SaveModule, id?: string) => Module;
  deleteModule: (id: string) => void;
  setModuleStudents: (moduleId: string, studentIds: string[]) => void;
  markAttendance: (studentId: string, moduleId: string, date: string, status: AttendanceStatus, method?: "manual" | "qr") => "created" | "updated";
  saveTransaction: (data: Omit<Transaction, "id">, id?: string) => Transaction;
  deleteTransaction: (id: string) => void;
  recordPayment: (p: PaymentInput) => Transaction;
  saveClass: (data: Omit<OnlineClass, "id">, id?: string) => OnlineClass;
  patchClass: (id: string, patch: Partial<OnlineClass>) => void;
  deleteClass: (id: string) => void;
  saveNotice: (data: Omit<Notice, "id">, id?: string) => Notice;
  deleteNotice: (id: string) => void;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [seed] = useState(buildMockData);
  const [students, setStudents] = useState(seed.students);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [teacherMetrics, setTeacherMetrics] = useState<TeachersMetrics>({
    totalTeachers: 0,
    activeTeachers: 0,
    weeklyTeachingHours: 0,
    teachersWithoutModules: 0,
  });
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [modules, setModules] = useState(() => seed.modules.map((m) => ({ ...m, teacherId: null as string | null })));
  const [attendance, setAttendance] = useState(seed.attendance);
  const [transactions, setTransactions] = useState(seed.transactions);
  const [classes, setClasses] = useState(seed.classes);
  const [notices, setNotices] = useState(seed.notices);

  const refreshTeachers = useCallback(async () => {
    if (!user) {
      setTeachers([]);
      return;
    }
    setTeachersLoading(true);
    try {
      const res = await teachersApi.list();
      const moduleToTeacher = new Map<string, string>();
      for (const teacher of res.data) {
        const ids =
          teacher.assignedModules.length > 0
            ? teacher.assignedModules.map((m) => m.id)
            : (teacher.moduleIds ?? []);
        for (const modId of ids) {
          moduleToTeacher.set(modId, teacher.id);
        }
      }
      setTeachers(res.data);
      setTeacherMetrics(res.metrics);
      setModules((prev) => prev.map((m) => ({ ...m, teacherId: moduleToTeacher.get(m.id) ?? null })));
    } finally {
      setTeachersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTeachers([]);
      return;
    }
    void refreshTeachers().catch(() => {
      /* backend offline; keep empty state */
    });
  }, [user, refreshTeachers]);

  const feeMap = useMemo(() => {
    const fees = new Map(modules.map((m) => [m.id, m.fee]));
    return new Map(students.map((s) => [s.id, s.moduleIds.reduce((sum, id) => sum + (fees.get(id) ?? 0), 0)]));
  }, [students, modules]);
  const paidMap = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.type === "income" && t.category === "Tuition fees" && t.studentId) m.set(t.studentId, (m.get(t.studentId) ?? 0) + t.amount);
    });
    return m;
  }, [transactions]);

  const value = useMemo<AppData>(() => {
    const feeTotal = (id: string) => feeMap.get(id) ?? 0;
    const paidTotal = (id: string) => paidMap.get(id) ?? 0;
    const upsert = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>, item: T, exists: boolean) =>
      set((p) => (exists ? p.map((x) => (x.id === item.id ? item : x)) : [item, ...p]));

    return {
      students, teachers, teacherMetrics, teachersLoading, refreshTeachers, modules, attendance, transactions, classes, notices,
      getStudent: (id) => students.find((s) => s.id === id),
      getTeacher: (id) => (id ? teachers.find((t) => t.id === id) : undefined),
      getModule: (id) => modules.find((m) => m.id === id),
      teacherModules: (tid) => modules.filter((m) => m.teacherId === tid),
      moduleStudents: (mid) => students.filter((s) => s.moduleIds.includes(mid)),
      feeTotal,
      paidTotal,
      outstanding: (id) => Math.max(0, feeTotal(id) - paidTotal(id)),

      saveStudent: (data, id) => {
        if (id) {
          const old = students.find((s) => s.id === id)!;
          const item = { ...old, ...data };
          upsert(setStudents, item, true);
          return item;
        }
        const year = new Date().getFullYear();
        const n = students.reduce((mx, s) => Math.max(mx, Number(s.id.split("-")[2]) || 0), 0) + 1;
        const item: Student = { ...data, id: `STU-${year}-${String(n).padStart(3, "0")}`, ref: makeRef() };
        upsert(setStudents, item, false);

        void notificationsApi
          .create({
            type: "student",
            title: `New Student Registration: ${item.fullName}`,
            subtitle: `Enrolled in ${item.batch || "batch"} (${item.id})`,
            link: "/dashboard/students",
          })
          .catch(() => {});

        return item;
      },
      deleteStudent: (id) => {
        setStudents((p) => p.filter((s) => s.id !== id));
        setAttendance((p) => p.filter((a) => a.studentId !== id));
      },

      saveTeacher: async (data, moduleIds, id) => {
        const saved = id
          ? await teachersApi.update(id, { ...data, moduleIds })
          : await teachersApi.create({ ...data, moduleIds });
        await refreshTeachers();
        return saved;
      },
      deleteTeacher: async (id) => {
        await teachersApi.remove(id);
        setClasses((p) => p.filter((c) => c.teacherId !== id));
        await refreshTeachers();
      },

      saveModule: (data, id) => {
        const item: Module = { ...data, id: id ?? uid("mod") };
        upsert(setModules, item, !!id);
        return item;
      },
      deleteModule: (id) => {
        setModules((p) => p.filter((m) => m.id !== id));
        setStudents((p) => p.map((s) => ({ ...s, moduleIds: s.moduleIds.filter((m) => m !== id) })));
        setClasses((p) => p.filter((c) => c.moduleId !== id));
        setAttendance((p) => p.filter((a) => a.moduleId !== id));
      },
      setModuleStudents: (mid, ids) =>
        setStudents((p) =>
          p.map((s) => {
            const has = s.moduleIds.includes(mid);
            const should = ids.includes(s.id);
            if (has === should) return s;
            return { ...s, moduleIds: should ? [...s.moduleIds, mid] : s.moduleIds.filter((m) => m !== mid) };
          }),
        ),

      markAttendance: (studentId, moduleId, date, status, method = "manual") => {
        const key = `att_${studentId}_${moduleId}_${date}`;
        const exists = attendance.some((a) => a.id === key);
        setAttendance((p) =>
          p.some((a) => a.id === key)
            ? p.map((a) => (a.id === key ? { ...a, status, method } : a))
            : [...p, { id: key, studentId, moduleId, date, status, method }],
        );
        return exists ? "updated" : "created";
      },

      saveTransaction: (data, id) => {
        const item: Transaction = { ...data, id: id ?? uid("tx") };
        upsert(setTransactions, item, !!id);
        setTransactions((p) => [...p].sort((a, b) => b.date.localeCompare(a.date)));
        return item;
      },
      deleteTransaction: (id) => setTransactions((p) => p.filter((t) => t.id !== id)),
      recordPayment: ({ studentId, amount, method, note, date }) => {
        const s = students.find((x) => x.id === studentId);
        const item: Transaction = {
          id: uid("tx"),
          type: "income",
          category: "Tuition fees",
          amount,
          date: date ?? todayISO(),
          description: note?.trim() ? `${note.trim()} — ${s?.fullName ?? ""}` : `Tuition payment — ${s?.fullName ?? ""}`,
          studentId,
          method,
        };
        setTransactions((p) => [item, ...p].sort((a, b) => b.date.localeCompare(a.date)));

        void notificationsApi
          .create({
            type: "payment",
            title: `Payment received: LKR ${amount.toLocaleString()}`,
            subtitle: `${s ? s.fullName : "Student"} · ${method ? method.toUpperCase() : "Cash"}${note ? ` (${note})` : ""}`,
            link: "/dashboard/finance",
          })
          .catch(() => {});

        return item;
      },

      saveClass: (data, id) => {
        const item: OnlineClass = { ...data, id: id ?? uid("cls") };
        upsert(setClasses, item, !!id);
        return item;
      },
      patchClass: (id, patch) => setClasses((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      deleteClass: (id) => setClasses((p) => p.filter((c) => c.id !== id)),

      saveNotice: (data, id) => {
        const item: Notice = { ...data, id: id ?? uid("ntc") };
        upsert(setNotices, item, !!id);
        return item;
      },
      deleteNotice: (id) => setNotices((p) => p.filter((n) => n.id !== id)),
    };
  }, [students, teachers, teacherMetrics, teachersLoading, refreshTeachers, modules, attendance, transactions, classes, notices, feeMap, paidMap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}
