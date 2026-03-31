"use client";

import {
  type DragEvent,
  type FormEvent,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  GigTimeReportPanel,
  type TimeReportStaffProfile,
} from "@/components/gig-time-report-panel";
import {
  getCanonicalGigDocumentBoxTitle,
  getDefaultGigDocumentBoxes,
  getGigDocumentBoxMatchNames,
  isEndOfDayReportReceiptsGigDocumentBox,
  isEventManagerGigDocumentBox,
  isDefaultGigDocumentBoxTitle,
  normalizeGigDocumentBoxName,
} from "@/lib/gig-document-boxes";
import {
  isGigFilePreviewablePdf,
  isGigFileStoredAsAttachment,
} from "@/lib/gig-file-storage";
import type {
  GigDocumentSection,
  GigFileFolder,
  GigFileItem,
  Shift,
} from "@/types/scm";

const standardUploadAcceptValue =
  ".pdf,.msg,.xlsx,.docx,application/pdf,application/vnd.ms-outlook,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const endOfDayUploadAcceptValue = `${standardUploadAcceptValue},image/*,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif`;

type DocumentBoxViewModel = {
  id: string;
  folderId?: string;
  title: string;
  matchNames: string[];
  files: GigFileItem[];
  isDefault: boolean;
};

type CustomDocumentBoxSeed = {
  id: string;
  folderId?: string;
  title: string;
  sortOrder: number;
  matchNames: string[];
};

type GigDocumentBoxesProps = {
  gigId: string;
  gigArtist?: string;
  section: GigDocumentSection;
  title: string;
  description: string;
  createEyebrow: string;
  createTitle: string;
  createDescription: string;
  addButtonLabel: string;
  initialFiles: GigFileItem[];
  initialFolders: GigFileFolder[];
  timeReportGigDate?: string;
  timeReportFinalApprovedAt?: string;
  timeReportShifts?: Shift[];
  timeReportStaffProfiles?: TimeReportStaffProfile[];
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function formatUploadedAt(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Saved recently";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function formatFileCount(count: number) {
  if (count === 1) {
    return "1 file uploaded";
  }

  return `${count} files uploaded`;
}

function getFileExtensionLabel(file: GigFileItem) {
  if (file.extension) {
    return file.extension.toUpperCase();
  }

  const derivedExtension = file.fileName.split(".").pop();
  return derivedExtension ? derivedExtension.toUpperCase() : "FILE";
}

function getFileAccessLabel(file: GigFileItem) {
  if (isGigFilePreviewablePdf(file)) {
    return "Preview PDF";
  }

  if (isGigFileStoredAsAttachment(file)) {
    return "Download attachment";
  }

  return "Open file";
}

function mergeMatchNames(currentNames: string[], nextNames: string[]) {
  return Array.from(new Set([...currentNames, ...nextNames].filter(Boolean)));
}

function getDocumentBoxFiles(files: GigFileItem[], matchNames: string[]) {
  const normalizedNames = new Set(matchNames.map((name) => normalizeGigDocumentBoxName(name)));

  return files.filter((file) => {
    const folderName = file.folderName?.trim();

    if (!folderName) {
      return false;
    }

    return normalizedNames.has(normalizeGigDocumentBoxName(folderName));
  });
}

function buildCustomDocumentBoxes(
  section: GigDocumentSection,
  files: GigFileItem[],
  folders: GigFileFolder[],
  gigArtist?: string,
) {
  const customBoxes = new Map<string, CustomDocumentBoxSeed>();

  folders.forEach((folder, index) => {
    const canonicalTitle = getCanonicalGigDocumentBoxTitle(section, folder.name, { gigArtist });
    const normalizedTitle = normalizeGigDocumentBoxName(canonicalTitle);

    if (!normalizedTitle || isDefaultGigDocumentBoxTitle(section, canonicalTitle, { gigArtist })) {
      return;
    }

    customBoxes.set(normalizedTitle, {
      id: folder.id,
      folderId: folder.id,
      title: canonicalTitle,
      sortOrder: index,
      matchNames: mergeMatchNames(
        getGigDocumentBoxMatchNames(section, canonicalTitle, { gigArtist }),
        [folder.name],
      ),
    });
  });

  files.forEach((file, index) => {
    const folderName = file.folderName?.trim();

    if (!folderName) {
      return;
    }

    const canonicalTitle = getCanonicalGigDocumentBoxTitle(section, folderName, { gigArtist });
    const normalizedTitle = normalizeGigDocumentBoxName(canonicalTitle);

    if (!normalizedTitle || isDefaultGigDocumentBoxTitle(section, canonicalTitle, { gigArtist })) {
      return;
    }

    const existingBox = customBoxes.get(normalizedTitle);
    const matchNames = mergeMatchNames(
      getGigDocumentBoxMatchNames(section, canonicalTitle, { gigArtist }),
      [folderName],
    );

    if (existingBox) {
      customBoxes.set(normalizedTitle, {
        ...existingBox,
        matchNames: mergeMatchNames(existingBox.matchNames, matchNames),
      });
      return;
    }

    customBoxes.set(normalizedTitle, {
      id: `document-box-${section}-${normalizedTitle}`,
      folderId: undefined,
      title: canonicalTitle,
      sortOrder: folders.length + index,
      matchNames,
    });
  });

  return Array.from(customBoxes.values())
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
    .map(
      (box): DocumentBoxViewModel => ({
        id: box.id,
        folderId: box.folderId,
        title: box.title,
        matchNames: box.matchNames,
        files: getDocumentBoxFiles(files, box.matchNames),
        isDefault: false,
      }),
    );
}

function buildDocumentBoxes(
  section: GigDocumentSection,
  files: GigFileItem[],
  folders: GigFileFolder[],
  gigArtist?: string,
) {
  const defaultBoxes = getDefaultGigDocumentBoxes(section, { gigArtist }).map(
    (box): DocumentBoxViewModel => ({
      id: `default-${section}-${normalizeGigDocumentBoxName(box.title)}`,
      title: box.title,
      matchNames: getGigDocumentBoxMatchNames(section, box.title, { gigArtist }),
      files: getDocumentBoxFiles(files, getGigDocumentBoxMatchNames(section, box.title, { gigArtist })),
      isDefault: true,
    }),
  );

  return [...defaultBoxes, ...buildCustomDocumentBoxes(section, files, folders, gigArtist)];
}

function getDocumentBoxEmptyMessage(
  boxTitle: string,
) {
  return `Upload the ${boxTitle} file`;
}

function getDocumentBoxAcceptValue(section: GigDocumentSection, boxTitle: string) {
  if (isEventManagerGigDocumentBox(section, boxTitle)) {
    return undefined;
  }

  if (isEndOfDayReportReceiptsGigDocumentBox(section, boxTitle)) {
    return endOfDayUploadAcceptValue;
  }

  return standardUploadAcceptValue;
}

function hasDraggedFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes("Files");
}

