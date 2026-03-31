"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  normalizeTextCustomizationKey,
  normalizeTextCustomizationValue,
} from "@/lib/text-customization-shared";

type DraftOverrideMap = Record<string, string | null>;
type TextCustomizationContextValue = {
  activateEditMode: () => Promise<boolean>;
  deactivateEditMode: () => boolean;
  isEditMode: boolean;
  isLoadingEditor: boolean;
  isSaving: boolean;
  pendingCount: number;
  saveChanges: () => Promise<boolean>;
  statusMessage: string | null;
};

type WrappedTextNodeState = {
  key: string;
  leadingWhitespace: string;
  trailingWhitespace: string;
};

const TextCustomizationContext =
  createContext<TextCustomizationContextValue | null>(null);

const excludedTagNames = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "SVG",
  "PATH",
  "TITLE",
]);
const editModeStorageKey = "scm-global-text-edit-mode";
const cachedCatalogStorageKey = "scm-global-text-edit-catalog";
const cachedOverridesStorageKey = "scm-global-text-edit-overrides";

function mergeOverrides(
  savedOverrides: Record<string, string>,
  draftOverrides: DraftOverrideMap,
) {
  const nextOverrides = { ...savedOverrides };

  Object.entries(draftOverrides).forEach(([key, value]) => {
    if (value === null) {
      delete nextOverrides[key];
      return;
    }

    nextOverrides[key] = value;
  });

  return nextOverrides;
}

function focusEditableElement(element: HTMLElement) {
  element.focus();

  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getInteractiveAncestor(element: HTMLElement) {
  const interactiveAncestor = element.closest<HTMLElement>(
    "a, button, label, summary, [role='button'], [role='link']",
  );

  if (!interactiveAncestor) {
    return null;
  }

  return interactiveAncestor;
}

async function readJsonResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function readCachedStringArray(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : null;
  } catch {
    return null;
  }
}

function readCachedStringRecord(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return Object.entries(parsed).reduce<Record<string, string>>((record, [entryKey, value]) => {
      if (typeof value === "string") {
        record[entryKey] = value;
      }

      return record;
    }, {});
  } catch {
    return null;
  }
}

function cacheEditModeSnapshot(
  nextCatalog: string[] | null,
  nextOverrides: Record<string, string>,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (nextCatalog) {
    window.localStorage.setItem(cachedCatalogStorageKey, JSON.stringify(nextCatalog));
  }

  window.localStorage.setItem(cachedOverridesStorageKey, JSON.stringify(nextOverrides));
}

function setStoredEditModeState(isEnabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (isEnabled) {
    window.localStorage.setItem(editModeStorageKey, "true");
  } else {
    window.localStorage.removeItem(editModeStorageKey);
  }
}

