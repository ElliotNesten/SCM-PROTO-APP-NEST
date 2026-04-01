import Link from "next/link";
import { notFound } from "next/navigation";

import { StaffAppPayrollSnapshotDetails } from "@/components/staff-app/payroll-snapshot-details";
import { getStaffAppDocuments } from "@/lib/staff-app-data";
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

      <StaffAppPayrollSnapshotDetails payslip={payslip} />
    </section>
  );
}
