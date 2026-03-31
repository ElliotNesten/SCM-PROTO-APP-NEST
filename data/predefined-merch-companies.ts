import { getPredefinedSuggestions, type PredefinedSuggestion } from "@/lib/predefined-suggestions";

export const predefinedMerchCompanyNames = [
  "Bravado",
  "COS",
  "Merchtraffic",
  "Global",
  "Probity",
  "Sandbag",
  "Warner",
  "Nylon Merch",
  "Bingo Merch",
  "MFL \u2013 Merchandising for Life",
  "BSI \u2013 Backstreet Merchandising",
  "Kings Road",
  "Merchworld",
  "Rektor",
  "Bravado DE",
  "Eiche Rustikal",
] as const;

export function getMerchCompanySuggestions(
  query: string,
  maxResults = 6,
): PredefinedSuggestion[] {
  return getPredefinedSuggestions(predefinedMerchCompanyNames, query, maxResults);
}
