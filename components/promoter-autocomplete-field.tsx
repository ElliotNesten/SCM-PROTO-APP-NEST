"use client";

import { PredefinedAutocompleteInput } from "@/components/predefined-autocomplete-input";
import { getPromoterSuggestions } from "@/data/predefined-promoters";

type PromoterAutocompleteFieldProps = {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

export function PromoterAutocompleteField({
  name,
  label,
  value,
  defaultValue = "",
  placeholder = "LIVE NATION",
  disabled = false,
  onValueChange,
}: PromoterAutocompleteFieldProps) {
  const input = (
    <PredefinedAutocompleteInput
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      getSuggestions={getPromoterSuggestions}
      onValueChange={onValueChange}
      emptyStateMessage="No predefined promoters match yet. You can still save your own custom promoter."
      helperMessage="Suggestions are optional. You can always keep typing your own promoter."
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
