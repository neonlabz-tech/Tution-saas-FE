// Shared domain types. These mirror the document shapes a future MongoDB API would return.

export type StudentStatus = "active" | "inactive" | "graduated";
export interface Student {
  id: string; // e.g. STU-2025-001
  ref: string; // opaque QR reference (contains no personal data)
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  batch: string;
  moduleIds: string[];
  enrollmentDate: string;
  status: StudentStatus;
}

export type TeacherStatus = "active" | "on-leave" | "inactive";
export interface Teacher {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  batches: string[];
  joiningDate: string;
  status: TeacherStatus;
}

export type ModuleStatus = "active" | "upcoming" | "archived";
export interface Module {
  id: string;
  code: string;
  name: string;
  description: string;
  fee: number;
  duration: string;
  teacherId: string | null;
  batches: string[];
  status: ModuleStatus;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export interface AttendanceRecord {
  id: string;
  studentId: string;
  moduleId: string;
  date: string;
  status: AttendanceStatus;
  method: "manual" | "qr";
}

export type TxType = "income" | "expense";
export interface Transaction {
  id: string;
  type: TxType;
  category: string;
  amount: number;
  date: string;
  description: string;
  studentId?: string;
  method?: string;
}

export type ClassStatus = "scheduled" | "completed" | "cancelled";
export interface OnlineClass {
  id: string;
  title: string;
  moduleId: string;
  teacherId: string;
  batch: string;
  start: string; // YYYY-MM-DDTHH:mm (floating local time)
  end: string;
  link: string;
  description: string;
  status: ClassStatus;
}

export type NoticePriority = "low" | "medium" | "high";
export interface Notice {
  id: string;
  title: string;
  description: string;
  batches: string[]; // empty = all batches
  publishDate: string;
  expiryDate: string;
  priority: NoticePriority;
  status: "published" | "draft";
}
