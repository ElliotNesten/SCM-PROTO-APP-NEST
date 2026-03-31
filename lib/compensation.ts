import type {
  CompensationCountry,
  CompensationCurrency,
  CompensationRateMatrix,
  CompensationSource,
} from "@/types/compensation";
import {
  compensationCountries,
  compensationCurrencyByCountry,
  createDefaultCompensationRateMatrix,
  isCompensationCountry,
} from "@/types/compensation";
import {
  staffRoleKeys,
  type StaffRoleKey,
  type StoredStaffRoleProfiles,
} from "@/types/staff-role";

export const defaultHourlyRate = 130;

export function normalizeHourlyRate(
  value: unknown,
  fallback = defaultHourlyRate,
) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(1, Math.round(numericValue));
}

export function normalizeHourlyRateOverride(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const normalizedValue = normalizeHourlyRate(value, Number.NaN);
  return Number.isFinite(normalizedValue) ? normalizedValue : null;
}

export function getCompensationCountry(country: string): CompensationCountry {
  const normalizedCountry = country.trim();

  if (isCompensationCountry(normalizedCountry)) {
    return normalizedCountry;
  }

  return "Sweden";
}

export function getCompensationCurrency(country: string): CompensationCurrency {
  return compensationCurrencyByCountry[getCompensationCountry(country)];
}

export function normalizeCompensationRateMatrix(
  rateMatrix: Partial<CompensationRateMatrix> | null | undefined,
) {
  const fallbackRates = createDefaultCompensationRateMatrix(defaultHourlyRate);

  return Object.fromEntries(
    compensationCountries.map((country) => [
      country,
      Object.fromEntries(
        staffRoleKeys.map((roleKey) => [
          roleKey,
          normalizeHourlyRate(
            rateMatrix?.[country]?.[roleKey],
            fallbackRates[country][roleKey],
          ),
        ]),
      ),
    ]),
  ) as CompensationRateMatrix;
}

export function formatHourlyRateLabel(country: string, hourlyRate: number) {
  return `${getCompensationCurrency(country)} ${normalizeHourlyRate(hourlyRate)} / h`;
}

export function getStandardHourlyRate(
  country: string,
  roleKey: StaffRoleKey,
  defaultHourlyRates: CompensationRateMatrix,
) {
  const normalizedCountry = getCompensationCountry(country);
  const hourlyRate = normalizeHourlyRate(
    defaultHourlyRates[normalizedCountry]?.[roleKey],
    defaultHourlyRate,
  );

  return {
    country: normalizedCountry,
    currency: getCompensationCurrency(normalizedCountry),
    hourlyRate,
    source: "standard" as CompensationSource,
    label: formatHourlyRateLabel(normalizedCountry, hourlyRate),
  };
}

export function resolveEffectiveHourlyRate(args: {
  country: string;
  roleKey: StaffRoleKey;
  roleProfiles?: Partial<StoredStaffRoleProfiles> | null;
  defaultHourlyRates: CompensationRateMatrix;
}) {
  const { country, roleKey, roleProfiles, defaultHourlyRates } = args;
  const standardRate = getStandardHourlyRate(country, roleKey, defaultHourlyRates);
  const overrideRate = normalizeHourlyRateOverride(
    roleProfiles?.[roleKey]?.hourlyRateOverride,
  );
  const hourlyRate = overrideRate ?? standardRate.hourlyRate;
  const source: CompensationSource =
    overrideRate === null ? "standard" : "profileOverride";

  return {
    country: standardRate.country,
    currency: standardRate.currency,
    hourlyRate,
    source,
    label: formatHourlyRateLabel(standardRate.country, hourlyRate),
  };
}

export function sanitizeHourlyRateOverride(
  hourlyRateOverride: unknown,
  country: string,
  roleKey: StaffRoleKey,
  defaultHourlyRates: CompensationRateMatrix,
) {
  const normalizedOverride = normalizeHourlyRateOverride(hourlyRateOverride);

  if (normalizedOverride === null) {
    return null;
  }

  const standardRate = getStandardHourlyRate(country, roleKey, defaultHourlyRates);
  return normalizedOverride === standardRate.hourlyRate ? null : normalizedOverride;
}

export function sanitizeRoleProfileHourlyRateOverrides(
  roleProfiles: StoredStaffRoleProfiles,
  country: string,
  defaultHourlyRates: CompensationRateMatrix,
) {
  return Object.fromEntries(
    staffRoleKeys.map((roleKey) => [
      roleKey,
      {
        ...roleProfiles[roleKey],
        hourlyRateOverride: sanitizeHourlyRateOverride(
          roleProfiles[roleKey].hourlyRateOverride,
          country,
          roleKey,
          defaultHourlyRates,
        ),
      },
    ]),
  ) as StoredStaffRoleProfiles;
}
