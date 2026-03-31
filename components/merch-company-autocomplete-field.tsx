"use client";

import { PredefinedAutocompleteInput } from "@/components/predefined-autocomplete-input";
import { getMerchCompanySuggestions } from "@/data/predefined-merch-companies";

type MerchCompanyAutocompleteFieldProps = {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

export function MerchCompanyAutocompleteField({
  name,
  label,
  value,
  defaultValue = "",
  placeholder = "SCM",
  disabled = false,
  onValueChange,
}: MerchCompanyAutocompleteFieldProps) {
  const input = (
    <PredefinedAutocompleteInput
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      getSuggestions={getMerchCompanySuggestions}
      onValueChange={onValueChange}
      emptyStateMessage="No predefined merch companies match yet. You can still save your own custom company."
      helperMessage="Suggestions are optional. You can always keep typing your own merch company."
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
