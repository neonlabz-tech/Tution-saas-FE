// Teacher-portal domain types. Shared admin types (Module, Notice, OnlineClassItem…) come from "@/types".
export type TeacherClassKind = "online" | "physical";
export type TeacherClassStatus = "scheduled" | "completed" | "cancelled" | "postponed";

/** One class occurrence on the teacher's calendar (online ones come from the real /online-classes API). */
export interface TeacherClass {
  id: string;
  kind: TeacherClassKind;
  title: string;
  moduleId: string;
  moduleName: string;
  moduleCode: string;
  batchId: string;
  batch: string;
  start: string; // YYYY-MM-DDTHH:mm (floating local time)
  end: string;
  status: TeacherClassStatus;
  link?: string; // online meeting link
  location?: string; // physical room
  reason?: string; // cancellation / postponement reason
  originalStart?: string;
  originalEnd?: string;
}

/** A module taught to one batch: the unit a teacher is "assigned" to. */
export interface TeacherBatch {
  id: string; // `${moduleId}__${slug(batch)}`
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  batch: string;
  studentCount: number;
  schedule: string;
  status: "active" | "upcoming" | "archived";
}

/** Minimal, privacy-limited student projection (no fees, guardian, address or DOB). */
export interface TeacherStudent {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  enrollmentDate: string;
}

export type MaterialKind = "file" | "link";
export interface TeacherMaterial {
  id: string;
  batchId: string;
  teacherId: string;
  title: string;
  description: string;
  kind: MaterialKind;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string; // R2 key from the existing /storage/upload service
  url: string; // file URL (storage) or external resource URL
  uploadedAt: string; // ISO
}

export interface TeacherRecording {
  id: string;
  batchId: string;
  teacherId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  videoUrl: string;
  source: "link" | "upload";
  storageKey?: string;
}

export interface TeacherAssignment {
  id: string;
  batchId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DDTHH:mm
  maxMarks: number;
  createdAt: string;
}

export type SubmissionStatus = "not-submitted" | "submitted" | "marked";
export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string | null; // ISO
  fileName: string | null;
  fileUrl?: string;
  late: boolean;
  marks: number | null;
  markedAt: string | null;
  feedback?: string;
}

export interface MarksPublication {
  id: string;
  assignmentId: string;
  batchId: string;
  noticeId: string;
  publishedAt: string;
  publishedBy: string;
}

export type NoticeKind = "academic" | "result";
export interface NoticeOwnership {
  noticeId: string;
  teacherId: string;
  kind: NoticeKind;
  assignmentId?: string;
}

export interface ClassChange {
  classId: string;
  status: "cancelled" | "postponed";
  reason: string;
  originalStart: string;
  originalEnd: string;
  changedAt: string;
  changedBy: string;
}

export type SalaryStatus = "paid" | "pending";
export interface SalaryPayment {
  id: string;
  teacherId: string;
  period: string; // YYYY-MM
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
  status: SalaryStatus;
  paymentDate: string | null; // YYYY-MM-DD
  reference: string;
  method: string;
  description: string;
}

export interface TeacherProfile {
  userId: string;
  teacherId: string; // Teacher record id (falls back to the user id when the record can't be resolved)
  fullName: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  employeeNo: string;
}

export interface MarksRow {
  student: TeacherStudent;
  marks: Record<string, number | null>; // assignmentId → marks
  total: number;
}
