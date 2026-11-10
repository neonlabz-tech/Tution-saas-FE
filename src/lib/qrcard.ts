import { jsPDF } from "jspdf";
import type { Student } from "@/types";
import { downloadDataUrl } from "@/lib/utils";

const W = 1070;
const H = 675;

export function renderCardCanvas(student: Student, qr: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#312E81");
  grad.addColorStop(0.55, "#4F46E5");
  grad.addColorStop(1, "#0F766E");
  rr(0, 0, W, H, 44);
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.globalAlpha = 0.12;
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(W - 40, 20, 260, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(60, H + 20, 200, 0, Math.PI * 2);
  g.fill();
  g.restore();

  const sans = "'Plus Jakarta Sans','DM Sans',Arial,sans-serif";
  g.fillStyle = "#fff";
  g.font = `800 38px ${sans}`;
  g.fillText("EduFlow", 64, 96);
  g.font = `500 22px ${sans}`;
  g.globalAlpha = 0.75;
  g.fillText("Bright Future Institute · Student Card", 64, 134);
  g.globalAlpha = 1;

  g.font = `800 50px ${sans}`;
  const name = student.fullName.length > 20 ? student.fullName.slice(0, 19) + "…" : student.fullName;
  g.fillText(name, 64, 330);
  g.font = `600 30px 'JetBrains Mono',monospace`;
  g.fillText(student.id, 64, 386);
  g.font = `500 26px ${sans}`;
  g.globalAlpha = 0.85;
  g.fillText(`Batch · ${student.batch}`, 64, 440);
  g.font = `500 21px ${sans}`;
  g.globalAlpha = 0.7;
  g.fillText("Scan this code at the front desk", 64, 575);
  g.fillText("to mark attendance.", 64, 606);
  g.globalAlpha = 1;

  const size = 400;
  const x = W - size - 70;
  const y = (H - size) / 2;
  rr(x - 24, y - 24, size + 48, size + 48, 36);
  g.fillStyle = "#fff";
  g.fill();
  g.imageSmoothingEnabled = false;
  g.drawImage(qr, x, y, size, size);
  return c;
}

export function downloadCardPng(student: Student, qr: HTMLCanvasElement) {
  downloadDataUrl(renderCardCanvas(student, qr).toDataURL("image/png"), `${student.id}-qr-card.png`);
}

export function downloadCardPdf(student: Student, qr: HTMLCanvasElement) {
  const url = renderCardCanvas(student, qr).toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
  pdf.addImage(url, "PNG", 0, 0, 85.6, 54);
  pdf.save(`${student.id}-qr-card.pdf`);
}

export function printCard(student: Student, qr: HTMLCanvasElement) {
  const url = renderCardCanvas(student, qr).toDataURL("image/png");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(`<html><head><title>${student.id} QR card</title><style>@page{size:85.6mm 54mm;margin:0}body{margin:0}img{width:85.6mm;height:54mm;display:block}</style></head><body><img src="${url}" /></body></html>`);
  doc.close();
  const img = doc.querySelector("img")!;
  const go = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 1500);
  };
  if (img.complete) go();
  else img.onload = go;
}
