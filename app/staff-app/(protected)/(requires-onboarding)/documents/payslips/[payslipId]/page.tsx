import Link from "next/link";
import { notFound } from "next/navigation";

import { formatStaffAppDate, getStaffAppDocuments } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppPayslipPageProps = {
  params: Promise<{ payslipId: string }>;
};

export default async function StaffAppPayslipPage({
  params,
}: StaffAppPayslipPageProps) {
  const account = await requireCurrentStaffAppAccount();
  const { payslipId } = await params;
  const documents = await getStaffAppDocuments(account);
  const payslip = documents.payslips.find((entry) => entry.id === payslipId);

  if (!payslip) {
    notFound();
  }

  return (
    <section className="staff-app-screen">
      <Link href="/staff-app/documents" className="staff-app-back-link">
        Back to documents
      </Link>

      <div className="staff-app-card emphasis">
        <p className="staff-app-kicker">Payslip</p>
        <h1>{payslip.monthLabel}</h1>
        <p className="staff-app-muted">Issued {formatStaffAppDate(payslip.issuedAt)}</p>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Net pay</span>
            <strong>{payslip.netPayLabel}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Gross pay</span>
            <strong>{payslip.grossPayLabel}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Summary</span>
            <strong>{payslip.summary}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
