"use client";

import { PredefinedAutocompleteInput } from "@/components/predefined-autocomplete-input";
import {
  defaultArenaCatalog,
  getArenaSuggestions,
  type ArenaCatalogEntry,
} from "@/data/predefined-arenas";

type ArenaAutocompleteFieldProps = {
  name?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  arenaCatalog?: readonly ArenaCatalogEntry[];
};

export function ArenaAutocompleteField({
  name,
  label,
  value,
  placeholder,
  required = false,
  defaultValue = "",
  disabled = false,
  onValueChange,
  arenaCatalog = defaultArenaCatalog,
}: ArenaAutocompleteFieldProps) {
  const input = (
    <PredefinedAutocompleteInput
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      getSuggestions={(query, maxResults) => getArenaSuggestions(arenaCatalog, query, maxResults)}
      onValueChange={onValueChange}
      emptyStateMessage="No predefined arenas match yet. You can still save your own custom venue."
      helperMessage="Suggestions are optional. You can always keep typing your own arena name."
    />
  );

  if (!label) {
    return input;
  }

  return (
    <div className="field">
      <span>{label}</span>
      {input}
    </div>
  );
}
