import { resolveEffectiveHourlyRate } from "@/lib/compensation";
import { getAllStoredGigs } from "@/lib/gig-store";
import { getAllStoredShifts } from "@/lib/shift-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import type { StaffAppAccount, StaffAppPayslip, StaffAppPayslipEntry } from "@/types/staff-app";
import type { StaffRoleKey } from "@/types/staff-role";

const PAYROLL_CUTOFF_DAY = 20;
const MEAL_BENEFIT_TAX_PER_MEAL = 20;
const stockholmDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const stockholmMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm",
  month: "long",
  year: "numeric",
});
const stockholmDatePartFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type PayrollPeriod = {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  monthLabel: string;
};

type PayrollAccumulator = {
  period: PayrollPeriod;
  entries: StaffAppPayslipEntry[];
  grossTotalsByCurrency: Map<string, number>;
  totalWorkedMinutes: number;
  mealBenefitTaxCount: number;
  gigIds: Set<string>;
  latestRecordedAt: string;
};

function mapShiftRoleToStaffRoleKey(role: string): StaffRoleKey {
  if (role === "Seller" || role === "Stand Leader" || role === "Runner") {
    return role;
  }

  return "Other";
}

function formatDate(value: string) {
  const parsedValue = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return stockholmDateFormatter.format(parsedValue);
}

