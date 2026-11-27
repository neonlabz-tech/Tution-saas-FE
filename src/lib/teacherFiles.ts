// Client-side file generation for the Teacher portal: Excel marks sheets, PDF salary receipts, sample downloads.
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { MarksRow, SalaryPayment, TeacherAssignment, TeacherBatch, TeacherProfile } from "@/types/teacher";
import { fmtDate, fmtLKR } from "@/lib/utils";

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function openLink(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
const safe = (s: string) => s.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

/** Excel workbook: one sheet of students × assignments (+ total), with registration numbers. */
export function exportMarksXlsx(batch: TeacherBatch, assignments: TeacherAssignment[], rows: MarksRow[], published: Set<string>) {
  const header = ["#", "Registration No.", "Student Name", ...assignments.map((a) => `${a.title} (/${a.maxMarks})`), "Total"];
  const body = rows.map((r, i) => [i + 1, r.student.id, r.student.fullName, ...assignments.map((a) => r.marks[a.id] ?? ""), r.total]);
  const maxTotal = assignments.reduce((s, a) => s + a.maxMarks, 0);
  const ws = XLSX.utils.aoa_to_sheet([[`${batch.moduleName} · ${batch.batch}`], [`Exported ${new Date().toLocaleString("en-US")}`], [], header, ...body]);
  ws["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 28 }, ...assignments.map(() => ({ wch: 24 })), { wch: 10 }];
  const meta = XLSX.utils.aoa_to_sheet([
    ["Assignment", "Max marks", "Due date", "Status"],
    ...assignments.map((a) => [a.title, a.maxMarks, a.dueDate.replace("T", " "), published.has(a.id) ? "Published" : "Not published"]),
    [],
    ["Total possible", maxTotal],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Marks");
  XLSX.utils.book_append_sheet(wb, meta, "Assignments");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  saveBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `marks-${safe(batch.moduleCode)}-${safe(batch.batch)}.xlsx`);
}

/** Sample file for a student's submission when the real file lives behind a backend that isn't connected yet. */
export function downloadSampleSubmission(fileName: string, studentName: string, assignmentTitle: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(assignmentTitle, 20, 28, { maxWidth: 170 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`Submitted by ${studentName}`, 20, 44);
  pdf.text("Sample submission. The student's real file appears here once the submission service is connected.", 20, 56, { maxWidth: 170 });
  pdf.save(fileName);
}
export function downloadSampleMaterial(name: string, description: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(name, 20, 30, { maxWidth: 170 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(`${description}\n\nSample document.`, 170) as string[], 20, 48);
  pdf.save(`${safe(name)}.pdf`);
}

export function downloadSalaryReceipt(p: SalaryPayment, t: TeacherProfile, instituteName: string) {
  if (p.status !== "paid" || !p.paymentDate) throw new Error("A receipt is only available for paid salaries.");
  const pdf = new jsPDF({ unit: "mm", format: "a5" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const m = 14;
  pdf.setFillColor(79, 70, 229);
  pdf.rect(0, 0, W, 34, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("EduFlow", m, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(instituteName, m, 21);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("SALARY PAYMENT RECEIPT", W - m, 15, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(p.reference, W - m, 21, { align: "right" });

  const row = (label: string, value: string, y: number, bold = false) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, m, y);
    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(value, W - m, y, { align: "right", maxWidth: W - m * 2 - 38 });
  };
  let y = 46;
  row("Paid to", t.fullName, y, true);
  row("Employee no.", t.employeeNo, (y += 7));
  row("Teacher ID", t.teacherId, (y += 7));
  row("Email", t.email, (y += 7));
  row("Pay period", new Date(`${p.period}-01T00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }), (y += 7));
  row("Payment date", fmtDate(p.paymentDate), (y += 7));
  row("Method", p.method, (y += 7));
  row("Reference no.", p.reference, (y += 7));
  row("Description", p.description, (y += 7));

  y += 6;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(m, y, W - m, y);
  y += 7;
  row("Basic salary", fmtLKR(p.basic), y);
  row("Allowances", fmtLKR(p.allowances), (y += 7));
  row("Deductions", `- ${fmtLKR(p.deductions)}`, (y += 7));
  y += 4;
  pdf.line(m, y, W - m, y);
  y += 9;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(17, 24, 39);
  pdf.text("Net amount paid", m, y);
  pdf.setFontSize(15);
  pdf.setTextColor(79, 70, 229);
  pdf.text(fmtLKR(p.net), W - m, y, { align: "right" });
  y += 10;
  pdf.setFillColor(209, 250, 229);
  pdf.roundedRect(m, y - 5, 30, 8, 2, 2, "F");
  pdf.setTextColor(4, 120, 87);
  pdf.setFontSize(9);
  pdf.text("PAID", m + 15, y, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(8);
  pdf.text("This is a computer-generated receipt and does not require a signature.", W / 2, H - 10, { align: "center" });
  pdf.save(`${p.reference}.pdf`);
}
