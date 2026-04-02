"use client";

import { useRef, useState } from "react";

import type { PublicUploadStorageStatus } from "@/lib/public-file-storage";

type SystemPolicySettingsSummary = {
  policyUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
};

function formatUploadedAt(value: string) {
  if (!value) {
    return "No PDF uploaded yet";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(parsedDate);
}

export function SystemSettingsPolicyUploader({
  initialPolicy,
  uploadStatus,
}: {
  initialPolicy: SystemPolicySettingsSummary;
  uploadStatus: PublicUploadStorageStatus;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [policy, setPolicy] = useState(initialPolicy);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadDisabled = !uploadStatus.available;

  async function uploadPolicy(file: File) {
    if (uploadDisabled) {
      setFeedbackMessage(uploadStatus.message);
      return;
    }

    setIsUploading(true);
    setFeedbackMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/system-settings/policy", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            policy?: SystemPolicySettingsSummary;
          }
        | null;

      if (!response.ok || !payload?.policy) {
        setFeedbackMessage(payload?.error ?? "Could not upload the SCM policy PDF.");
        return;
      }

      setPolicy(payload.policy);
      setFeedbackMessage("SCM policy PDF updated.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setFeedbackMessage("Could not upload the SCM policy PDF.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="card system-settings-editor system-settings-policy-card">
      <div className="system-settings-copy">
        <h2>SCM Staff Policy PDF</h2>
        <p>
          Only Super Admin can upload the policy PDF shown inside the SCM Staff App.
          Replacing the file updates the document that opens from the mobile app policy
          button.
        </p>
      </div>

      <div className="system-settings-policy-summary">
        <div className="key-value-card">
          <small>Current file</small>
          <strong>{policy.fileName || "No PDF uploaded yet"}</strong>
        </div>
        <div className="key-value-card">
          <small>Last uploaded</small>
          <strong>{formatUploadedAt(policy.uploadedAt)}</strong>
        </div>
        <div className="key-value-card">
          <small>Uploaded by</small>
          <strong>{policy.uploadedBy || "Not available"}</strong>
        </div>
      </div>

      {uploadDisabled ? (
        <div className="note-block tone-warn">
          <p>{uploadStatus.message}</p>
        </div>
      ) : null}

      <div className="system-settings-policy-actions">
        <input
          ref={fileInputRef}
          className="gig-image-input"
          type="file"
          accept=".pdf,application/pdf"
          disabled={uploadDisabled}
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0] ?? null;

            if (!nextFile) {
              return;
            }

            void uploadPolicy(nextFile);
          }}
        />

        <div className="page-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              if (uploadDisabled) {
                setFeedbackMessage(uploadStatus.message);
                return;
              }

              fileInputRef.current?.click();
            }}
            disabled={uploadDisabled || isUploading}
          >
            {uploadDisabled
              ? "Uploads unavailable"
              : isUploading
                ? "Uploading..."
                : "Upload PDF"}
          </button>

          <a
            href="/api/staff-app/policy-pdf"
            className="button"
            target="_blank"
            rel="noreferrer"
          >
            Open current policy
          </a>
        </div>
      </div>

      {feedbackMessage ? <p className="system-settings-feedback">{feedbackMessage}</p> : null}
    </section>
  );
}
