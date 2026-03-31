"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type {
  PredefinedSuggestion,
  PredefinedSuggestionReason,
} from "@/lib/predefined-suggestions";

type PredefinedAutocompleteInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  getSuggestions: (query: string, maxResults?: number) => PredefinedSuggestion[];
  allowCustomValue?: boolean;
  isValueAllowed?: (value: string) => boolean;
  onValueChange?: (value: string) => void;
  onInputValueChange?: (value: string) => void;
  onSuggestionSelected?: (suggestion: PredefinedSuggestion) => void;
  onValidityChange?: (isValid: boolean) => void;
  emptyStateMessage: string;
  helperMessage: string;
  invalidSelectionMessage?: string;
};

function normalizeAutocompleteValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getReasonLabel(reason: PredefinedSuggestionReason) {
  if (reason === "exact") {
    return "Exact match";
  }

  if (reason === "startsWith") {
    return "Starts with your text";
  }

  if (reason === "contains") {
    return "Contains your text";
  }

  return "Similar option";
}

export function PredefinedAutocompleteInput({
  name,
  value,
  defaultValue = "",
  placeholder,
  required = false,
  disabled = false,
  getSuggestions,
  allowCustomValue = true,
  isValueAllowed,
  onValueChange,
  onInputValueChange,
  onSuggestionSelected,
  onValidityChange,
  emptyStateMessage,
  helperMessage,
  invalidSelectionMessage = "Choose one of the suggested options.",
}: PredefinedAutocompleteInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [draftValue, setDraftValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const committedValue = value ?? internalValue;
  const currentValue = allowCustomValue ? committedValue : draftValue;
  const suggestions = getSuggestions(currentValue);
  const activeSuggestion = activeIndex >= 0 ? suggestions[activeIndex] : null;
  const shouldShowPanel = isOpen && currentValue.trim().length > 0;
  const committedValueAllowed = allowCustomValue
    ? true
    : (isValueAllowed?.(committedValue) ?? committedValue.trim().length > 0);
  const hasCommittedSelection =
    committedValue.trim().length > 0 &&
    normalizeAutocompleteValue(currentValue) === normalizeAutocompleteValue(committedValue) &&
    committedValueAllowed;
  const isCurrentValueValid =
    allowCustomValue || (currentValue.trim().length === 0 ? !required : hasCommittedSelection);
  const hiddenInputValue = !allowCustomValue
    ? currentValue.trim().length === 0
      ? ""
      : hasCommittedSelection
        ? committedValue
        : ""
    : "";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!allowCustomValue) {
      setDraftValue(committedValue);
    }
  }, [allowCustomValue, committedValue]);

  useEffect(() => {
    onValidityChange?.(isCurrentValueValid);
  }, [isCurrentValueValid, onValidityChange]);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    if (!allowCustomValue && currentValue.trim().length > 0 && !hasCommittedSelection) {
      inputRef.current.setCustomValidity(invalidSelectionMessage);
      return;
    }

    inputRef.current.setCustomValidity("");
  }, [allowCustomValue, currentValue, hasCommittedSelection, invalidSelectionMessage]);

  function updateCommittedValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  function findExactSuggestion(query: string) {
    const normalizedQuery = normalizeAutocompleteValue(query);

    if (!normalizedQuery) {
      return null;
    }

    return (
      getSuggestions(query, 12).find(
        (suggestion) => normalizeAutocompleteValue(suggestion.name) === normalizedQuery,
      ) ?? null
    );
  }

  function selectSuggestion(suggestion: PredefinedSuggestion) {
    updateCommittedValue(suggestion.name);
    setDraftValue(suggestion.name);
    setIsOpen(false);
    setActiveIndex(-1);
    onInputValueChange?.(suggestion.name);
    onSuggestionSelected?.(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && isOpen && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
      return;
    }

    if (event.key === "Enter" && !allowCustomValue) {
      const exactSuggestion = findExactSuggestion(currentValue);

      if (exactSuggestion) {
        event.preventDefault();
        selectSuggestion(exactSuggestion);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`predefined-autocomplete${shouldShowPanel ? " open" : ""}`}
    >
      {!allowCustomValue && name ? (
        <input type="hidden" name={name} value={hiddenInputValue} />
      ) : null}

      <input
        ref={inputRef}
        type="text"
        name={allowCustomValue ? name : undefined}
        value={currentValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={shouldShowPanel}
        aria-invalid={!isCurrentValueValid}
        aria-controls={shouldShowPanel ? listboxId : undefined}
        aria-activedescendant={
          shouldShowPanel && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          onInputValueChange?.(nextValue);

          if (allowCustomValue) {
            updateCommittedValue(nextValue);
          } else {
            setDraftValue(nextValue);

            if (!nextValue.trim()) {
              updateCommittedValue("");
            } else {
              const exactSuggestion = findExactSuggestion(nextValue);

              if (exactSuggestion) {
                updateCommittedValue(exactSuggestion.name);
              }
            }
          }

          setIsOpen(nextValue.trim().length > 0);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (currentValue.trim()) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
      />

      {shouldShowPanel ? (
        <div className="predefined-autocomplete-panel" role="listbox" id={listboxId}>
          {suggestions.length === 0 ? (
            <div className="predefined-autocomplete-status">{emptyStateMessage}</div>
          ) : (
            <div className="predefined-autocomplete-list">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.name}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`predefined-autocomplete-option${
                    activeIndex === index ? " active" : ""
                  }`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <strong>{suggestion.name}</strong>
                  <small>{getReasonLabel(suggestion.reason)}</small>
                </button>
              ))}
            </div>
          )}

          <p className="predefined-autocomplete-footer">{helperMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
