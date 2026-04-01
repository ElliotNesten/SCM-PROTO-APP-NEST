"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ArenaCatalogEntry } from "@/data/predefined-arenas";
import type { PublicUploadStorageStatus } from "@/lib/public-file-storage";
import { scandinavianCountryOptions } from "@/lib/scandinavian-countries";
import {
  createEmptyStaffAppScmInfoPdfSlots,
  STAFF_APP_SCM_INFO_PDF_LIMIT,
} from "@/lib/system-scm-info-pdf-shared";
import type {
  StaffAppScmInfoItemPdfSectionKey,
  StaffAppScmInfoPdfAsset,
  SystemScmInfoPdfSettings,
} from "@/lib/system-scm-info-pdf-shared";
import { getSystemScmInfoItemPdfKey } from "@/lib/system-scm-info-pdf-shared";
import type {
  StaffAppScmInfoSectionKey,
  StaffAppScmInfoSettings,
} from "@/lib/system-scm-info-store";

type EditableGuideSectionKey =
  | "rolesTraining"
  | "checklists"
  | "platformInfo"
  | "cashCard";

type EditableArenaFieldKey =
  | "pageTitle"
  | "pageDescription"
  | "fallbackArenaNoteTemplate"
  | "emptyStateMessage";

type OpenPanelKey = "summary" | "pdfs" | "content" | null;

const editorSections: Array<{
  id: StaffAppScmInfoSectionKey;
  label: string;
}> = [
  { id: "rolesTraining", label: "Roles & Training" },
  { id: "checklists", label: "Checklists" },
  { id: "platformInfo", label: "SCM Info" },
  { id: "policy", label: "Policy" },
  { id: "arenaInfo", label: "Arena Info" },
];

function isEditableGuideSection(
  sectionId: StaffAppScmInfoSectionKey,
): sectionId is EditableGuideSectionKey {
  return (
    sectionId === "rolesTraining" ||
    sectionId === "checklists" ||
    sectionId === "platformInfo" ||
    sectionId === "cashCard"
  );
}

function buildSectionUploadKey(sectionId: StaffAppScmInfoSectionKey, slotIndex: number) {
  return `section:${sectionId}:${slotIndex}`;
}

function buildItemUploadKey(
  sectionId: EditableGuideSectionKey,
  itemIndex: number,
  slotIndex: number,
) {
  return `item:${sectionId}:${itemIndex}:${slotIndex}`;
}

function getPdfSlots(slots: StaffAppScmInfoPdfAsset[] | undefined) {
  const nextSlots = createEmptyStaffAppScmInfoPdfSlots();

  for (let index = 0; index < STAFF_APP_SCM_INFO_PDF_LIMIT; index += 1) {
    if (slots?.[index]) {
      nextSlots[index] = {
        ...nextSlots[index],
        ...slots[index],
      };
    }
  }

  return nextSlots;
}

function countUploadedPdfs(slots: StaffAppScmInfoPdfAsset[]) {
  return slots.filter((slot) => Boolean(slot.pdfUrl)).length;
}

function getPreviewValue(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 140).trim()}...`;
}

function createEmptyArenaCatalogEntry(): ArenaCatalogEntry {
  return {
    id: `arena-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    city: "",
    country: "Sweden",
    aliases: [],
  };
}

function formatArenaAliases(aliases: string[]) {
  return aliases.join(", ");
}

function SystemSettingsAccordionChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={
        open
          ? "system-settings-scm-info-accordion-icon open"
          : "system-settings-scm-info-accordion-icon"
      }
    >
      <path
        d="m7 4 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SystemSettingsScmInfoAccordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="system-settings-scm-info-panel">
      <button
        type="button"
        className={
          open
            ? "system-settings-scm-info-panel-toggle open"
            : "system-settings-scm-info-panel-toggle"
        }
        onClick={onToggle}
      >
        <span className="system-settings-scm-info-panel-copy">
          <strong>{title}</strong>
          {summary ? <span>{summary}</span> : null}
        </span>
        <SystemSettingsAccordionChevron open={open} />
      </button>

      {open ? <div className="system-settings-scm-info-panel-body">{children}</div> : null}
    </section>
  );
}

