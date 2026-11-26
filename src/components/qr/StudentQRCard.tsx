import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import type { RotateQrResponse, Student, StudentDetail, StudentListItem } from "@/types";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { rotateStudentQr } from "@/api/students";
import { downloadCardPdf, downloadCardPng, printCard } from "@/lib/qrcard";
import { formatDateTime, qrPayload } from "@/lib/utils";

type QRStudent = Student | StudentListItem | StudentDetail;

export function StudentQRCard({
  student,
  instituteName,
  onRotated,
}: {
  student: QRStudent;
  instituteName?: string;
  onRotated?: (rotated: RotateQrResponse) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const toast = useToast();
  const { config } = useAuth();
  const [confirmRotate, setConfirmRotate] = useState(false);

  const effectiveInstituteName =
    instituteName || config?.instituteName || import.meta.env.VITE_INSTITUTE_NAME || "";
  const subtitle = effectiveInstituteName
    ? `${effectiveInstituteName} · Student Card`
    : "Student Card";

  const payload = ("qrPayload" in student && student.qrPayload) ? student.qrPayload : qrPayload(student.ref);
  const rotatedAt = "qrRotatedAt" in student ? student.qrRotatedAt : null;

  const run = (
    fn: (s: Student, c: HTMLCanvasElement, inst?: string) => void,
    msg: string,
  ) => {
    if (!ref.current) return;
    fn(student, ref.current, effectiveInstituteName);
    toast.success(msg);
  };

  const handleRotate = async () => {
    try {
      const res = await rotateStudentQr(student.id);
      onRotated?.(res);
      toast.success("QR code rotated. Previous QR card is now invalid.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate QR code");
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-primary to-teal-700 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="font-heading text-xl font-extrabold">EduFlow</p>
            <p className="text-[11px] text-white/70">{subtitle}</p>
            <p className="mt-6 font-heading text-xl font-extrabold leading-tight">{student.fullName}</p>
            <p className="num mt-1 text-sm font-semibold">{student.id}</p>
            <p className="mt-1 text-xs text-white/80">Batch · {student.batch}</p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <QRCodeCanvas ref={ref} value={payload} size={150} level="M" marginSize={0} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="soft" size="sm" onClick={() => run(downloadCardPng, "QR card PNG downloaded")}>
          <Download className="h-3.5 w-3.5" /> PNG
        </Button>
        <Button variant="soft" size="sm" onClick={() => run(downloadCardPdf, "QR card PDF downloaded")}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button variant="soft" size="sm" onClick={() => run(printCard, "Opening print dialog…")}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button variant="dangerSoft" size="sm" onClick={() => setConfirmRotate(true)}>
          <RefreshCw className="h-3.5 w-3.5" /> Rotate QR
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[11px] text-muted">
        <span>
          Opaque reference: <span className="num font-semibold text-ink">{student.ref.slice(0, 8)}…</span>
        </span>
        {rotatedAt && (
          <span>
            Last rotated: <span className="font-medium text-ink">{formatDateTime(rotatedAt)}</span>
          </span>
        )}
      </div>

      <ConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Rotate student QR code?"
        text={
          <>
            Rotating invalidates <b>{student.fullName}</b>&apos;s existing printed/PDF QR card immediately. Download or print the updated card after rotation.
          </>
        }
        confirmLabel="Rotate QR"
        confirmLoadingLabel="Rotating…"
        confirmVariant="danger"
        onConfirm={handleRotate}
      />
    </div>
  );
}