export function GigDocumentBoxes({
  gigId,
  gigArtist,
  section,
  title,
  description,
  createEyebrow,
  createTitle,
  createDescription,
  addButtonLabel,
  initialFiles,
  initialFolders,
  timeReportGigDate,
  timeReportFinalApprovedAt,
  timeReportShifts,
  timeReportStaffProfiles,
}: GigDocumentBoxesProps) {
  const router = useRouter();
  const [files, setFiles] = useState<GigFileItem[]>(initialFiles);
  const [folders, setFolders] = useState<GigFileFolder[]>(initialFolders);
  const [customTitle, setCustomTitle] = useState("");
  const [uploadingBoxId, setUploadingBoxId] = useState<string | null>(null);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [dragOverBoxId, setDragOverBoxId] = useState<string | null>(null);
  const [, setDragDepthByBoxId] = useState<Record<string, number>>({});
  const [isCreatingBox, setIsCreatingBox] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sectionFiles = files.filter((file) => file.section === section);
  const sectionFolders = folders.filter((folder) => folder.section === section);
  const documentBoxes = buildDocumentBoxes(section, sectionFiles, sectionFolders, gigArtist);
  const showTimeReport =
    Boolean(timeReportGigDate) &&
    section === "reports" &&
    Array.isArray(timeReportShifts) &&
    Array.isArray(timeReportStaffProfiles);

  async function createCustomBox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const canonicalTitle = getCanonicalGigDocumentBoxTitle(section, customTitle, { gigArtist });
    const normalizedTitle = normalizeGigDocumentBoxName(canonicalTitle);

    if (!normalizedTitle) {
      setFeedbackMessage("Enter a custom box title first.");
      return;
    }

    const titleAlreadyExists = documentBoxes.some(
      (box) => normalizeGigDocumentBoxName(box.title) === normalizedTitle,
    );

    if (titleAlreadyExists) {
      setFeedbackMessage("A box with that title already exists.");
      return;
    }

    setIsCreatingBox(true);
    setFeedbackMessage(null);

    const response = await fetch(`/api/gigs/${gigId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: canonicalTitle, section }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; folders?: GigFileFolder[]; alreadyExists?: boolean }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not create the box.");
      setIsCreatingBox(false);
      return;
    }

    setFolders(payload?.folders ?? []);
    setCustomTitle("");
    setFeedbackMessage(
      payload?.alreadyExists ? `${canonicalTitle} already exists.` : `${canonicalTitle} created.`,
    );
    setIsCreatingBox(false);

    startTransition(() => {
      router.refresh();
    });
  }

  async function uploadBoxFiles(box: DocumentBoxViewModel, selectedFiles: File[]) {
    if (selectedFiles.length === 0) {
      return;
    }

    setUploadingBoxId(box.id);
    setFeedbackMessage(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("file", file);
    });
    formData.set("folderName", box.title);
    formData.set("section", section);

    const response = await fetch(`/api/gigs/${gigId}/files`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; files?: GigFileItem[]; uploadedFiles?: GigFileItem[] }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not upload the files.");
      setUploadingBoxId(null);
      return;
    }

    setFiles(payload?.files ?? []);
    const uploadedCount = payload?.uploadedFiles?.length ?? selectedFiles.length;
    setFeedbackMessage(
      uploadedCount === 1
        ? `1 file uploaded to ${box.title}.`
        : `${uploadedCount} files uploaded to ${box.title}.`,
    );
    setUploadingBoxId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function deleteCustomBox(box: DocumentBoxViewModel) {
    if (!box.folderId) {
      setFeedbackMessage("This box cannot be deleted.");
      return;
    }

    setDeletingBoxId(box.id);
    setFeedbackMessage(null);

    const response = await fetch(`/api/gigs/${gigId}/folders`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folderId: box.folderId }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; folders?: GigFileFolder[] }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not delete the box.");
      setDeletingBoxId(null);
      return;
    }

    setFolders(payload?.folders ?? []);
    setFeedbackMessage(`${box.title} deleted.`);
    setDeletingBoxId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function deleteBoxFile(file: GigFileItem) {
    setDeletingFileId(file.id);
    setFeedbackMessage(null);

    const response = await fetch(`/api/gigs/${gigId}/files`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileId: file.id }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; files?: GigFileItem[] }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not delete the file.");
      setDeletingFileId(null);
      return;
    }

    setFiles(payload?.files ?? []);
    setFeedbackMessage(`${file.fileName} deleted.`);
    setDeletingFileId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  function handleBoxDragEnter(boxId: string, event: DragEvent<HTMLElement>) {
    if (isPending || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragDepthByBoxId((current) => ({
      ...current,
      [boxId]: (current[boxId] ?? 0) + 1,
    }));
    setDragOverBoxId(boxId);
  }

  function handleBoxDragOver(boxId: string, event: DragEvent<HTMLElement>) {
    if (isPending || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    if (dragOverBoxId !== boxId) {
      setDragOverBoxId(boxId);
    }
  }

  function handleBoxDragLeave(boxId: string, event: DragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragDepthByBoxId((current) => {
      const nextDepth = Math.max((current[boxId] ?? 1) - 1, 0);
      const nextState = { ...current, [boxId]: nextDepth };

      if (nextDepth === 0) {
        delete nextState[boxId];
        setDragOverBoxId((activeBoxId) => (activeBoxId === boxId ? null : activeBoxId));
      }

      return nextState;
    });
  }

  function clearBoxDragState(boxId: string) {
    setDragOverBoxId((activeBoxId) => (activeBoxId === boxId ? null : activeBoxId));
    setDragDepthByBoxId((current) => {
      if (!(boxId in current)) {
        return current;
      }

      const nextState = { ...current };
      delete nextState[boxId];
      return nextState;
    });
  }

  function handleBoxDrop(box: DocumentBoxViewModel, event: DragEvent<HTMLElement>) {
    if (isPending || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    clearBoxDragState(box.id);

    if (droppedFiles.length === 0) {
      return;
    }

    void uploadBoxFiles(box, droppedFiles);
  }

  return (
    <section className="card report-documents-shell">
      <div className="report-documents-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>

      {showTimeReport ? (
        <div className="report-documents-intro">
          <div className="route-tabs report-documents-tab-row">
            <a href="#time-report" className="route-tab active">
              TIME RAPORT
            </a>
          </div>

          <GigTimeReportPanel
            gigId={gigId}
            gigDate={timeReportGigDate as string}
            timeReportFinalApprovedAt={timeReportFinalApprovedAt}
            shifts={timeReportShifts}
            staffProfiles={timeReportStaffProfiles}
          />
        </div>
      ) : null}

      <div className="report-documents-toolbar">
        <div className="report-documents-toolbar-copy">
          <p className="eyebrow">{createEyebrow}</p>
          <h3>{createTitle}</h3>
          <p className="muted">{createDescription}</p>
        </div>

        <form className="report-documents-create" onSubmit={(event) => void createCustomBox(event)}>
          <label className="report-documents-create-field">
            <span className="small-text">Box title</span>
            <input
              type="text"
              value={customTitle}
              maxLength={80}
              placeholder="Enter custom box title"
              onChange={(event) => {
                setCustomTitle(event.currentTarget.value);
                setFeedbackMessage(null);
              }}
            />
          </label>

          <button type="submit" className="button" disabled={isCreatingBox || isPending}>
            {isCreatingBox || isPending ? "Creating..." : addButtonLabel}
          </button>
        </form>
      </div>

      {feedbackMessage ? (
        <p className="small-text report-documents-feedback">{feedbackMessage}</p>
      ) : null}

      <div className="report-documents-grid">
        {documentBoxes.map((box) => {
          const inputId = `document-box-${section}-${gigId}-${box.id}`;
          const canDeleteEmptyCustomBox =
            !box.isDefault && box.files.length === 0 && Boolean(box.folderId);
          const boxEmptyMessage = getDocumentBoxEmptyMessage(box.title);
          const inputAcceptValue = getDocumentBoxAcceptValue(section, box.title);
          const isDragActive = dragOverBoxId === box.id;

          return (
            <article
              key={box.id}
              className={`report-document-card ${box.isDefault ? "report-document-card-default" : "report-document-card-custom"} ${isDragActive ? "drag-active" : ""}`}
              onDragEnter={(event) => {
                handleBoxDragEnter(box.id, event);
              }}
              onDragOver={(event) => {
                handleBoxDragOver(box.id, event);
              }}
              onDragLeave={(event) => {
                handleBoxDragLeave(box.id, event);
              }}
              onDrop={(event) => {
                handleBoxDrop(box, event);
              }}
            >
              <div className="report-document-head">
                <div className="report-document-copy">
                  <h3>{box.title}</h3>
                  <span className="small-text report-document-meta">
                    {box.files.length > 0 ? formatFileCount(box.files.length) : "No files uploaded yet."}
                  </span>
                </div>
              </div>

              <div className="report-document-file-list">
                {box.files.length === 0 ? (
                  <div className="report-document-empty">{boxEmptyMessage}</div>
                ) : (
                  box.files.map((file) => {
                    const previewablePdf = isGigFilePreviewablePdf(file);
                    const shouldDownload = isGigFileStoredAsAttachment(file) && !previewablePdf;
                    const isDeletingThisFile = deletingFileId === file.id;

                    return (
                      <div key={file.id} className="report-document-file-entry">
                        <a
                          href={file.url}
                          target={previewablePdf ? "_blank" : undefined}
                          rel={previewablePdf ? "noreferrer" : undefined}
                          download={shouldDownload ? file.fileName : undefined}
                          className="report-document-file"
                        >
                          <strong className="report-document-file-name">{file.fileName}</strong>
                          <span className="small-text report-document-file-meta">
                            {getFileExtensionLabel(file)} | {formatFileSize(file.fileSize)} |{" "}
                            {getFileAccessLabel(file)} | Saved {formatUploadedAt(file.uploadedAt)}
                          </span>
                        </a>

                        <div className="report-document-file-actions">
                          <button
                            type="button"
                            className="button ghost danger-outline report-document-file-delete"
                            disabled={isDeletingThisFile || isPending}
                            onClick={() => {
                              void deleteBoxFile(file);
                            }}
                          >
                            {isDeletingThisFile ? "Removing..." : "Remove file"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="report-document-actions">
                <label className="button ghost report-document-upload" htmlFor={inputId}>
                  {uploadingBoxId === box.id ? "Uploading..." : "Upload file"}
                </label>
                <span className="small-text report-document-drop-hint">
                  {isDragActive ? "Release files to upload them here" : "Drag and drop files here"}
                </span>
                <input
                  id={inputId}
                  className="report-document-input"
                  type="file"
                  multiple
                  accept={inputAcceptValue}
                  onChange={(event) => {
                    const selectedFiles = Array.from(event.currentTarget.files ?? []);

                    if (selectedFiles.length === 0) {
                      return;
                    }

                    void uploadBoxFiles(box, selectedFiles);
                    event.currentTarget.value = "";
                  }}
                />

                {canDeleteEmptyCustomBox ? (
                  <button
                    type="button"
                    className="button ghost danger-outline report-document-delete"
                    disabled={deletingBoxId === box.id || isPending}
                    onClick={() => {
                      void deleteCustomBox(box);
                    }}
                  >
                    {deletingBoxId === box.id ? "Deleting..." : "Delete box"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
