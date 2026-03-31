"use client";

import { GigDocumentBoxes } from "@/components/gig-document-boxes";
import type { GigFileFolder, GigFileItem } from "@/types/scm";

export function GigFilesManager({
  gigId,
  initialFiles,
  initialFolders,
}: {
  gigId: string;
  initialFiles: GigFileItem[];
  initialFolders: GigFileFolder[];
}) {
  return (
    <GigDocumentBoxes
      gigId={gigId}
      section="files"
      title="Files & info"
      description="Keep e-mails, price ranges, and supporting gig information grouped in simple file boxes."
      createEyebrow="Custom file boxes"
      createTitle="Add another file or info box"
      createDescription="Create extra boxes for documents that do not belong in the two default file boxes."
      addButtonLabel="Add custom box"
      initialFiles={initialFiles}
      initialFolders={initialFolders}
    />
  );
}