export function TextCustomizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string>>({});
  const [draftOverrides, setDraftOverrides] = useState<DraftOverrideMap>({});
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const wrappedNodeStateRef = useRef(new WeakMap<HTMLElement, WrappedTextNodeState>());
  const scanFrameRef = useRef<number | null>(null);
  const savedOverridesRef = useRef(savedOverrides);
  const draftOverridesRef = useRef(draftOverrides);

  const pendingCount = Object.keys(draftOverrides).length;
  const effectiveOverrides = mergeOverrides(savedOverrides, draftOverrides);

  useEffect(() => {
    savedOverridesRef.current = savedOverrides;
  }, [savedOverrides]);

  useEffect(() => {
    draftOverridesRef.current = draftOverrides;
  }, [draftOverrides]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPublicSnapshot() {
      const response = await fetch("/api/text-customization", {
        cache: "no-store",
        method: "GET",
      });
      const payload = await readJsonResponse<{
        overrides?: Record<string, string>;
      }>(response);

      if (!response.ok || isCancelled) {
        return;
      }

      savedOverridesRef.current = payload?.overrides ?? {};
      setSavedOverrides(payload?.overrides ?? {});
    }

    void loadPublicSnapshot();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(editModeStorageKey) !== "true") {
      return;
    }

    const cachedCatalog = readCachedStringArray(cachedCatalogStorageKey);
    const cachedOverrides = readCachedStringRecord(cachedOverridesStorageKey) ?? {};

    if (!cachedCatalog || cachedCatalog.length === 0) {
      return;
    }

    setCatalog(cachedCatalog);
    savedOverridesRef.current = cachedOverrides;
    setSavedOverrides(cachedOverrides);
    setIsEditMode(true);
    setStatusMessage(
      "Text edit mode is active. Click highlighted static text to edit it inline.",
    );
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) {
      return;
    }

    const wrappedNodeState = wrappedNodeStateRef.current;
    const activeTextKeys = new Set<string>(Object.keys(effectiveOverrides));

    if (isEditMode && catalog) {
      catalog.forEach((key) => {
        activeTextKeys.add(key);
      });
    }

    const canWrapStaticText = isEditMode && catalog !== null;

    function getEffectiveTextValue(key: string) {
      return effectiveOverrides[key] ?? key;
    }

    function updateWrappedElement(element: HTMLElement) {
      const state = wrappedNodeState.get(element);

      if (!state) {
        return;
      }

      const nextTextContent = `${state.leadingWhitespace}${getEffectiveTextValue(
        state.key,
      )}${state.trailingWhitespace}`;

      if (document.activeElement !== element && element.textContent !== nextTextContent) {
        element.textContent = nextTextContent;
      }

      const isEditable = canWrapStaticText && activeTextKeys.has(state.key);
      const hasPendingDraft = Object.prototype.hasOwnProperty.call(draftOverrides, state.key);

      element.classList.toggle("is-active", isEditable);
      element.classList.toggle("is-modified", hasPendingDraft);

      if (isEditable) {
        element.contentEditable = "true";
        element.spellcheck = false;
        element.tabIndex = 0;
      } else {
        element.removeAttribute("contenteditable");
        element.removeAttribute("tabindex");
      }
    }

    function resolveTextKey(rawValue: string) {
      const normalized = normalizeTextCustomizationKey(rawValue);

      if (!normalized || !activeTextKeys.has(normalized)) {
        return null;
      }

      return normalized;
    }

    function isTextNodeEligible(node: Text) {
      const parentElement = node.parentElement;

      if (!parentElement) {
        return false;
      }

      if (!node.textContent || !normalizeTextCustomizationKey(node.textContent)) {
        return false;
      }

      if (excludedTagNames.has(parentElement.tagName)) {
        return false;
      }

      if (parentElement.isContentEditable) {
        return false;
      }

      if (parentElement.closest("[data-static-text-node='true']")) {
        return false;
      }

      if (
        parentElement.closest("[data-text-edit-exclude='true']") ||
        parentElement.closest("[data-text-edit-runtime='true']")
      ) {
        return false;
      }

      return true;
    }

    function wrapTextNode(node: Text, key: string) {
      const parentElement = node.parentElement;

      if (!parentElement) {
        return;
      }

      const rawValue = node.textContent ?? "";
      const leadingWhitespace = rawValue.match(/^\s*/)?.[0] ?? "";
      const trailingWhitespace = rawValue.match(/\s*$/)?.[0] ?? "";
      const wrappedElement = document.createElement("span");

      wrappedElement.dataset.staticTextNode = "true";
      wrappedElement.dataset.staticTextKey = key;
      wrappedElement.className = "global-text-editable-node";

      wrappedNodeState.set(wrappedElement, {
        key,
        leadingWhitespace,
        trailingWhitespace,
      });

      parentElement.replaceChild(wrappedElement, node);
      updateWrappedElement(wrappedElement);
    }

    function refreshEditableNodes() {
      document
        .querySelectorAll<HTMLElement>("[data-static-text-node='true']")
        .forEach(updateWrappedElement);

      if (!canWrapStaticText && activeTextKeys.size === 0) {
        return;
      }

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return isTextNodeEligible(node as Text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      const textNodes: Text[] = [];
      let currentNode = walker.nextNode();

      while (currentNode) {
        textNodes.push(currentNode as Text);
        currentNode = walker.nextNode();
      }

      textNodes.forEach((textNode) => {
        const key = resolveTextKey(textNode.textContent ?? "");

        if (key) {
          wrapTextNode(textNode, key);
        }
      });
    }

    function scheduleRefresh() {
      if (scanFrameRef.current !== null) {
        return;
      }

      scanFrameRef.current = window.requestAnimationFrame(() => {
        scanFrameRef.current = null;
        refreshEditableNodes();
      });
    }

    function commitElementDraft(element: HTMLElement) {
      const state = wrappedNodeState.get(element);

      if (!state) {
        return;
      }

      const nextValue = normalizeTextCustomizationValue(element.textContent ?? "");
      const nextDraftValue = nextValue === state.key ? null : nextValue;
      const nextDrafts = { ...draftOverridesRef.current };
      const hasSavedOverride = Object.prototype.hasOwnProperty.call(
        savedOverridesRef.current,
        state.key,
      );

      if (nextDraftValue === null) {
        if (hasSavedOverride) {
          nextDrafts[state.key] = null;
        } else {
          delete nextDrafts[state.key];
        }
      } else {
        nextDrafts[state.key] = nextDraftValue;
      }

      draftOverridesRef.current = nextDrafts;
      setDraftOverrides(nextDrafts);
    }

    function handleClick(event: MouseEvent) {
      if (!canWrapStaticText) {
        return;
      }

      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const editableElement = target.closest<HTMLElement>("[data-static-text-node='true']");

      if (!editableElement) {
        return;
      }

      const interactiveAncestor = getInteractiveAncestor(editableElement);

      if (interactiveAncestor && !event.shiftKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusEditableElement(editableElement);
    }

    function handleFocusOut(event: FocusEvent) {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (!target.matches("[data-static-text-node='true']")) {
        return;
      }

      commitElementDraft(target);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (!(target instanceof HTMLElement) || !target.matches("[data-static-text-node='true']")) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        target.blur();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        const state = wrappedNodeState.get(target);

        if (!state) {
          return;
        }

        target.textContent = `${state.leadingWhitespace}${getEffectiveTextValue(
          state.key,
        )}${state.trailingWhitespace}`;
        target.blur();
      }
    }

    function handlePaste(event: ClipboardEvent) {
      const target = event.target;

      if (!(target instanceof HTMLElement) || !target.matches("[data-static-text-node='true']")) {
        return;
      }

      event.preventDefault();

      const pastedText =
        normalizeTextCustomizationValue(event.clipboardData?.getData("text/plain") ?? "");
      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0) {
        return;
      }

      selection.deleteFromDocument();

      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(pastedText);

      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    refreshEditableNodes();

    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("click", handleClick, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("paste", handlePaste, true);

    return () => {
      observer.disconnect();

      if (scanFrameRef.current !== null) {
        window.cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
      }

      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [catalog, draftOverrides, isEditMode, savedOverrides]);

  async function activateEditMode() {
    setStatusMessage(null);

    if (!catalog) {
      setIsLoadingEditor(true);

      const response = await fetch("/api/system-settings/text-customization", {
        cache: "no-store",
        method: "GET",
      });
      const payload = await readJsonResponse<{
        catalog?: string[];
        error?: string;
        overrides?: Record<string, string>;
      }>(response);

      setIsLoadingEditor(false);

      if (!response.ok || !payload?.catalog) {
        setStatusMessage(
          payload?.error ?? "Could not open global text edit mode right now.",
        );
        return false;
      }

      setCatalog(payload.catalog);
      savedOverridesRef.current = payload.overrides ?? {};
      setSavedOverrides(payload.overrides ?? {});
      cacheEditModeSnapshot(payload.catalog, payload.overrides ?? {});
    } else {
      cacheEditModeSnapshot(catalog, savedOverridesRef.current);
    }

    setStoredEditModeState(true);
    setIsEditMode(true);
    setStatusMessage(
      "Text edit mode is active. Click any highlighted static text to edit it inline.",
    );
    return true;
  }

  function deactivateEditMode() {
    if (
      pendingCount > 0 &&
      !window.confirm("Leave text edit mode and discard unsaved text changes?")
    ) {
      return false;
    }

    if (pendingCount > 0) {
      draftOverridesRef.current = {};
      setDraftOverrides({});
    }

    setStoredEditModeState(false);
    setIsEditMode(false);
    setStatusMessage(null);
    return true;
  }

  async function saveChanges() {
    setIsSaving(true);
    setStatusMessage(null);

    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (activeElement?.matches("[data-static-text-node='true']")) {
      activeElement.blur();
    }

    const nextOverrides = mergeOverrides(
      savedOverridesRef.current,
      draftOverridesRef.current,
    );

    if (Object.keys(draftOverridesRef.current).length === 0) {
      setIsSaving(false);
      setStatusMessage("There are no text changes to save yet.");
      return true;
    }

    const response = await fetch("/api/system-settings/text-customization", {
      cache: "no-store",
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        overrides: nextOverrides,
      }),
    });
    const payload = await readJsonResponse<{
      error?: string;
      overrides?: Record<string, string>;
    }>(response);

    setIsSaving(false);

    if (!response.ok || !payload?.overrides) {
      setStatusMessage(payload?.error ?? "Could not save the global text changes.");
      return false;
    }

    savedOverridesRef.current = payload.overrides;
    draftOverridesRef.current = {};
    setSavedOverrides(payload.overrides);
    setDraftOverrides({});
    cacheEditModeSnapshot(catalog, payload.overrides);
    setStatusMessage("Global text changes saved.");
    return true;
  }

  return (
    <TextCustomizationContext.Provider
      value={{
        activateEditMode,
        deactivateEditMode,
        isEditMode,
        isLoadingEditor,
        isSaving,
        pendingCount,
        saveChanges,
        statusMessage,
      }}
    >
      {children}

      {isEditMode ? (
        <div className="global-text-edit-toolbar" data-text-edit-runtime="true">
          <div className="global-text-edit-toolbar-copy">
            <p className="eyebrow">TEXT EDIT MODE</p>
            <strong>Static interface text is editable inline</strong>
            <p>
              {pendingCount > 0
                ? `${pendingCount} unsaved change${pendingCount === 1 ? "" : "s"} ready to publish globally.`
                : "Click highlighted text to edit it. Inside links and buttons, use Shift + click so normal navigation still works."}
            </p>
          </div>

          <div className="global-text-edit-toolbar-actions">
            {statusMessage ? (
              <p className="global-text-edit-toolbar-status">{statusMessage}</p>
            ) : null}

            <button
              type="button"
              className="button ghost"
              onClick={deactivateEditMode}
              disabled={isSaving}
            >
              Exit edit mode
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                void saveChanges();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save global text changes"}
            </button>
          </div>
        </div>
      ) : null}
    </TextCustomizationContext.Provider>
  );
}

export function useTextCustomization() {
  const context = useContext(TextCustomizationContext);

  if (!context) {
    throw new Error("useTextCustomization must be used inside TextCustomizationProvider.");
  }

  return context;
}
