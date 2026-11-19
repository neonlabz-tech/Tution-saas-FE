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
import { attendanceApi, modulesApi, notificationsApi, teachersApi, type TeacherListItem, type TeachersMetrics } from "@/lib/api";
import { createStudent, deleteStudent as deleteStudentApi, listStudents, updateStudent } from "@/api/students";
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
  studentsLoading: boolean;
  refreshStudents: () => Promise<void>;
  teachers: TeacherListItem[];
  teacherMetrics: TeachersMetrics;
  teachersLoading: boolean;
  refreshTeachers: () => Promise<void>;
  modules: Module[];
  modulesLoading: boolean;
  refreshModules: () => Promise<void>;
  attendance: AttendanceRecord[];
  attendanceLoading: boolean;
  refreshAttendance: () => Promise<void>;
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

  saveStudent: (data: SaveStudent, id?: string) => Promise<Student>;
  deleteStudent: (id: string) => Promise<void>;
  saveTeacher: (data: SaveTeacher, moduleIds: string[], id?: string) => Promise<Teacher>;
  deleteTeacher: (id: string) => Promise<void>;
  saveModule: (data: SaveModule, id?: string) => Promise<Module>;
  deleteModule: (id: string) => Promise<void>;
  setModuleStudents: (moduleId: string, studentIds: string[]) => Promise<void>;
  markAttendance: (studentId: string, moduleId: string, date: string, status: AttendanceStatus, method?: "manual" | "qr") => "created" | "updated";
  bulkMarkAttendance: (date: string, moduleId?: string, batch?: string, status?: AttendanceStatus) => Promise<number>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
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
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [teacherMetrics, setTeacherMetrics] = useState<TeachersMetrics>({
    totalTeachers: 0,
    activeTeachers: 0,
    inactiveTeachers: 0,
    teachersWithoutModules: 0,
  });
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [attendance, setAttendance] = useState(seed.attendance);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
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
      setTeachers(res.data);
      setTeacherMetrics(res.metrics);
    } catch {
      /* backend offline; keep current state */
    } finally {
      setTeachersLoading(false);
    }
  }, [user]);

  const refreshModules = useCallback(async () => {
    if (!user) {
      setModules([]);
      return;
    }
    setModulesLoading(true);
    try {
      const list = await modulesApi.list();
      setModules(list);
    } catch {
      /* backend offline; keep current state */
    } finally {
      setModulesLoading(false);
    }
  }, [user]);

  const refreshAttendance = useCallback(async () => {
    if (!user) return;
    setAttendanceLoading(true);
    try {
      const serverRecords = await attendanceApi.listRecords({ limit: 1000 });
      if (Array.isArray(serverRecords) && serverRecords.length > 0) {
        setAttendance((local) => {
          const map = new Map<string, AttendanceRecord>();
          local.forEach((a) => map.set(a.id, a));
          serverRecords.forEach((a) => map.set(a.id, a));
          return Array.from(map.values());
        });
      }
    } catch {
      /* backend offline; retain mock attendance */
    } finally {
      setAttendanceLoading(false);
    }
  }, [user]);

  const refreshStudents = useCallback(async () => {
    if (!user) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    try {
      const res = await listStudents({ limit: 100, page: 1 });
      if (res?.items && Array.isArray(res.items)) {
        let allItems = [...res.items];
        if (res.pagination?.totalPages && res.pagination.totalPages > 1) {
          const remainingPromises = [];
          for (let p = 2; p <= res.pagination.totalPages; p++) {
            remainingPromises.push(listStudents({ limit: 100, page: p }));
          }
          const pages = await Promise.all(remainingPromises);
          pages.forEach((pageRes) => {
            if (pageRes?.items) allItems = allItems.concat(pageRes.items);
          });
        }

        if (allItems.length > 0) {
          const mapped: Student[] = allItems.map((item) => ({
            id: item.id,
            ref: item.ref,
            fullName: item.fullName,
            email: item.email,
            phone: item.phone,
            dob: item.dob,
            address: item.address,
            guardianName: item.guardianName,
            guardianPhone: item.guardianPhone,
            batch: item.batch,
            moduleIds: item.moduleIds ?? (item.modules?.map((m) => m.id) ?? []),
            enrollmentDate: item.enrollmentDate,
            status: item.status,
          }));
          setStudents(mapped);
        }
      }
    } catch {
      /* backend offline; retain mock or current students */
    } finally {
      setStudentsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTeachers([]);
      setModules([]);
      setStudents([]);
      return;
    }
    void Promise.allSettled([refreshTeachers(), refreshModules(), refreshAttendance(), refreshStudents()]);
  }, [user, refreshTeachers, refreshModules, refreshAttendance, refreshStudents]);

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
      students, studentsLoading, refreshStudents, teachers, teacherMetrics, teachersLoading, refreshTeachers, modules, modulesLoading, refreshModules, attendance, attendanceLoading, refreshAttendance, transactions, classes, notices,
      getStudent: (id) => students.find((s) => s.id === id),
      getTeacher: (id) => (id ? teachers.find((t) => t.id === id) : undefined),
      getModule: (id) => modules.find((m) => m.id === id),
      teacherModules: (tid) => modules.filter((m) => m.teacherId === tid),
      moduleStudents: (mid) => students.filter((s) => s.moduleIds.includes(mid)),
      feeTotal,
      paidTotal,
      outstanding: (id) => Math.max(0, feeTotal(id) - paidTotal(id)),

      saveStudent: async (data, id) => {
        if (id) {
          try {
            const updated = await updateStudent(id, {
              fullName: data.fullName,
              email: data.email,
              phone: data.phone,
              dob: data.dob,
              address: data.address,
              guardianName: data.guardianName,
              guardianPhone: data.guardianPhone,
              batch: data.batch,
              moduleIds: data.moduleIds,
              enrollmentDate: data.enrollmentDate,
              status: data.status,
            });
            const item: Student = {
              id: updated.id,
              ref: updated.ref,
              fullName: updated.fullName,
              email: updated.email,
              phone: updated.phone,
              dob: updated.dob,
              address: updated.address,
              guardianName: updated.guardianName,
              guardianPhone: updated.guardianPhone,
              batch: updated.batch,
              moduleIds: updated.moduleIds ?? [],
              enrollmentDate: updated.enrollmentDate,
              status: updated.status,
            };
            upsert(setStudents, item, true);
            return item;
          } catch {
            const old = students.find((s) => s.id === id)!;
            const item = { ...old, ...data };
            upsert(setStudents, item, true);
            return item;
          }
        }

        try {
          const created = await createStudent({
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            dob: data.dob,
            address: data.address,
            guardianName: data.guardianName,
            guardianPhone: data.guardianPhone,
            batch: data.batch,
            moduleIds: data.moduleIds,
            enrollmentDate: data.enrollmentDate,
            status: data.status,
          });
          const item: Student = {
            id: created.id,
            ref: created.ref,
            fullName: created.fullName,
            email: created.email,
            phone: created.phone,
            dob: created.dob,
            address: created.address,
            guardianName: created.guardianName,
            guardianPhone: created.guardianPhone,
            batch: created.batch,
            moduleIds: created.moduleIds ?? [],
            enrollmentDate: created.enrollmentDate,
            status: created.status,
          };
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
        } catch {
          const year = new Date().getFullYear();
          const n = students.reduce((mx, s) => Math.max(mx, Number(s.id.split("-")[2]) || 0), 0) + 1;
          const item: Student = { ...data, id: `STU-${year}-${String(n).padStart(3, "0")}`, ref: makeRef() };
          upsert(setStudents, item, false);
          return item;
        }
      },
      deleteStudent: async (id) => {
        setStudents((p) => p.filter((s) => s.id !== id));
        setAttendance((p) => p.filter((a) => a.studentId !== id));
        try {
          await deleteStudentApi(id);
        } catch {
          /* offline delete */
        }
      },

      saveTeacher: async (data, moduleIds, id) => {
        const saved = id
          ? await teachersApi.update(id, { ...data, moduleIds })
          : await teachersApi.create({ ...data, moduleIds });
        await Promise.allSettled([refreshTeachers(), refreshModules()]);
        return saved;
      },
      deleteTeacher: async (id) => {
        await teachersApi.remove(id);
        setClasses((p) => p.filter((c) => c.teacherId !== id));
        await Promise.allSettled([refreshTeachers(), refreshModules()]);
      },

      saveModule: async (data, id) => {
        const payload = {
          code: data.code,
          name: data.name,
          description: data.description,
          fee: data.fee,
          duration: data.duration,
          teacherId: data.teacherId || null,
          batches: data.batches,
          status: data.status,
        };
        const saved = id
          ? await modulesApi.update(id, payload)
          : await modulesApi.create(payload);
        await Promise.allSettled([refreshModules(), refreshTeachers()]);
        return saved;
      },
      deleteModule: async (id) => {
        await modulesApi.remove(id);
        setStudents((p) => p.map((s) => ({ ...s, moduleIds: s.moduleIds.filter((m) => m !== id) })));
        setClasses((p) => p.filter((c) => c.moduleId !== id));
        setAttendance((p) => p.filter((a) => a.moduleId !== id));
        await Promise.allSettled([refreshModules(), refreshTeachers()]);
      },
      setModuleStudents: async (mid, ids) => {
        await modulesApi.syncEnrollments(mid, ids);
        setStudents((p) =>
          p.map((s) => {
            const has = s.moduleIds.includes(mid);
            const should = ids.includes(s.id);
            if (has === should) return s;
            return { ...s, moduleIds: should ? [...s.moduleIds, mid] : s.moduleIds.filter((m) => m !== mid) };
          }),
        );
        await refreshModules();
      },

      markAttendance: (studentId, moduleId, date, status, method = "manual") => {
        const key = `att_${studentId}_${moduleId}_${date}`;
        const exists = attendance.some((a) => a.id === key);
        setAttendance((p) =>
          p.some((a) => a.id === key)
            ? p.map((a) => (a.id === key ? { ...a, status, method } : a))
            : [...p, { id: key, studentId, moduleId, date, status, method }],
        );
        void attendanceApi
          .mark({ studentId, moduleId, date, status, method })
          .catch(() => {});
        return exists ? "updated" : "created";
      },
      bulkMarkAttendance: async (date, moduleId, batch, status = "present") => {
        try {
          const res = await attendanceApi.bulkMarkUnmarked({ date, moduleId, batch, status });
          if (res.records?.length) {
            setAttendance((p) => {
              const map = new Map<string, AttendanceRecord>();
              p.forEach((a) => map.set(a.id, a));
              res.records.forEach((a) => map.set(a.id, a));
              return Array.from(map.values());
            });
            return res.markedCount;
          }
        } catch {
          /* fallback to local calculation handled by caller */
        }
        return 0;
      },
      deleteAttendanceRecord: async (id) => {
        setAttendance((p) => p.filter((a) => a.id !== id));
        try {
          await attendanceApi.deleteRecord(id);
        } catch {
          /* ignore offline delete */
        }
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
  }, [students, studentsLoading, refreshStudents, teachers, teacherMetrics, teachersLoading, refreshTeachers, modules, modulesLoading, refreshModules, attendance, attendanceLoading, refreshAttendance, transactions, classes, notices, feeMap, paidMap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}
