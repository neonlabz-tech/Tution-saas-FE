import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Badge, Button, Card, CardHeader, InfoRow } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { NoAccess } from "@/components/teacher/bits";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { getSalary, periodLabel } from "@/lib/teacherApi";
import { downloadSalaryReceipt } from "@/lib/teacherFiles";
import { fmtDate, fmtLKR } from "@/lib/utils";

export default function PaymentDetailPage() {
  const { paymentId = "" } = useParams();
  const { actor, profile, instituteName } = useTeacherPortal();
  const toast = useToast();
  if (!actor || !profile) return null;
  let p;
  try { p = getSalary(actor, paymentId); } catch { return <NoAccess text="That payment record doesn't exist or isn't yours." />; }
  const receipt = () => { try { downloadSalaryReceipt(p, profile, instituteName); toast.success("Receipt downloaded"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the receipt."); } };
  return (
    <>
      <Link to="/teacher/payments" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> All payments</Link>
      <Card className="max-w-2xl">
        <CardHeader title={periodLabel(p.period)} subtitle={p.description} action={<Badge tone={p.status === "paid" ? "green" : "amber"}>{p.status}</Badge>} />
        <div className="space-y-1 p-5">
          <InfoRow label="Teacher">{`${profile.fullName} (${profile.teacherId})`}</InfoRow>
          <InfoRow label="Basic salary">{fmtLKR(p.basic)}</InfoRow>
          <InfoRow label="Allowances">{fmtLKR(p.allowances)}</InfoRow>
          <InfoRow label="Deductions">{`− ${fmtLKR(p.deductions)}`}</InfoRow>
          <InfoRow label="Net salary">{fmtLKR(p.net)}</InfoRow>
          <InfoRow label="Payment date">{p.paymentDate ? fmtDate(p.paymentDate) : "Not yet paid"}</InfoRow>
          <InfoRow label="Reference">{p.reference}</InfoRow>
          <InfoRow label="Method">{p.method}</InfoRow>
        </div>
        <div className="border-t border-line p-5">{p.status === "paid" ? <Button onClick={receipt}><Download className="h-4 w-4" /> Download PDF receipt</Button> : <p className="text-sm text-muted">A receipt becomes available once this salary is paid.</p>}</div>
      </Card>
    </>
  );
}
