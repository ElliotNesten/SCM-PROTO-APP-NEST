import { staffRoleKeys, type StaffRoleKey } from "@/types/staff-role";

export const compensationCountries = [
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
] as const;

export type CompensationCountry = (typeof compensationCountries)[number];

export type CompensationCurrency = "SEK" | "NOK" | "DKK" | "EUR";

export type CompensationSource = "standard" | "profileOverride";

export type CompensationRateMatrix = Record<
  CompensationCountry,
  Record<StaffRoleKey, number>
>;

export interface SystemCompensationSettings {
  defaultHourlyRates: CompensationRateMatrix;
  updatedAt?: string;
}

export const compensationCurrencyByCountry: Record<
  CompensationCountry,
  CompensationCurrency
> = {
  Sweden: "SEK",
  Norway: "NOK",
  Denmark: "DKK",
  Finland: "EUR",
};

export function isCompensationCountry(
  value: string,
): value is CompensationCountry {
  return compensationCountries.includes(value as CompensationCountry);
}

export function createDefaultCompensationRateMatrix(
  defaultHourlyRate = 130,
): CompensationRateMatrix {
  return Object.fromEntries(
    compensationCountries.map((country) => [
      country,
      Object.fromEntries(
        staffRoleKeys.map((roleKey) => [roleKey, defaultHourlyRate]),
      ),
    ]),
  ) as CompensationRateMatrix;
}
