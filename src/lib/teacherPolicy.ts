// Authorisation rules for the Teacher portal, in ONE place.
//
// Every mutating call in `teacherApi.ts` goes through these guards, so the rules are enforced in the
// service layer and not just hidden in the UI. The backend MUST enforce the very same rules on its
// endpoints (see TEACHER_BACKEND_CONTRACT.md): client code can always be bypassed.
import type { ClassChange, TeacherBatch, TeacherClass } from "@/types/teacher";

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
export class ValidationError extends Error {
  status = 422;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface Actor {
  teacherId: string;
  userId: string;
  batchIds: ReadonlySet<string>;
  batchNames: ReadonlySet<string>;
}

export const makeActor = (teacherId: string, userId: string, batches: TeacherBatch[]): Actor => ({
  teacherId,
  userId,
  batchIds: new Set(batches.map((b) => b.id)),
  batchNames: new Set(batches.map((b) => b.batch)),
});

export function assertOwnsBatch(a: Actor, batchId: string): void {
  if (!a.batchIds.has(batchId)) throw new ForbiddenError("This batch isn't assigned to you.");
}
export function assertOwnsBatchName(a: Actor, batch: string): void {
  if (!a.batchNames.has(batch)) throw new ForbiddenError(`You can only publish to batches you manage (“${batch}” isn't one of them).`);
}
export function assertOwnerId(a: Actor, ownerTeacherId: string, what = "item"): void {
  if (ownerTeacherId !== a.teacherId) throw new ForbiddenError(`You can only change ${what} that you created.`);
}

/* ---- classes: teachers may ONLY cancel or postpone their own scheduled classes ---- */
export const MIN_REASON = 5;
export const MAX_REASON = 300;

export function assertCanChangeClass(a: Actor, c: TeacherClass, now = new Date()): void {
  assertOwnsBatch(a, c.batchId);
  if (c.status === "cancelled") throw new ValidationError("This class is already cancelled.");
  if (c.status === "completed") throw new ValidationError("Completed classes can't be changed.");
  if (new Date(c.end).getTime() < now.getTime()) throw new ValidationError("This class has already finished.");
}
export function validateReason(reason: string): string {
  const r = reason.trim();
  if (r.length < MIN_REASON) throw new ValidationError(`Please give a reason (at least ${MIN_REASON} characters).`);
  if (r.length > MAX_REASON) throw new ValidationError(`Keep the reason under ${MAX_REASON} characters.`);
  return r;
}
export function validateReschedule(c: TeacherClass, start: string, end: string, now = new Date()): void {
  if (!start || !end) throw new ValidationError("Choose the new date and time.");
  if (end <= start) throw new ValidationError("The new end time must be after the start time.");
  if (new Date(start).getTime() <= now.getTime()) throw new ValidationError("The new time must be in the future.");
  if (start === c.start && end === c.end) throw new ValidationError("The new time is the same as the current one.");
}
export const canChangeClass = (c: TeacherClass, a: Actor, now = new Date()) => {
  try {
    assertCanChangeClass(a, c, now);
    return true;
  } catch {
    return false;
  }
};
export type { ClassChange };

/* ---- uploads ---- */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_MATERIAL_EXT = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg", "zip"];
export const ALLOWED_RECORDING_EXT = ["mp4", "webm", "mov"];

export function validateUpload(file: File, allowed: string[]): void {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(ext)) throw new ValidationError(`“.${ext || "?"}” files aren't supported. Allowed: ${allowed.join(", ")}.`);
  if (file.size === 0) throw new ValidationError("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ValidationError(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB).`);
}
export function validateUrl(raw: string): string {
  const u = raw.trim();
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    throw new ValidationError("Enter a valid link starting with https://");
  }
}

/* ---- marks ---- */
export function validateMarks(value: number, max: number): void {
  if (!Number.isFinite(value)) throw new ValidationError("Marks must be a number.");
  if (value < 0 || value > max) throw new ValidationError(`Marks must be between 0 and ${max}.`);
  if (Math.round(value * 100) / 100 !== value) throw new ValidationError("Use at most 2 decimal places.");
}
