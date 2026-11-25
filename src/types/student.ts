// Student-portal domain types. Shared admin types (Module, Notice, OnlineClass…) are reused from "@/types".
import type { Module, Notice, OnlineClass, Student, Teacher } from "@/types";

/** A login account for the student portal. Optionally linked to an admin-managed Student record. */
export interface StudentAccount {
  id: string;
  studentId: string | null; // links to Student.id (admin side); null = not linked yet
  fullName: string;
  email: string;
  phone: string;
  mustChangePassword?: boolean;
}

export interface PhysicalClass {
  id: string;
  moduleId: string;
  title: string;
  start: string; // YYYY-MM-DDTHH:mm (floating local time)
  end: string;
  location: string;
  status: "scheduled" | "completed" | "cancelled";
}

export type AssignmentStatus = "pending" | "submitted" | "graded" | "overdue";
export interface Assignment {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DDTHH:mm
  status: AssignmentStatus;
  maxMarks: number;
  marks?: number;
  submittedAt?: string;
}

export type MaterialFileType = "pdf" | "csv" | "txt";
export interface StudyMaterial {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  fileType: MaterialFileType;
  sizeKb: number;
  uploadedAt: string; // YYYY-MM-DD
  /** When a real backend serves the file, set this. Without it the portal generates a sample file. */
  url?: string;
}

export interface ClassRecording {
  id: string;
  moduleId: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationMin: number;
  videoUrl: string;
}

export type PaymentStatus = "paid" | "pending";
export interface StudentPayment {
  id: string;
  receiptNo: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  method: string;
  status: PaymentStatus;
}

export type DueStatus = "overdue" | "due-soon" | "upcoming";
export interface DuePayment {
  id: string;
  moduleId: string;
  moduleName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: DueStatus;
}

export interface PaymentSummary {
  totalFees: number;
  paid: number;
  outstanding: number;
  pendingVerification: number;
  overdue: number;
}

export interface StudentModule extends Module {
  teacher: Teacher | null;
  physicalSchedule: string; // e.g. "Saturday · 9:00 AM – 11:00 AM · Hall A"
  onlineSchedule: string;
  nextSession: { kind: "online" | "physical"; start: string } | null;
  openAssignments: number;
  totalAssignments: number;
  materialsCount: number;
  recordingsCount: number;
}

export interface StudentPortalData {
  linked: boolean;
  profile: Student | null;
  modules: StudentModule[];
  onlineClasses: OnlineClass[];
  physicalClasses: PhysicalClass[];
  notices: Notice[];
  assignments: Assignment[];
  materials: StudyMaterial[];
  recordings: ClassRecording[];
  payments: StudentPayment[];
  dues: DuePayment[];
  paymentSummary: PaymentSummary;
  instituteName: string;
}
