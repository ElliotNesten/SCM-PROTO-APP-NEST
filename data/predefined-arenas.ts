import { getPredefinedSuggestions, type PredefinedSuggestion } from "@/lib/predefined-suggestions";
import type { ScandinavianCountry } from "@/lib/scandinavian-countries";

export type ArenaCatalogEntry = {
  id: string;
  name: string;
  city: string;
  country: ScandinavianCountry;
  aliases: string[];
};

export type ArenaCatalogLocation = {
  city: string;
  country: ScandinavianCountry;
};

export const defaultArenaCatalog: ArenaCatalogEntry[] = [
  {
    id: "se-avicii-arena",
    name: "Avicii Arena",
    city: "Stockholm",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "dk-boxen",
    name: "Boxen",
    city: "Herning",
    country: "Denmark",
    aliases: ["Boxen Herning"],
  },
  {
    id: "dk-forum-cph",
    name: "Forum CPH",
    city: "Copenhagen",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-forum-horsens",
    name: "Forum Horsens",
    city: "Horsens",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-jyske-bank-boxen",
    name: "Jyske Bank Boxen",
    city: "Herning",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-kb-hallen",
    name: "KB Hallen",
    city: "Copenhagen",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-royal-arena",
    name: "Royal Arena",
    city: "Copenhagen",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-tap1",
    name: "TAP1",
    city: "Copenhagen",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "dk-parken",
    name: "Parken",
    city: "Copenhagen",
    country: "Denmark",
    aliases: [],
  },
  {
    id: "no-oslo-spektrum",
    name: "Oslo Spektrum",
    city: "Oslo",
    country: "Norway",
    aliases: ["Spektrum"],
  },
  {
    id: "no-sentrum-scene",
    name: "Sentrum Scene",
    city: "Oslo",
    country: "Norway",
    aliases: [],
  },
  {
    id: "no-unity-arena",
    name: "Unity Arena",
    city: "Oslo",
    country: "Norway",
    aliases: [],
  },
  {
    id: "no-nova-spektrum",
    name: "Nova Spektrum",
    city: "Lillestr\u00f8m",
    country: "Norway",
    aliases: [],
  },
  {
    id: "no-koengen",
    name: "Koengen",
    city: "Bergen",
    country: "Norway",
    aliases: [],
  },
  {
    id: "no-plenen",
    name: "Plenen",
    city: "Bergen",
    country: "Norway",
    aliases: [],
  },
  {
    id: "no-dnb-arena",
    name: "DNB Arena",
    city: "Stavanger",
    country: "Norway",
    aliases: ["DNB Arena Stavanger"],
  },
  {
    id: "no-trondheim-spektrum",
    name: "Trondheim Spektrum",
    city: "Trondheim",
    country: "Norway",
    aliases: [],
  },
  {
    id: "se-cirkus",
    name: "Cirkus",
    city: "Stockholm",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-fryshuset",
    name: "Fryshuset",
    city: "Stockholm",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-filadelfia",
    name: "Filadelfia",
    city: "Stockholm",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-grona-lund",
    name: "Gr\u00f6na Lund",
    city: "Stockholm",
    country: "Sweden",
    aliases: ["Gronan", "Gr\u00f6na Lund", "Gr\u00f6nan"],
  },
  {
    id: "se-scandinavium",
    name: "Scandinavium",
    city: "G\u00f6teborg",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-ullevi",
    name: "Ullevi",
    city: "G\u00f6teborg",
    country: "Sweden",
    aliases: ["ULLEVI"],
  },
  {
    id: "se-partille-arena",
    name: "Partille Arena",
    city: "G\u00f6teborg",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-malmo-arena",
    name: "Malm\u00f6 Arena",
    city: "Malm\u00f6",
    country: "Sweden",
    aliases: ["Malmo Arena"],
  },
  {
    id: "se-saab-arena",
    name: "Saab Arena",
    city: "Link\u00f6ping",
    country: "Sweden",
    aliases: [],
  },
  {
    id: "se-lofbergs-arena",
    name: "L\u00f6fbergs Arena",
    city: "Karlstad",
    country: "Sweden",
    aliases: ["L\u00f6fbergs Arena", "Lofbergs Lila", "L\u00f6fbergs Lila"],
  },
  {
    id: "fi-veikkaus-arena",
    name: "Veikkaus Arena",
    city: "Helsinki",
    country: "Finland",
    aliases: [],
  },
  {
    id: "fi-icehall",
    name: "Icehall",
    city: "Helsinki",
    country: "Finland",
    aliases: ["Ice Hall"],
  },
  {
    id: "fi-olympia-stadion",
    name: "Olympia Stadion",
    city: "Helsinki",
    country: "Finland",
    aliases: [],
  },
  {
    id: "fi-nokia-arena",
    name: "Nokia Arena",
    city: "Tampere",
    country: "Finland",
    aliases: [],
  },
];

export function normalizeArenaLookupValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getArenaLocationByName(
  arenaCatalog: readonly ArenaCatalogEntry[],
  value: string,
): ArenaCatalogLocation | null {
  const normalizedValue = normalizeArenaLookupValue(value);

  if (!normalizedValue) {
    return null;
  }

  for (const arena of arenaCatalog) {
    const searchValues = [arena.name, ...arena.aliases];

    if (searchValues.some((entry) => normalizeArenaLookupValue(entry) === normalizedValue)) {
      return {
        city: arena.city,
        country: arena.country,
      };
    }
  }

  return null;
}

export function getArenaSuggestions(
  arenaCatalog: readonly ArenaCatalogEntry[],
  query: string,
  maxResults = 6,
): PredefinedSuggestion[] {
  const searchableArenaNames = arenaCatalog.flatMap((arena) => [arena.name, ...arena.aliases]);
  const suggestions = getPredefinedSuggestions(searchableArenaNames, query, maxResults * 3);
  const seenArenaIds = new Set<string>();
  const uniqueSuggestions: PredefinedSuggestion[] = [];

  for (const suggestion of suggestions) {
    const arena = arenaCatalog.find((entry) =>
      [entry.name, ...entry.aliases].some(
        (value) => normalizeArenaLookupValue(value) === normalizeArenaLookupValue(suggestion.name),
      ),
    );

    if (!arena || seenArenaIds.has(arena.id)) {
      continue;
    }

    seenArenaIds.add(arena.id);
    uniqueSuggestions.push({
      name: arena.name,
      reason: suggestion.reason,
    });

    if (uniqueSuggestions.length === maxResults) {
      break;
    }
  }

  return uniqueSuggestions;
}
