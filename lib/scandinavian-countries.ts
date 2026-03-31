export const scandinavianCountryOptions = [
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
] as const;

export type ScandinavianCountry = (typeof scandinavianCountryOptions)[number];

export function isScandinavianCountry(value: string): value is ScandinavianCountry {
  return scandinavianCountryOptions.includes(value as ScandinavianCountry);
}

export function normalizeScandinavianCountry(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";
  return isScandinavianCountry(trimmedValue) ? trimmedValue : null;
}
