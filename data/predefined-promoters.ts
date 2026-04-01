import { getPredefinedSuggestions, type PredefinedSuggestion } from "@/lib/predefined-suggestions";

export const predefinedPromoterNames = [
  "A COMIC SOUL",
  "AEG",
  "ALL THINGS LIVE",
  "Cannonball ApS",
  "DOWN THE DRAIN",
  "DTD CONCERTS",
  "ETTA ENTERTAINMENT",
  "FKP SCORPIO",
  "FULLSTEAM",
  "GREY BEARD/TUSKA LIVE",
  "Holgerhund LIVE",
  "JULIUS PRODUCTION",
  "KIART SVERIGE",
  "LIFELINE",
  "LIVE NATION",
  "LUGER",
  "NHL",
  "PDC",
  "RUSH ENT.",
  "RUSSEDRESS",
  "SHOWBIZZ CONCERTS ApS",
  "SMASH!BANG!POW!",
  "STAGEWAY & ALL THINGS LIVE",
  "STAR ENTERTAINMENT",
  "Sustainable Punk AB",
  "TORNADOBOOKING",
  "TUSKA LIVE",
  "UNITED STAGE",
  "WARNER FIN",
  "WARNER MUSIC",
  "WB CONCERTS",
] as const;

export function getPromoterSuggestions(
  query: string,
  maxResults = 6,
): PredefinedSuggestion[] {
  return getPredefinedSuggestions(predefinedPromoterNames, query, maxResults);
}
