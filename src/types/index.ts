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
  email?: string;
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
    totalStudents?: number;
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
  payment?: PaymentItem;
}

export type PaymentRecordStatus = "completed" | "refunded" | "void";

export interface PaymentStudentInfo {
  id: string;
  fullName: string;
  batch: string;
  email: string;
}

export interface PaymentItem {
  id: string;
  receiptNo: string;
  studentId: string;
  amount: number;
  discount: number;
  category: string;
  method: string;
  date: string;
  description: string;
  status: PaymentRecordStatus;
  collectedBy?: string;
  transactionId?: string;
  student?: PaymentStudentInfo | null;
}

export interface PaymentStudentsQueryParams {
  q?: string;
  batch?: string;
  status?: StudentStatus | "all";
  paymentStatus?: StudentPaymentStatus | "all";
  debtorsOnly?: boolean;
  includeGraduated?: boolean;
  page?: number;
  limit?: number;
}

export interface PaymentStudentsResponse {
  items: StudentPaymentSummary[];
  pagination: PaginationMeta;
  summary: {
    totalStudents: number;
    debtorCount: number;
    settledCount: number;
    totalOutstanding: number;
    totalCollected: number;
  };
}

export interface PaymentsListQueryParams {
  q?: string;
  studentId?: string;
  method?: string;
  category?: string;
  status?: PaymentRecordStatus | "all";
  period?: FinancePeriod;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaymentsListResponse {
  items: PaymentItem[];
  pagination: PaginationMeta;
  summary: {
    totalCollected: number;
    totalCount: number;
  };
}

export interface PaymentDetailResponse {
  payment: PaymentItem;
  student: PaymentStudentInfo | null;
  studentSummary: StudentPaymentSummary | null;
}

export interface CreatePaymentDto {
  studentId: string;
  amount: number;
  discount?: number;
  method: string;
  category?: string;
  date?: string;
  description?: string;
}

export interface UpdatePaymentDto {
  amount?: number;
  discount?: number;
  method?: string;
  category?: string;
  date?: string;
  description?: string;
  status?: PaymentRecordStatus;
}

export interface CreatePaymentResponse {
  payment: PaymentItem;
  transaction: Transaction;
  studentSummary: StudentPaymentSummary;
}

export interface UpdatePaymentResponse {
  payment: PaymentItem;
  studentSummary: StudentPaymentSummary | null;
}

export interface DeletePaymentResponse {
  deleted: boolean;
  id: string;
  deletedTransactionId?: string | null;
  studentSummary?: StudentPaymentSummary | null;
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
  student?: {
    id: string;
    fullName: string;
    batch?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export type FinancePeriod = "week" | "month" | "year" | "custom";

export interface FinancePeriodRange {
  period: FinancePeriod;
  from: string;
  to: string;
  span?: number;
}

export interface FinanceKpis {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalOutstanding: number;
  totalCount: number;
}

export interface FinanceKpisResponse {
  kpis: FinanceKpis;
  period: FinancePeriodRange;
}

export interface FinanceSeriesBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface FinanceCategoryBreakdownItem {
  name: string;
  value: number;
}

export interface FinanceChartsResponse {
  period: FinancePeriodRange;
  granularity?: "daily" | "monthly";
  series: FinanceSeriesBucket[];
  incomeByCategory: FinanceCategoryBreakdownItem[];
  expenseByCategory: FinanceCategoryBreakdownItem[];
}

export interface FinanceFilterParams {
  period?: FinancePeriod;
  from?: string;
  to?: string;
  category?: string;
}

export interface TransactionQueryParams extends FinanceFilterParams {
  type?: TxType;
  studentId?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FinanceTransactionsResponse {
  items: Transaction[];
  pagination: PaginationMeta;
  kpis: FinanceKpis;
  period: FinancePeriodRange;
}

export interface CreateTransactionDto {
  type: TxType;
  category: string;
  amount: number;
  date?: string;
  description?: string;
  method?: string;
  studentId?: string | null;
}

export type UpdateTransactionDto = Partial<CreateTransactionDto>;

export interface DeleteTransactionResponse {
  deleted: boolean;
  id: string;
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

export interface OnlineClassModuleRef {
  id: string;
  code: string;
  name: string;
}

export interface OnlineClassTeacherRef {
  id: string;
  fullName: string;
}

export interface OnlineClassItem extends OnlineClass {
  module?: OnlineClassModuleRef | null;
  teacher?: OnlineClassTeacherRef | null;
  moduleCode?: string;
  moduleName?: string;
  teacherName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OnlineClassQueryParams {
  teacherId?: string;
  moduleId?: string;
  batch?: string;
  status?: ClassStatus | "all";
  from?: string;
  to?: string;
  q?: string;
}

export interface CreateOnlineClassDto {
  title: string;
  moduleId: string;
  teacherId: string;
  batch: string;
  start: string;
  end: string;
  link: string;
  description?: string;
  status?: ClassStatus;
}

export type UpdateOnlineClassDto = Partial<CreateOnlineClassDto>;

export interface DeleteOnlineClassResponse {
  deleted?: boolean;
  id?: string;
}

export type NoticePriority = "low" | "medium" | "high";
/** Computed by the backend from status + publish/expiry dates. "expired" is only returned to admins. */
export type NoticeState = "draft" | "scheduled" | "active" | "expired";
export interface Notice {
  id: string;
  title: string;
  description: string;
  /** true = every batch (batches is then empty) */
  allBatches?: boolean;
  batches: string[];
  publishDate: string;
  expiryDate: string;
  priority: NoticePriority;
  status: "published" | "draft";
  state?: NoticeState;
}

export type BatchStatus = "active" | "upcoming" | "archived";
export type BatchCategory = "al" | "grade";

export interface BatchItem {
  id: string;
  name: string;
  code: string;
  year?: string;
  description?: string;
  status: BatchStatus;
  category?: BatchCategory;
  studentCount?: number;
  moduleCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBatchDto {
  name: string;
  code?: string;
  year?: string;
  description?: string;
  status?: BatchStatus;
  category?: BatchCategory;
}

export type UpdateBatchDto = Partial<CreateBatchDto>;

export type UserRole = "super_admin" | "admin" | "teacher" | "student";

export type NotificationType = "payment" | "attendance" | "class" | "notice" | "student" | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  link?: string;
  read: boolean;
  persisted?: boolean;
  createdAt?: string;
  actorId?: string;
  actorRole?: UserRole;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
  targetBatch?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}

export interface NotificationQueryParams {
  type?: NotificationType | "all";
  read?: boolean;
  q?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  pagination?: PaginationMeta;
  summary?: {
    total: number;
    unreadCount: number;
    byType?: Record<string, number>;
  };
  unreadCount?: number;
}

export interface CreateNotificationDto {
  type?: NotificationType;
  title: string;
  subtitle?: string;
  link?: string;
  actorId?: string;
  actorRole?: UserRole;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
  targetBatch?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}

export interface DeleteNotificationResponse {
  deleted: boolean;
  id?: string;
}

