import Link from "next/link";

import { StaffAppDocumentsBrowser } from "@/components/staff-app/documents-browser";
import { getStaffAppDocuments } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppDocumentsPage() {
  const account = await requireCurrentStaffAppAccount();
  const documents = await getStaffAppDocuments(account);

  return (
    <section className="staff-app-screen staff-app-documents-screen">
      <StaffAppDocumentsBrowser
        employmentContracts={documents.employmentContracts}
        timeReports={documents.timeReports}
      />

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Payslips</p>
            <h2>Payroll snapshots</h2>
          </div>
          <span className="staff-app-badge neutral">{documents.payslips.length}</span>
        </div>

        {documents.payslips.length === 0 ? (
          <div className="staff-app-empty-state">
            Payroll snapshots appear once approved time reports have been registered
            inside a 20th-to-20th payroll window.
          </div>
        ) : (
          <div className="staff-app-list">
            {documents.payslips.map((payslip) => (
              <Link
                key={payslip.id}
                href={`/staff-app/documents/payslips/${payslip.id}`}
                className="staff-app-list-card"
              >
                <div>
                  <h3>{payslip.monthLabel}</h3>
                  <p>{payslip.grossPayLabel}</p>
                  <p>{payslip.periodLabel}</p>
                </div>
                <span className="staff-app-mini-link">Preview</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
