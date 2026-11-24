// Client-side file generation for e-receipts and (mock) study materials.
import { jsPDF } from "jspdf";
import type { StudentAccount, StudentPayment, StudyMaterial } from "@/types/student";
import { fmtDate, fmtLKR } from "@/lib/utils";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadReceipt(payment: StudentPayment, account: StudentAccount, studentId: string | null, instituteName: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a5" });
  const W = pdf.internal.pageSize.getWidth();
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
  pdf.text("PAYMENT RECEIPT", W - m, 15, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(payment.receiptNo, W - m, 21, { align: "right" });

  pdf.setTextColor(17, 24, 39);
  const row = (label: string, value: string, y: number, bold = false) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, m, y);
    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(value, W - m, y, { align: "right", maxWidth: W - m * 2 - 38 });
  };
  let y = 48;
  row("Received from", account.fullName, y);
  row("Student ID", studentId ?? "—", (y += 8));
  row("Payment date", fmtDate(payment.date), (y += 8));
  row("Payment method", payment.method, (y += 8));
  row("Category", payment.category, (y += 8));
  const lines = pdf.splitTextToSize(payment.description, W - m * 2 - 38) as string[];
  row("Description", lines[0] ?? "", (y += 8));
  lines.slice(1).forEach((l) => pdf.text(l, W - m, (y += 5), { align: "right" }));

  y += 8;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(m, y, W - m, y);
  y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(17, 24, 39);
  pdf.text("Amount paid", m, y);
  pdf.setFontSize(16);
  pdf.setTextColor(79, 70, 229);
  pdf.text(fmtLKR(payment.amount), W - m, y, { align: "right" });

  y += 12;
  pdf.setFillColor(209, 250, 229);
  pdf.roundedRect(m, y - 5, 30, 8, 2, 2, "F");
  pdf.setTextColor(4, 120, 87);
  pdf.setFontSize(9);
  pdf.text("PAID", m + 15, y, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(8);
  pdf.text("This is a computer-generated receipt and does not require a signature.", W / 2, pdf.internal.pageSize.getHeight() - 12, { align: "center" });
  pdf.save(`${payment.receiptNo}.pdf`);
}

const slug = (s: string) => s.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

/** Real materials are fetched from `url`; until a backend provides them a small sample file is generated instead. */
export function downloadMaterial(mat: StudyMaterial, moduleName: string) {
  const filename = `${slug(mat.name)}.${mat.fileType}`;
  if (mat.url) {
    const a = document.createElement("a");
    a.href = mat.url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  if (mat.fileType === "pdf") {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(mat.name, 20, 30, { maxWidth: 170 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${moduleName} · uploaded ${fmtDate(mat.uploadedAt)}`, 20, 48);
    pdf.setTextColor(17, 24, 39);
    pdf.text(pdf.splitTextToSize(`${mat.description}\n\nSample study material. Your teacher's real file replaces this once the document service is connected.`, 170) as string[], 20, 64);
    pdf.save(filename);
  } else if (mat.fileType === "csv") {
    const rows = ["week,topic,exercises_done,score_pct", ...Array.from({ length: 8 }, (_, i) => `${i + 1},Unit ${i + 1},${10 + i * 2},${60 + ((i * 7) % 35)}`)];
    saveBlob(new Blob([rows.join("\n")], { type: "text/csv" }), filename);
  } else {
    saveBlob(new Blob([`${mat.name}\n${moduleName}\n\n${mat.description}\n\n1. Textbook, Unit 1–4\n2. Past paper archive (front desk)\n3. Teacher handouts (this portal)\n`], { type: "text/plain" }), filename);
  }
}
