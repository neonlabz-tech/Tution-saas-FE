// Shared domain types. These mirror the document shapes a future MongoDB API would return.

export type StudentStatus = "pending" | "active" | "inactive" | "graduated";
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

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export type SortOrder = "asc" | "desc";

export type StudentSortBy =
  | "fullName"
  | "id"
  | "batch"
  | "enrollmentDate"
  | "status"
  | "createdAt"
  | "feeTotal"
  | "paidTotal"
  | "outstanding";

export interface StudentQueryParams {
  q?: string;
  batch?: string;
  moduleId?: string;
  status?: StudentStatus | "all";
  page?: number;
  limit?: number;
  sortBy?: StudentSortBy;
  sortOrder?: SortOrder;
}

export interface StudentModuleRef {
  id: string;
  code: string;
  name: string;
  fee: number;
  duration?: string;
  status?: ModuleStatus;
}

export interface StudentListItem extends Student {
  qrPayload?: string;
  qrRotatedAt?: string | null;
  modules?: StudentModuleRef[];
  feeTotal?: number;
  paidTotal?: number;
  outstanding?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentListSummary {
  total: number;
  activeCount: number;
  filteredTotal: number;
}

export interface StudentListResponse {
  items: StudentListItem[];
  pagination: PaginationMeta;
  summary: StudentListSummary;
}

export interface StudentAttendanceSummary {
  rate: number;
  present: number;
  late: number;
  absent: number;
  excused?: number;
  total?: number;
}

export interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  moduleId: string;
  moduleName?: string;
  moduleCode?: string;
  date: string;
  status: AttendanceStatus;
  method: "manual" | "qr";
}

export interface StudentPaymentRecord {
  id: string;
  type?: TxType;
  category: string;
  amount: number;
  date: string;
  description: string;
  studentId?: string;
  method?: string;
}

export interface StudentDetail extends Student {
  qrPayload?: string;
  qrRotatedAt?: string | null;
  modules: StudentModuleRef[];
  feeTotal: number;
  paidTotal: number;
  outstanding: number;
  attendanceSummary: StudentAttendanceSummary;
  attendanceRecords: StudentAttendanceRecord[];
  payments: StudentPaymentRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStudentDto {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  batch: string;
  moduleIds: string[];
  enrollmentDate?: string;
  status?: StudentStatus;
}

export type UpdateStudentDto = Partial<CreateStudentDto>;

export interface RotateQrResponse {
  id: string;
  ref: string;
  qrPayload: string;
  qrRotatedAt: string;
}

export interface DeleteStudentResponse {
  deleted: boolean;
  id: string;
  deletedAttendanceCount?: number;
  preservedTransactionsCount?: number;
}

export type StudentPaymentStatus = "paid" | "partial" | "unpaid";

export interface StudentPaymentSummary {
  id: string;
  fullName: string;
  batch: string;
  status: StudentStatus;
  feeTotal: number;
  paidTotal: number;
  outstanding: number;
  paymentStatus?: StudentPaymentStatus;
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number | null;
}

export interface StudentPaymentsListResponse {
  items: StudentPaymentSummary[];
  pagination: PaginationMeta;
  summary: {
    debtorCount: number;
    totalOutstanding: number;
  };
}

export interface RecordStudentPaymentDto {
  studentId: string;
  amount: number;
  method: string;
  category?: string;
  date?: string;
  description?: string;
}

export interface RecordStudentPaymentResponse {
  transaction: Transaction;
  studentSummary: StudentPaymentSummary;
}

export type TeacherStatus = "active" | "inactive";
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
  teacher?: { id: string; fullName: string } | null;
  enrolledCount?: number;
  revenuePotential?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleTeacherRef {
  id: string;
  fullName: string;
}

export interface ModuleEnrolledStudent {
  id: string;
  fullName: string;
  email?: string;
  batch: string;
  status?: StudentStatus;
}

export interface ModuleListItem extends Module {
  teacher?: ModuleTeacherRef | null;
  enrolledCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleDetail extends ModuleListItem {
  enrolledCount: number;
  revenuePotential: number;
  enrolledStudents: ModuleEnrolledStudent[];
}

export interface ModuleQueryParams {
  q?: string;
  status?: ModuleStatus | "all";
  teacherId?: string;
  batch?: string;
}

export interface CreateModuleDto {
  code: string;
  name: string;
  description: string;
  fee: number;
  duration: string;
  teacherId?: string | null;
  batches: string[];
  status?: ModuleStatus;
}

export type UpdateModuleDto = Partial<Omit<CreateModuleDto, "teacherId">> & {
  teacherId?: string | null;
};

export interface UpdateModuleEnrollmentsResponse {
  moduleId: string;
  enrolledCount: number;
  enrolledStudents: ModuleEnrolledStudent[];
}

export interface DeleteModuleResponse {
  deleted?: boolean;
  id?: string;
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