function formatMonthLabel(value: string) {
  const parsedValue = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return stockholmMonthFormatter.format(parsedValue);
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildDateKey(year: number, month: number, day: number) {
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const shiftedMonthIndex = year * 12 + (month - 1) + delta;

  return {
    year: Math.floor(shiftedMonthIndex / 12),
    month: (shiftedMonthIndex % 12) + 1,
  };
}

function getStockholmDateParts(value: string) {
  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return null;
  }

  const parts = stockholmDatePartFormatter.formatToParts(parsedValue);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function resolvePayrollPeriod(value: string): PayrollPeriod | null {
  const parts = getStockholmDateParts(value);

  if (!parts) {
    return null;
  }

  const startMonth =
    parts.day >= PAYROLL_CUTOFF_DAY
      ? { year: parts.year, month: parts.month }
      : shiftMonth(parts.year, parts.month, -1);
  const endMonth = shiftMonth(startMonth.year, startMonth.month, 1);
  const periodStart = buildDateKey(startMonth.year, startMonth.month, PAYROLL_CUTOFF_DAY);
  const periodEnd = buildDateKey(endMonth.year, endMonth.month, PAYROLL_CUTOFF_DAY);

  return {
    id: `payslip-${periodStart.replace(/-/g, "")}`,
    periodStart,
    periodEnd,
    periodLabel: `${formatDate(periodStart)} to ${formatDate(periodEnd)}`,
    monthLabel: formatMonthLabel(periodEnd),
  };
}

function toStockholmDateKey(value: string) {
  const parts = getStockholmDateParts(value);

  if (!parts) {
    return null;
  }

  return buildDateKey(parts.year, parts.month, parts.day);
}

function getWorkedMinutes(checkedIn: string, checkedOut: string) {
  const checkedInValue = new Date(checkedIn);
  const checkedOutValue = new Date(checkedOut);

  if (
    Number.isNaN(checkedInValue.getTime()) ||
    Number.isNaN(checkedOutValue.getTime())
  ) {
    return null;
  }

  const diffInMinutes = Math.round(
    (checkedOutValue.getTime() - checkedInValue.getTime()) / 60000,
  );

  if (!Number.isFinite(diffInMinutes) || diffInMinutes <= 0) {
    return null;
  }

  return diffInMinutes;
}

function formatWorkedHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${padNumber(remainingMinutes)}m`;
}

function formatCurrencyAmount(amount: number, currency: string) {
  const roundedAmount = Number(amount.toFixed(2));
  const showDecimals = Math.abs(roundedAmount - Math.round(roundedAmount)) > 0.001;

  return `${currency.trim().toUpperCase()} ${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(roundedAmount)}`;
}

function formatKronaAmount(amount: number) {
  return `${new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))} kr`;
}

function addCurrencyAmount(
  totalsByCurrency: Map<string, number>,
  currency: string,
  amount: number,
) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const currentAmount = totalsByCurrency.get(normalizedCurrency) ?? 0;
  totalsByCurrency.set(
    normalizedCurrency,
    Number((currentAmount + amount).toFixed(2)),
  );
}

function formatCurrencyTotals(totalsByCurrency: Map<string, number>) {
  return [...totalsByCurrency.entries()]
    .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
    .map(([currency, amount]) => formatCurrencyAmount(amount, currency))
    .join(" + ");
}

function buildSummary(periodLabel: string, gigCount: number, shiftCount: number) {
  const gigLabel = gigCount === 1 ? "gig" : "gigs";
  const shiftLabel = shiftCount === 1 ? "approved pass" : "approved passes";

  return `${gigCount} ${gigLabel} and ${shiftCount} ${shiftLabel} in payroll period ${periodLabel}.`;
}

export async function getStaffAppPayrollSnapshots(account: StaffAppAccount) {
  const linkedStaffId = account.linkedStaffProfileId?.trim() ?? "";

  if (!linkedStaffId) {
    return [] as StaffAppPayslip[];
  }

  const [gigs, shifts, staffProfile, compensationSettings] = await Promise.all([
    getAllStoredGigs(),
    getAllStoredShifts(),
    getStoredStaffProfileById(linkedStaffId),
    getSystemCompensationSettings(),
  ]);
  const gigsById = new Map(gigs.map((gig) => [gig.id, gig]));
  const payrollByPeriod = new Map<string, PayrollAccumulator>();

  shifts.forEach((shift) => {
    const assignment = shift.assignments.find(
      (currentAssignment) =>
        currentAssignment.staffId === linkedStaffId &&
        currentAssignment.bookingStatus === "Confirmed" &&
        currentAssignment.timeReportApproved === true &&
        currentAssignment.checkedIn?.trim() &&
        currentAssignment.checkedOut?.trim(),
    );

    if (!assignment?.checkedIn || !assignment.checkedOut) {
      return;
    }

    const gig = gigsById.get(shift.gigId);
    const workedMinutes = getWorkedMinutes(assignment.checkedIn, assignment.checkedOut);
    const payrollAnchor =
      assignment.timeReportApprovedAt?.trim() || assignment.checkedOut;
    const payrollPeriod = resolvePayrollPeriod(payrollAnchor);

    if (!gig || workedMinutes === null || !payrollPeriod) {
      return;
    }

    const resolvedRate =
      typeof assignment.hourlyRate === "number" &&
      Number.isFinite(assignment.hourlyRate) &&
      typeof assignment.hourlyRateCurrency === "string" &&
      assignment.hourlyRateCurrency.trim().length > 0
        ? {
            hourlyRate: assignment.hourlyRate,
            currency: assignment.hourlyRateCurrency.trim().toUpperCase(),
          }
        : resolveEffectiveHourlyRate({
            country: staffProfile?.country ?? account.country,
            roleKey: mapShiftRoleToStaffRoleKey(shift.role),
            roleProfiles: staffProfile?.roleProfiles,
            defaultHourlyRates: compensationSettings.defaultHourlyRates,
          });
    const grossPayAmount = Number(
      ((workedMinutes / 60) * resolvedRate.hourlyRate).toFixed(2),
    );
    const mealBenefitCount =
      (assignment.lunchProvided ? 1 : 0) + (assignment.dinnerProvided ? 1 : 0);
    const entry: StaffAppPayslipEntry = {
      id: `${payrollPeriod.id}-${shift.id}`,
      gigId: gig.id,
      shiftId: shift.id,
      gigName: gig.artist,
      date: gig.date,
      dateLabel: formatDate(gig.date),
      role: shift.role,
      workedHoursLabel: formatWorkedHours(workedMinutes),
      hourlyRateLabel: `${resolvedRate.currency} ${Math.round(resolvedRate.hourlyRate)} / h`,
      grossCalculationLabel: `${formatWorkedHours(workedMinutes)} x ${resolvedRate.currency} ${Math.round(
        resolvedRate.hourlyRate,
      )} / h`,
      grossPayLabel: formatCurrencyAmount(grossPayAmount, resolvedRate.currency),
      mealBenefitCount,
      mealBenefitTaxLabel: formatKronaAmount(
        mealBenefitCount * MEAL_BENEFIT_TAX_PER_MEAL,
      ),
    };
    const currentPeriod =
      payrollByPeriod.get(payrollPeriod.id) ??
      {
        period: payrollPeriod,
        entries: [],
        grossTotalsByCurrency: new Map<string, number>(),
        totalWorkedMinutes: 0,
        mealBenefitTaxCount: 0,
        gigIds: new Set<string>(),
        latestRecordedAt: payrollAnchor,
      } satisfies PayrollAccumulator;

    currentPeriod.entries.push(entry);
    addCurrencyAmount(
      currentPeriod.grossTotalsByCurrency,
      resolvedRate.currency,
      grossPayAmount,
    );
    currentPeriod.totalWorkedMinutes += workedMinutes;
    currentPeriod.mealBenefitTaxCount += mealBenefitCount;
    currentPeriod.gigIds.add(gig.id);
    currentPeriod.latestRecordedAt =
      new Date(payrollAnchor).getTime() > new Date(currentPeriod.latestRecordedAt).getTime()
        ? payrollAnchor
        : currentPeriod.latestRecordedAt;
    payrollByPeriod.set(payrollPeriod.id, currentPeriod);
  });

  return [...payrollByPeriod.values()]
    .sort((left, right) =>
      right.period.periodStart.localeCompare(left.period.periodStart),
    )
    .map<StaffAppPayslip>((period) => ({
      id: period.period.id,
      monthLabel: period.period.monthLabel,
      issuedAt: toStockholmDateKey(period.latestRecordedAt) ?? period.period.periodEnd,
      periodStart: period.period.periodStart,
      periodEnd: period.period.periodEnd,
      periodLabel: period.period.periodLabel,
      grossPayLabel: formatCurrencyTotals(period.grossTotalsByCurrency),
      totalWorkedHoursLabel: formatWorkedHours(period.totalWorkedMinutes),
      mealBenefitTaxLabel: formatKronaAmount(
        period.mealBenefitTaxCount * MEAL_BENEFIT_TAX_PER_MEAL,
      ),
      mealBenefitTaxCount: period.mealBenefitTaxCount,
      gigCount: period.gigIds.size,
      shiftCount: period.entries.length,
      summary: buildSummary(
        period.period.periodLabel,
        period.gigIds.size,
        period.entries.length,
      ),
      entries: [...period.entries].sort((left, right) => {
        if (left.date !== right.date) {
          return right.date.localeCompare(left.date);
        }

        return left.gigName.localeCompare(right.gigName);
      }),
    }));
}