function SystemSettingsScmInfoTextPreviewField({
  label,
  value,
  placeholder,
  rows,
  isEditing,
  onToggle,
  onChange,
  className,
}: {
  label: string;
  value: string;
  placeholder: string;
  rows: number;
  isEditing: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={["system-settings-scm-info-text-field", className].filter(Boolean).join(" ")}
    >
      <div className="system-settings-scm-info-text-field-head">
        <span>{label}</span>
        <button
          type="button"
          className="button ghost system-settings-scm-info-mini-button"
          onClick={onToggle}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      {isEditing ? (
        <textarea
          className="input system-settings-scm-info-textarea"
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : (
        <button
          type="button"
          className="system-settings-scm-info-preview-card"
          onClick={onToggle}
        >
          {getPreviewValue(value, placeholder)}
        </button>
      )}
    </div>
  );
}

function SystemSettingsScmInfoPdfRows({
  title,
  slots,
  uploadingKey,
  deletingKey,
  isPending,
  onRegisterInput,
  onTriggerUpload,
  onLabelChange,
  onUpload,
  onDelete,
  buildUploadKey,
  uploadEnabled,
}: {
  title: string;
  slots: StaffAppScmInfoPdfAsset[];
  uploadingKey: string | null;
  deletingKey: string | null;
  isPending: boolean;
  onRegisterInput: (key: string, element: HTMLInputElement | null) => void;
  onTriggerUpload: (key: string) => void;
  onLabelChange: (slotIndex: number, value: string) => void;
  onUpload: (slotIndex: number, file: File) => void;
  onDelete: (slotIndex: number) => void;
  buildUploadKey: (slotIndex: number) => string;
  uploadEnabled: boolean;
}) {
  return (
    <div className="system-settings-scm-info-card">
      <div className="system-settings-scm-info-card-head">
        <strong>{title}</strong>
      </div>

      <div className="system-settings-scm-info-pdf-list">
        {slots.map((slot, slotIndex) => {
          const uploadKey = buildUploadKey(slotIndex);
          const isUploading = uploadingKey === uploadKey;
          const isDeleting = deletingKey === uploadKey;

          return (
            <div key={uploadKey} className="system-settings-scm-info-pdf-row">
              <div className="system-settings-scm-info-pdf-row-meta">
                <strong>{`PDF ${slotIndex + 1}`}</strong>
                <span>{slot.fileName || "No file uploaded"}</span>
              </div>

              <label className="field-label system-settings-scm-info-pdf-label">
                Button label
                <input
                  className="input"
                  value={slot.buttonLabel}
                  placeholder={`Open PDF ${slotIndex + 1}`}
                  onChange={(event) => onLabelChange(slotIndex, event.currentTarget.value)}
                />
              </label>

              <input
                ref={(node) => onRegisterInput(uploadKey, node)}
                className="gig-image-input"
                type="file"
                accept=".pdf,application/pdf"
                disabled={!uploadEnabled}
                onChange={(event) => {
                  const nextFile = event.currentTarget.files?.[0] ?? null;

                  if (!nextFile) {
                    return;
                  }

                  onUpload(slotIndex, nextFile);
                }}
              />

              <div className="system-settings-scm-info-pdf-actions">
                <button
                  type="button"
                  className="button ghost system-settings-scm-info-mini-button"
                  onClick={() => onTriggerUpload(uploadKey)}
                  disabled={!uploadEnabled || isUploading || isDeleting || isPending}
                >
                  {!uploadEnabled
                    ? "Unavailable"
                    : isUploading
                      ? "Uploading..."
                      : slot.pdfUrl
                        ? "Replace"
                        : "Upload"}
                </button>

                {slot.pdfUrl ? (
                  <a
                    href={slot.pdfUrl}
                    className="button ghost system-settings-scm-info-mini-button"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview
                  </a>
                ) : null}

                {slot.pdfUrl ? (
                  <button
                    type="button"
                    className="button ghost danger-outline system-settings-scm-info-mini-button"
                    onClick={() => onDelete(slotIndex)}
                    disabled={isUploading || isDeleting || isPending}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SystemSettingsScmInfoEditor({
  initialSettings,
  initialPdfs,
  uploadStatus,
}: {
  initialSettings: StaffAppScmInfoSettings;
  initialPdfs: SystemScmInfoPdfSettings;
  uploadStatus: PublicUploadStorageStatus;
}) {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [settings, setSettings] = useState(initialSettings);
  const [pdfSettings, setPdfSettings] = useState(initialPdfs);
  const [activeSection, setActiveSection] =
    useState<StaffAppScmInfoSectionKey>("rolesTraining");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanelKey>("summary");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadDisabled = !uploadStatus.available;

  const activeSectionMeta = editorSections.find((section) => section.id === activeSection)!;
  const activeSectionPagePdfs =
    activeSection === "policy" ? [] : getPdfSlots(pdfSettings.sectionPdfs[activeSection]);

  function selectSection(sectionId: StaffAppScmInfoSectionKey) {
    setActiveSection(sectionId);
    setOpenPanel("summary");
    setEditingField(null);
  }

  function togglePanel(panel: OpenPanelKey) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function toggleEditingField(fieldKey: string) {
    setEditingField((current) => (current === fieldKey ? null : fieldKey));
  }

  function updateHubField(field: "hubKicker" | "hubTitle", value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateHubCardField(
    sectionId: StaffAppScmInfoSectionKey,
    field: "title" | "subtitle",
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      hubCards: {
        ...current.hubCards,
        [sectionId]: {
          ...current.hubCards[sectionId],
          [field]: value,
        },
      },
    }));
  }

  function updateGuideSectionField(
    sectionId: EditableGuideSectionKey,
    field: "pageTitle" | "pageDescription",
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        [field]: value,
      },
    }));
  }

  function updateGuideItemField(
    sectionId: EditableGuideSectionKey,
    index: number,
    field: "title" | "subtitle" | "body",
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        items: current[sectionId].items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  }

  function updateArenaField(
    field: EditableArenaFieldKey,
    value: string,
  ) {
    setSettings((current) => ({
      ...current,
      arenaInfo: {
        ...current.arenaInfo,
        [field]: value,
      },
    }));
  }

  function addArenaCatalogEntry() {
    setSettings((current) => ({
      ...current,
      arenaInfo: {
        ...current.arenaInfo,
        catalog: [...current.arenaInfo.catalog, createEmptyArenaCatalogEntry()],
      },
    }));
  }

  function updateArenaCatalogEntry<Key extends keyof Pick<ArenaCatalogEntry, "name" | "city" | "country">>(
    arenaId: string,
    field: Key,
    value: ArenaCatalogEntry[Key],
  ) {
    setSettings((current) => ({
      ...current,
      arenaInfo: {
        ...current.arenaInfo,
        catalog: current.arenaInfo.catalog.map((arena) =>
          arena.id === arenaId ? { ...arena, [field]: value } : arena,
        ),
      },
    }));
  }

  function updateArenaCatalogAliases(arenaId: string, value: string) {
    setSettings((current) => ({
      ...current,
      arenaInfo: {
        ...current.arenaInfo,
        catalog: current.arenaInfo.catalog.map((arena) =>
          arena.id === arenaId
            ? {
                ...arena,
                aliases: value
                  .split(",")
                  .map((alias) => alias.trim())
                  .filter(Boolean),
              }
            : arena,
        ),
      },
    }));
  }

  function removeArenaCatalogEntry(arenaId: string) {
    setSettings((current) => ({
      ...current,
      arenaInfo: {
        ...current.arenaInfo,
        catalog: current.arenaInfo.catalog.filter((arena) => arena.id !== arenaId),
      },
    }));
  }

  function updateSectionPdfLabel(
    sectionId: StaffAppScmInfoSectionKey,
    slotIndex: number,
    value: string,
  ) {
    setPdfSettings((current) => ({
      ...current,
      sectionPdfs: {
        ...current.sectionPdfs,
        [sectionId]: getPdfSlots(current.sectionPdfs[sectionId]).map((slot, currentIndex) =>
          currentIndex === slotIndex ? { ...slot, buttonLabel: value } : slot,
        ),
      },
    }));
  }

  function updateItemPdfLabel(
    sectionId: EditableGuideSectionKey,
    itemIndex: number,
    slotIndex: number,
    value: string,
  ) {
    const itemKey = getSystemScmInfoItemPdfKey(sectionId, itemIndex);

    setPdfSettings((current) => ({
      ...current,
      itemPdfs: {
        ...current.itemPdfs,
        [itemKey]: getPdfSlots(current.itemPdfs[itemKey]).map((slot, currentIndex) =>
          currentIndex === slotIndex ? { ...slot, buttonLabel: value } : slot,
        ),
      },
    }));
  }

  function registerInput(key: string, element: HTMLInputElement | null) {
    fileInputRefs.current[key] = element;
  }

  function triggerUpload(key: string) {
    if (uploadDisabled) {
      setFeedbackMessage(uploadStatus.message);
      return;
    }

    fileInputRefs.current[key]?.click();
  }

  async function uploadPdf(
    target:
      | {
          targetType: "section";
          sectionId: StaffAppScmInfoSectionKey;
          slotIndex: number;
          buttonLabel: string;
        }
      | {
          targetType: "item";
          sectionId: StaffAppScmInfoItemPdfSectionKey;
          itemIndex: number;
          slotIndex: number;
          buttonLabel: string;
        },
    file: File,
  ) {
    if (uploadDisabled) {
      setFeedbackMessage(uploadStatus.message);
      return;
    }

    const uploadKey =
      target.targetType === "section"
        ? buildSectionUploadKey(target.sectionId, target.slotIndex)
        : buildItemUploadKey(target.sectionId, target.itemIndex, target.slotIndex);

    setUploadingKey(uploadKey);
    setFeedbackMessage(null);

    const formData = new FormData();
    formData.set("targetType", target.targetType);
    formData.set("sectionId", target.sectionId);
    formData.set("slotIndex", String(target.slotIndex));
    formData.set("buttonLabel", target.buttonLabel);
    formData.set("file", file);

    if (target.targetType === "item") {
      formData.set("itemIndex", String(target.itemIndex));
    }

    const response = await fetch("/api/system-settings/scm-info-pdfs", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; pdfs?: SystemScmInfoPdfSettings }
      | null;

    if (!response.ok || !payload?.pdfs) {
      setFeedbackMessage(payload?.error ?? "Could not upload the guide PDF.");
      setUploadingKey(null);
      return;
    }

    setPdfSettings(payload.pdfs);
    setFeedbackMessage("Guide PDF updated.");
    setUploadingKey(null);

    const input = fileInputRefs.current[uploadKey];

    if (input) {
      input.value = "";
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function deletePdf(
    target:
      | {
          targetType: "section";
          sectionId: StaffAppScmInfoSectionKey;
          slotIndex: number;
        }
      | {
          targetType: "item";
          sectionId: StaffAppScmInfoItemPdfSectionKey;
          itemIndex: number;
          slotIndex: number;
        },
  ) {
    const actionKey =
      target.targetType === "section"
        ? buildSectionUploadKey(target.sectionId, target.slotIndex)
        : buildItemUploadKey(target.sectionId, target.itemIndex, target.slotIndex);

    setDeletingKey(actionKey);
    setFeedbackMessage(null);

    const response = await fetch("/api/system-settings/scm-info-pdfs", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(target),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; pdfs?: SystemScmInfoPdfSettings }
      | null;

    if (!response.ok || !payload?.pdfs) {
      setFeedbackMessage(payload?.error ?? "Could not delete the guide PDF.");
      setDeletingKey(null);
      return;
    }

    setPdfSettings(payload.pdfs);
    setFeedbackMessage("Guide PDF removed.");
    setDeletingKey(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function saveSettings() {
    setFeedbackMessage(null);

    const [settingsResponse, pdfResponse] = await Promise.all([
      fetch("/api/system-settings/scm-info", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings,
        }),
      }),
      fetch("/api/system-settings/scm-info-pdfs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfs: pdfSettings,
        }),
      }),
    ]);

    const [settingsPayload, pdfPayload] = await Promise.all([
      settingsResponse.json().catch(() => null),
      pdfResponse.json().catch(() => null),
    ]);

    if (!settingsResponse.ok || !settingsPayload?.settings) {
      setFeedbackMessage(settingsPayload?.error ?? "Could not save SCM info settings.");
      return;
    }

    if (!pdfResponse.ok || !pdfPayload?.pdfs) {
      setFeedbackMessage(pdfPayload?.error ?? "Could not save SCM guide PDFs.");
      return;
    }

    setSettings(settingsPayload.settings);
    setPdfSettings(pdfPayload.pdfs);
    setFeedbackMessage("SCM info settings saved.");

    startTransition(() => {
      router.refresh();
    });
  }

  function renderPdfContent() {
    if (activeSection === "policy") {
      return (
        <div className="system-settings-scm-info-card system-settings-scm-info-note-card">
          <span>Policy PDF is managed in the uploader above.</span>
          <a
            href="/api/staff-app/policy-pdf"
            className="button ghost system-settings-scm-info-mini-button"
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </a>
        </div>
      );
    }

    return (
      <div className="system-settings-scm-info-stack">
        {uploadDisabled ? (
          <div className="note-block tone-warn">
            <p>{uploadStatus.message}</p>
          </div>
        ) : null}

        <SystemSettingsScmInfoPdfRows
          title={`${activeSectionMeta.label} Page PDFs`}
          slots={activeSectionPagePdfs}
          uploadingKey={uploadingKey}
          deletingKey={deletingKey}
          isPending={isPending}
          onRegisterInput={registerInput}
          onTriggerUpload={triggerUpload}
          onLabelChange={(slotIndex, value) =>
            updateSectionPdfLabel(activeSection, slotIndex, value)
          }
          onUpload={(slotIndex, file) =>
            void uploadPdf({
              targetType: "section",
              sectionId: activeSection,
              slotIndex,
              buttonLabel: getPdfSlots(pdfSettings.sectionPdfs[activeSection])[slotIndex]
                .buttonLabel,
            }, file)
          }
          onDelete={(slotIndex) =>
            void deletePdf({
              targetType: "section",
              sectionId: activeSection,
              slotIndex,
            })
          }
          buildUploadKey={(slotIndex) => buildSectionUploadKey(activeSection, slotIndex)}
          uploadEnabled={!uploadDisabled}
        />

        {isEditableGuideSection(activeSection)
          ? settings[activeSection].items.map((item, index) => {
              const itemKey = getSystemScmInfoItemPdfKey(activeSection, index);

              return (
                <SystemSettingsScmInfoPdfRows
                  key={`${activeSection}-pdf-entry-${index}`}
                  title={`${item.title || `Entry ${index + 1}`} PDFs`}
                  slots={getPdfSlots(pdfSettings.itemPdfs[itemKey])}
                  uploadingKey={uploadingKey}
                  deletingKey={deletingKey}
                  isPending={isPending}
                  onRegisterInput={registerInput}
                  onTriggerUpload={triggerUpload}
                  onLabelChange={(slotIndex, value) =>
                    updateItemPdfLabel(activeSection, index, slotIndex, value)
                  }
                  onUpload={(slotIndex, file) =>
                    void uploadPdf({
                      targetType: "item",
                      sectionId: activeSection,
                      itemIndex: index,
                      slotIndex,
                      buttonLabel: getPdfSlots(pdfSettings.itemPdfs[itemKey])[slotIndex]
                        .buttonLabel,
                    }, file)
                  }
                  onDelete={(slotIndex) =>
                    void deletePdf({
                      targetType: "item",
                      sectionId: activeSection,
                      itemIndex: index,
                      slotIndex,
                    })
                  }
                  buildUploadKey={(slotIndex) =>
                    buildItemUploadKey(activeSection, index, slotIndex)
                  }
                  uploadEnabled={!uploadDisabled}
                />
              );
            })
          : null}
      </div>
    );
  }

  function renderPageContent() {
    if (isEditableGuideSection(activeSection)) {
      return (
        <div className="system-settings-scm-info-stack">
          <div className="system-settings-scm-info-card">
            <div className="system-settings-scm-info-two-column">
              <label className="field-label">
                Page title
                <input
                  className="input"
                  value={settings[activeSection].pageTitle}
                  onChange={(event) =>
                    updateGuideSectionField(
                      activeSection,
                      "pageTitle",
                      event.currentTarget.value,
                    )
                  }
                />
              </label>

              <SystemSettingsScmInfoTextPreviewField
                label="Page description"
                value={settings[activeSection].pageDescription}
                placeholder="Add page description"
                rows={4}
                isEditing={editingField === `${activeSection}:pageDescription`}
                onToggle={() => toggleEditingField(`${activeSection}:pageDescription`)}
                onChange={(value) =>
                  updateGuideSectionField(activeSection, "pageDescription", value)
                }
              />
            </div>
          </div>

          <div className="system-settings-scm-info-entry-list">
            {settings[activeSection].items.map((item, index) => (
              <article
                key={`${activeSection}-entry-${index}`}
                className="system-settings-scm-info-card system-settings-scm-info-entry-card"
              >
                <div className="system-settings-scm-info-card-head">
                  <strong>{`Entry ${index + 1}`}</strong>
                </div>

                <div className="system-settings-scm-info-two-column">
                  <label className="field-label">
                    Title
                    <input
                      className="input"
                      value={item.title}
                      onChange={(event) =>
                        updateGuideItemField(
                          activeSection,
                          index,
                          "title",
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>

                  <SystemSettingsScmInfoTextPreviewField
                    label="Subtitle"
                    value={item.subtitle}
                    placeholder="Add subtitle"
                    rows={4}
                    isEditing={editingField === `${activeSection}:${index}:subtitle`}
                    onToggle={() => toggleEditingField(`${activeSection}:${index}:subtitle`)}
                    onChange={(value) =>
                      updateGuideItemField(activeSection, index, "subtitle", value)
                    }
                  />

                  <SystemSettingsScmInfoTextPreviewField
                    label="Body"
                    value={item.body}
                    placeholder="Add body copy"
                    rows={6}
                    className="system-settings-scm-info-span-two"
                    isEditing={editingField === `${activeSection}:${index}:body`}
                    onToggle={() => toggleEditingField(`${activeSection}:${index}:body`)}
                    onChange={(value) =>
                      updateGuideItemField(activeSection, index, "body", value)
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      );
    }

    if (activeSection === "arenaInfo") {
      return (
        <div className="system-settings-scm-info-stack">
          <div className="system-settings-scm-info-card">
            <div className="system-settings-scm-info-two-column">
              <label className="field-label">
                Page title
                <input
                  className="input"
                  value={settings.arenaInfo.pageTitle}
                  onChange={(event) => updateArenaField("pageTitle", event.currentTarget.value)}
                />
              </label>

              <SystemSettingsScmInfoTextPreviewField
                label="Page description"
                value={settings.arenaInfo.pageDescription}
                placeholder="Add page description"
                rows={4}
                isEditing={editingField === "arenaInfo:pageDescription"}
                onToggle={() => toggleEditingField("arenaInfo:pageDescription")}
                onChange={(value) => updateArenaField("pageDescription", value)}
              />

              <SystemSettingsScmInfoTextPreviewField
                label="Arena note template"
                value={settings.arenaInfo.fallbackArenaNoteTemplate}
                placeholder="Add fallback template"
                rows={5}
                className="system-settings-scm-info-span-two"
                isEditing={editingField === "arenaInfo:fallbackArenaNoteTemplate"}
                onToggle={() => toggleEditingField("arenaInfo:fallbackArenaNoteTemplate")}
                onChange={(value) => updateArenaField("fallbackArenaNoteTemplate", value)}
              />

              <SystemSettingsScmInfoTextPreviewField
                label="Empty state"
                value={settings.arenaInfo.emptyStateMessage}
                placeholder="Add empty state message"
                rows={4}
                className="system-settings-scm-info-span-two"
                isEditing={editingField === "arenaInfo:emptyStateMessage"}
                onToggle={() => toggleEditingField("arenaInfo:emptyStateMessage")}
                onChange={(value) => updateArenaField("emptyStateMessage", value)}
              />
            </div>
          </div>

          <div className="system-settings-scm-info-card">
            <div className="system-settings-scm-info-card-head">
              <strong>Arena catalog</strong>
              <button
                type="button"
                className="button ghost system-settings-scm-info-mini-button"
                onClick={addArenaCatalogEntry}
              >
                Add arena
              </button>
            </div>
            <p className="muted small-text">
              This list powers arena autocomplete and auto-fills city and country in gig forms.
            </p>
          </div>

          <div className="system-settings-scm-info-entry-list">
            {settings.arenaInfo.catalog.map((arena, index) => (
              <article
                key={arena.id}
                className="system-settings-scm-info-card system-settings-scm-info-entry-card"
              >
                <div className="system-settings-scm-info-card-head">
                  <strong>{arena.name || `Arena ${index + 1}`}</strong>
                  <button
                    type="button"
                    className="button ghost system-settings-scm-info-mini-button"
                    onClick={() => removeArenaCatalogEntry(arena.id)}
                  >
                    Remove
                  </button>
                </div>

                <div className="system-settings-scm-info-two-column">
                  <label className="field-label">
                    Arena
                    <input
                      className="input"
                      value={arena.name}
                      onChange={(event) =>
                        updateArenaCatalogEntry(arena.id, "name", event.currentTarget.value)
                      }
                    />
                  </label>

                  <label className="field-label">
                    City
                    <input
                      className="input"
                      value={arena.city}
                      onChange={(event) =>
                        updateArenaCatalogEntry(arena.id, "city", event.currentTarget.value)
                      }
                    />
                  </label>

                  <label className="field-label">
                    Country
                    <select
                      className="input"
                      value={arena.country}
                      onChange={(event) =>
                        updateArenaCatalogEntry(
                          arena.id,
                          "country",
                          event.currentTarget.value as ArenaCatalogEntry["country"],
                        )
                      }
                    >
                      {scandinavianCountryOptions.map((countryOption) => (
                        <option key={countryOption} value={countryOption}>
                          {countryOption}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label system-settings-scm-info-span-two">
                    Aliases
                    <input
                      className="input"
                      value={formatArenaAliases(arena.aliases)}
                      placeholder="Optional alternate names, separated by commas"
                      onChange={(event) =>
                        updateArenaCatalogAliases(arena.id, event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="system-settings-scm-info-card system-settings-scm-info-empty-card">
        <span>No extra page content for this section.</span>
      </div>
    );
  }

  const pdfSummary =
    activeSection === "policy"
      ? "Managed above"
      : `${countUploadedPdfs(activeSectionPagePdfs)} uploaded`;
  const contentSummary =
    isEditableGuideSection(activeSection)
      ? `${settings[activeSection].items.length} entries`
      : activeSection === "arenaInfo"
        ? `${settings.arenaInfo.catalog.length} arenas`
        : "No extra content";

  return (
    <section className="card system-settings-scm-info-shell compact">
      <div className="system-settings-scm-info-header-row">
        <div className="system-settings-copy">
          <h2>SCM Staff App Guides</h2>
        </div>
        {feedbackMessage ? <p className="system-settings-feedback">{feedbackMessage}</p> : null}
      </div>

      <div className="system-settings-scm-info-card system-settings-scm-info-hub-card">
        <div className="system-settings-scm-info-card-head">
          <strong>Guide Hub</strong>
        </div>
        <div className="system-settings-scm-info-two-column">
          <label className="field-label">
            Hub kicker
            <input
              className="input"
              value={settings.hubKicker}
              onChange={(event) => updateHubField("hubKicker", event.currentTarget.value)}
            />
          </label>

          <label className="field-label">
            Hub title
            <input
              className="input"
              value={settings.hubTitle}
              onChange={(event) => updateHubField("hubTitle", event.currentTarget.value)}
            />
          </label>
        </div>
      </div>

      <div className="system-settings-scm-info-grid compact">
        {editorSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`system-settings-scm-info-tile${
              activeSection === section.id ? " active" : ""
            }`}
            onClick={() => selectSection(section.id)}
          >
            <small>{section.label}</small>
            <strong>{settings.hubCards[section.id].title}</strong>
            <span>{settings.hubCards[section.id].subtitle}</span>
          </button>
        ))}
      </div>

      <div className="system-settings-scm-info-focus-card">
        <div className="system-settings-scm-info-focus-head">
          <div className="system-settings-copy">
            <h3>{activeSectionMeta.label}</h3>
          </div>
        </div>

        <div className="system-settings-scm-info-accordion">
          <SystemSettingsScmInfoAccordion
            title={activeSectionMeta.label}
            summary={settings.hubCards[activeSection].title}
            open={openPanel === "summary"}
            onToggle={() => togglePanel("summary")}
          >
            <div className="system-settings-scm-info-card">
              <div className="system-settings-scm-info-two-column">
                <label className="field-label">
                  App card title
                  <input
                    className="input"
                    value={settings.hubCards[activeSection].title}
                    onChange={(event) =>
                      updateHubCardField(activeSection, "title", event.currentTarget.value)
                    }
                  />
                </label>

                <SystemSettingsScmInfoTextPreviewField
                  label="App card subtitle"
                  value={settings.hubCards[activeSection].subtitle}
                  placeholder="Add card subtitle"
                  rows={4}
                  isEditing={editingField === `${activeSection}:subtitle`}
                  onToggle={() => toggleEditingField(`${activeSection}:subtitle`)}
                  onChange={(value) => updateHubCardField(activeSection, "subtitle", value)}
                />
              </div>
            </div>
          </SystemSettingsScmInfoAccordion>

          <SystemSettingsScmInfoAccordion
            title="PDFs"
            summary={pdfSummary}
            open={openPanel === "pdfs"}
            onToggle={() => togglePanel("pdfs")}
          >
            {renderPdfContent()}
          </SystemSettingsScmInfoAccordion>

          <SystemSettingsScmInfoAccordion
            title="Page Content"
            summary={contentSummary}
            open={openPanel === "content"}
            onToggle={() => togglePanel("content")}
          >
            {renderPageContent()}
          </SystemSettingsScmInfoAccordion>
        </div>
      </div>

      <div className="system-settings-actions">
        <span />
        <button
          type="button"
          className="button"
          onClick={() => void saveSettings()}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save SCM info settings"}
        </button>
      </div>
    </section>
  );
}
