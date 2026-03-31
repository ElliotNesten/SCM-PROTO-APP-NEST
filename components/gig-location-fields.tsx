"use client";

import { useState } from "react";

import { ArenaAutocompleteField } from "@/components/arena-autocomplete-field";
import { getArenaLocationByName, type ArenaCatalogEntry } from "@/data/predefined-arenas";
import { scandinavianCountryOptions } from "@/lib/scandinavian-countries";

type GigLocationFieldsProps = {
  arenaCatalog: readonly ArenaCatalogEntry[];
  initialArena?: string;
  initialCity?: string;
  initialCountry?: string;
};

export function GigLocationFields({
  arenaCatalog,
  initialArena = "",
  initialCity = "",
  initialCountry = "",
}: GigLocationFieldsProps) {
  const [arena, setArena] = useState(initialArena);
  const [city, setCity] = useState(initialCity);
  const [country, setCountry] = useState(initialCountry);

  function handleArenaChange(nextArena: string) {
    const linkedLocation = getArenaLocationByName(arenaCatalog, nextArena);

    setArena(nextArena);

    if (!linkedLocation) {
      return;
    }

    setCity(linkedLocation.city);
    setCountry(linkedLocation.country);
  }

  return (
    <>
      <ArenaAutocompleteField
        name="arena"
        label="Arena"
        value={arena}
        arenaCatalog={arenaCatalog}
        placeholder="Avicii Arena"
        required
        onValueChange={handleArenaChange}
      />

      <label className="field">
        <span>City</span>
        <input
          name="city"
          value={city}
          placeholder="Stockholm"
          required
          onChange={(event) => setCity(event.currentTarget.value)}
        />
      </label>

      <label className="field">
        <span>Country</span>
        <select
          name="country"
          value={country}
          required
          onChange={(event) => setCountry(event.currentTarget.value)}
        >
          <option value="" disabled>
            Select country
          </option>
          {scandinavianCountryOptions.map((countryOption) => (
            <option key={countryOption} value={countryOption}>
              {countryOption}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
