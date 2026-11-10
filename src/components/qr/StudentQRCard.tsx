import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, FileText, Printer } from "lucide-react";
import type { Student } from "@/types";
import { Button, MockNote } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { downloadCardPdf, downloadCardPng, printCard } from "@/lib/qrcard";
import { qrPayload } from "@/lib/utils";

export function StudentQRCard({ student }: { student: Student }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const toast = useToast();
  const run = (fn: (s: Student, c: HTMLCanvasElement) => void, msg: string) => {
    if (!ref.current) return;
    fn(student, ref.current);
    toast.success(msg);
  };
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-primary to-teal-700 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="font-heading text-xl font-extrabold">EduFlow</p>
            <p className="text-[11px] text-white/70">Bright Future Institute · Student Card</p>
            <p className="mt-6 font-heading text-xl font-extrabold leading-tight">{student.fullName}</p>
            <p className="num mt-1 text-sm font-semibold">{student.id}</p>
            <p className="mt-1 text-xs text-white/80">Batch · {student.batch}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <QRCodeCanvas ref={ref} value={qrPayload(student.ref)} size={150} level="M" marginSize={0} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="soft" size="sm" onClick={() => run(downloadCardPng, "QR card PNG downloaded")}><Download className="h-3.5 w-3.5" /> PNG</Button>
        <Button variant="soft" size="sm" onClick={() => run(downloadCardPdf, "QR card PDF downloaded")}><FileText className="h-3.5 w-3.5" /> PDF</Button>
        <Button variant="soft" size="sm" onClick={() => run(printCard, "Opening print dialog…")}><Printer className="h-3.5 w-3.5" /> Print</Button>
      </div>
      <MockNote>
        The QR encodes only an opaque, locally generated reference (<span className="num">{student.ref.slice(0, 6)}…</span>) — no name, phone, or payment data. Validation against real records will be done by the backend later.
      </MockNote>
    </div>
  );
}
