import type { StaffAppPayslip } from "@/types/staff-app";

const foodBenefitLabel = "F\u00D6RM\u00C5NSSKATT MAT";

export function StaffAppPayrollSnapshotDetails({
  payslip,
}: {
  payslip: StaffAppPayslip;
}) {
  return (
    <>
      <div className="staff-app-card emphasis">
        <p className="staff-app-kicker">Payroll snapshot</p>
        <h1>{payslip.monthLabel}</h1>
        <p className="staff-app-muted">Payroll period {payslip.periodLabel}</p>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Gross pay</span>
            <strong>{payslip.grossPayLabel}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>{foodBenefitLabel}</span>
            <strong>{payslip.mealBenefitTaxLabel}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Approved passes</span>
            <strong>{payslip.shiftCount}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Worked time</span>
            <strong>{payslip.totalWorkedHoursLabel}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Summary</span>
            <strong>{payslip.summary}</strong>
          </div>
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Breakdown</p>
            <h2>Approved passes</h2>
          </div>
          <span className="staff-app-badge neutral">{payslip.entries.length}</span>
        </div>

        {payslip.entries.length === 0 ? (
          <div className="staff-app-empty-state">
            No approved time reports were found for this payroll period.
          </div>
        ) : (
          <div className="staff-app-list">
            {payslip.entries.map((entry) => (
              <article
                key={entry.id}
                className="staff-app-list-card staff-app-payslip-entry-card"
              >
                <div>
                  <h3>{entry.gigName}</h3>
                  <p>
                    {entry.dateLabel} - {entry.role}
                  </p>
                  <p>{entry.grossCalculationLabel}</p>
                  {entry.mealBenefitCount > 0 ? (
                    <p>
                      {foodBenefitLabel} - {entry.mealBenefitTaxLabel}
                    </p>
                  ) : null}
                </div>

                <div className="staff-app-payslip-entry-amounts">
                  <strong>{entry.grossPayLabel}</strong>
                  <span>{entry.hourlyRateLabel}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
