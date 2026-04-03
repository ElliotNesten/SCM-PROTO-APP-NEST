"use client";

import { useMemo, useState } from "react";

import { PredefinedAutocompleteInput } from "@/components/predefined-autocomplete-input";
import {
  hasRepresentativeOptionDisplayName,
  type ScmRepresentativeOption,
} from "@/lib/scm-representative-options";
import { getPredefinedSuggestions } from "@/lib/predefined-suggestions";

type ScmRepresentativeSelectorProps = {
  label: string;
  className?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  persistedValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  scmStaffOptions: ScmRepresentativeOption[];
  temporaryGigManagerOptions: ScmRepresentativeOption[];
  temporaryGigManagerFieldName?: string;
  onValueChange?: (value: string) => void;
  onTemporaryGigManagerSelect?: (
    option: ScmRepresentativeOption,
  ) => Promise<void> | void;
  showTemporaryGigManagerOption?: boolean;
  scmStaffHelperText?: string;
  temporaryGigManagerHelperText?: string;
  onSelectionValidityChange?: (isValid: boolean) => void;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSearchScore(option: ScmRepresentativeOption, query: string) {
  const normalizedFullName = normalizeSearchValue(`${option.firstName} ${option.lastName}`);
  const normalizedEmail = normalizeSearchValue(option.email);
  const normalizedBadge = normalizeSearchValue(option.badge);
  const normalizedDetail = normalizeSearchValue(option.detail);
  const normalizedCountry = normalizeSearchValue(option.country);
  const normalizedRegion = normalizeSearchValue(option.region);
  const normalizedTokens = normalizedFullName.split(/\s+/).filter(Boolean);

  if (
    !normalizedFullName.includes(query) &&
    !normalizedEmail.includes(query) &&
    !normalizedBadge.includes(query) &&
    !normalizedDetail.includes(query) &&
    !normalizedCountry.includes(query) &&
    !normalizedRegion.includes(query)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  if (normalizedFullName === query || normalizedEmail === query) {
    return 1200;
  }

  if (normalizedFullName.startsWith(query)) {
    return 1100;
  }

  if (normalizedTokens.some((token) => token.startsWith(query))) {
    return 1000;
  }

  if (normalizedFullName.includes(query)) {
    return 900;
  }

  if (normalizedEmail.startsWith(query)) {
    return 840;
  }

  if (normalizedEmail.includes(query)) {
    return 780;
  }

  if (normalizedRegion.includes(query) || normalizedCountry.includes(query)) {
    return 700;
  }

  return 620;
}

function filterRepresentativeOptions(
  options: ScmRepresentativeOption[],
  query: string,
  maxResults = 8,
) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return options.slice(0, maxResults);
  }

  return options
    .map((option, index) => ({
      option,
      score: getSearchScore(option, normalizedQuery) - index * 0.001,
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults)
    .map((entry) => entry.option);
}

export function ScmRepresentativeSelector({
  label,
  className = "field",
  name,
  value,
  defaultValue = "",
  persistedValue = "",
  placeholder,
  required = false,
  disabled = false,
  scmStaffOptions,
  temporaryGigManagerOptions,
  temporaryGigManagerFieldName,
  onValueChange,
  onTemporaryGigManagerSelect,
  showTemporaryGigManagerOption = true,
  scmStaffHelperText = "Type to search and choose an SCM Staff profile.",
  temporaryGigManagerHelperText = "Choose a Staff profile to use as Temporary Gig Manager for this gig.",
  onSelectionValidityChange,
}: ScmRepresentativeSelectorProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [temporaryGigManagerQuery, setTemporaryGigManagerQuery] = useState("");
  const [showTemporaryGigManagerPicker, setShowTemporaryGigManagerPicker] = useState(false);
  const [selectedTemporaryGigManagerId, setSelectedTemporaryGigManagerId] = useState("");
  const [selectedTemporaryGigManagerName, setSelectedTemporaryGigManagerName] = useState("");
  const [isScmRepresentativeValid, setIsScmRepresentativeValid] = useState(
    () => (!required ? true : Boolean((value ?? defaultValue).trim())),
  );
  const currentValue = value ?? internalValue;
  const scmStaffNames = useMemo(
    () => Array.from(new Set(scmStaffOptions.map((option) => `${option.firstName} ${option.lastName}`))),
    [scmStaffOptions],
  );
  const filteredTemporaryGigManagerOptions = useMemo(
    () => filterRepresentativeOptions(temporaryGigManagerOptions, temporaryGigManagerQuery),
    [temporaryGigManagerOptions, temporaryGigManagerQuery],
  );
  const isAllowedRepresentativeValue = useMemo(
    () => (candidate: string) =>
      hasRepresentativeOptionDisplayName(scmStaffOptions, candidate) ||
      hasRepresentativeOptionDisplayName(temporaryGigManagerOptions, candidate) ||
      normalizeSearchValue(candidate) === normalizeSearchValue(persistedValue),
    [persistedValue, scmStaffOptions, temporaryGigManagerOptions],
  );

  function getScmStaffSuggestions(query: string, maxResults = 6) {
    return getPredefinedSuggestions(scmStaffNames, query, maxResults);
  }

  function updateValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  function clearTemporaryGigManagerSelection() {
    setSelectedTemporaryGigManagerId("");
    setSelectedTemporaryGigManagerName("");
  }

  function handleInputValueChange(nextValue: string) {
    if (
      selectedTemporaryGigManagerId &&
      nextValue.trim() !== selectedTemporaryGigManagerName
    ) {
      clearTemporaryGigManagerSelection();
    }
  }

  function handleScmRepresentativeValueChange(nextValue: string) {
    updateValue(nextValue);
    handleInputValueChange(nextValue);
  }

  function handleScmStaffSuggestionSelected() {
    clearTemporaryGigManagerSelection();
  }

  function handleScmRepresentativeValidityChange(isValid: boolean) {
    setIsScmRepresentativeValid(isValid);
    onSelectionValidityChange?.(isValid);
  }

  async function selectTemporaryGigManagerOption(option: ScmRepresentativeOption) {
    setSelectedTemporaryGigManagerId(option.id);
    setSelectedTemporaryGigManagerName(`${option.firstName} ${option.lastName}`);
    updateValue(`${option.firstName} ${option.lastName}`);
    setTemporaryGigManagerQuery("");
    setShowTemporaryGigManagerPicker(false);
    await onTemporaryGigManagerSelect?.(option);
  }

  return (
    <div className={className}>
      <span>{label}</span>

      <div className="scm-representative-selector">
        <PredefinedAutocompleteInput
          name={name}
          value={currentValue}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          getSuggestions={getScmStaffSuggestions}
          allowCustomValue={false}
          isValueAllowed={isAllowedRepresentativeValue}
          onValueChange={handleScmRepresentativeValueChange}
          onInputValueChange={handleInputValueChange}
          onSuggestionSelected={handleScmStaffSuggestionSelected}
          onValidityChange={handleScmRepresentativeValidityChange}
          emptyStateMessage="No matching SCM Staff profile found."
          helperMessage={scmStaffHelperText}
          invalidSelectionMessage={
            showTemporaryGigManagerOption
              ? "Choose an SCM Staff profile from the list, or use Temporary Gig Manager."
              : "Choose an SCM Staff profile from the list."
          }
        />

        {temporaryGigManagerFieldName ? (
          <input
            type="hidden"
            name={temporaryGigManagerFieldName}
            value={selectedTemporaryGigManagerId}
          />
        ) : null}

        {!isScmRepresentativeValid ? (
          <p className="small-text scm-representative-selector-error">
            {showTemporaryGigManagerOption
              ? "Choose an SCM Staff profile from the list, or use Temporary Gig Manager."
              : "Choose an SCM Staff profile from the list."}
          </p>
        ) : null}

        <div className="segmented-row scm-representative-selector-actions">
          {showTemporaryGigManagerOption ? (
            <button
              type="button"
              className={`segment-chip segment-chip-soft ${
                showTemporaryGigManagerPicker ? "active" : ""
              }`}
              disabled={disabled}
              onClick={() => {
                setShowTemporaryGigManagerPicker((current) => !current);
                setTemporaryGigManagerQuery("");
              }}
            >
              {showTemporaryGigManagerPicker
                ? "Hide Temporary Gig Manager"
                : "Temporary Gig Manager"}
            </button>
          ) : null}
        </div>

        {showTemporaryGigManagerPicker ? (
          <div className="scm-representative-selector-panel">
            <label className="field scm-representative-selector-search">
              <span>Search Staff profiles</span>
              <input
                type="search"
                value={temporaryGigManagerQuery}
                placeholder="Search by name, email, region..."
                disabled={disabled}
                onChange={(event) => setTemporaryGigManagerQuery(event.currentTarget.value)}
              />
            </label>

            <div className="scm-representative-selector-results">
              {filteredTemporaryGigManagerOptions.length === 0 ? (
                <p className="muted small-text">
                  No matching staff profiles found.
                </p>
              ) : (
                filteredTemporaryGigManagerOptions.map((option) => (
                  <button
                    key={`temporaryGigManager-${option.id}`}
                    type="button"
                    className="temporary-gig-manager-result scm-representative-selector-result"
                    data-text-edit-exclude="true"
                    disabled={disabled}
                    onClick={() => {
                      void selectTemporaryGigManagerOption(option);
                    }}
                  >
                    <span>
                      <strong>{option.firstName} {option.lastName}</strong>
                      <small>
                        {option.badge} | {option.email}
                      </small>
                      <small>{option.detail}</small>
                    </span>
                    <span>Use</span>
                  </button>
                ))
              )}
            </div>

            <p className="small-text scm-representative-selector-helper">
              {temporaryGigManagerHelperText}
            </p>
          </div>
        ) : null}

        {selectedTemporaryGigManagerId ? (
          <p className="small-text scm-representative-selector-status">
            Temporary Gig Manager linked from Staff profiles.
          </p>
        ) : null}
      </div>
    </div>
  );
}
