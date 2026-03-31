"use client";

import { useState } from "react";

import type { StaffApplicationApprovalEmailTemplate } from "@/types/job-applications";

export function SystemSettingsApplicationEmailEditor({
  initialTemplate,
  postmarkStatus,
}: {
  initialTemplate: StaffApplicationApprovalEmailTemplate;
  postmarkStatus: {
    configured: boolean;
    hasServerToken: boolean;
    hasFromEmail: boolean;
    replyToEmail: string;
    messageStream: string;
  };
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField<Key extends keyof StaffApplicationApprovalEmailTemplate>(
    key: Key,
    value: StaffApplicationApprovalEmailTemplate[Key],
  ) {
    setTemplate((currentTemplate) => ({
      ...currentTemplate,
      [key]: value,
    }));
  }

  async function saveTemplate() {
    setIsSaving(true);
    setFeedbackMessage("");

    const response = await fetch("/api/system-settings/application-email-template", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          template?: StaffApplicationApprovalEmailTemplate;
        }
      | null;

    if (!response.ok || !payload?.template) {
      setFeedbackMessage(payload?.error ?? "Could not save the email template.");
      setIsSaving(false);
      return;
    }

    setTemplate(payload.template);
    setFeedbackMessage("Application email template saved.");
    setIsSaving(false);
  }

  return (
    <section className="card system-settings-email-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">EMAIL TEMPLATE</p>
          <h2>Approved application email</h2>
          <p className="page-subtitle">
            Edit the parts that should stay manual while the system injects
            applicant name, password link, expiry time, and support email automatically.
          </p>
        </div>
      </div>

      <div className="system-settings-email-status-grid">
        <div className="key-value-card">
          <small>Postmark token</small>
          <strong>{postmarkStatus.hasServerToken ? "Configured" : "Missing"}</strong>
        </div>
        <div className="key-value-card">
          <small>From email</small>
          <strong>{postmarkStatus.hasFromEmail ? "Configured" : "Missing"}</strong>
        </div>
        <div className="key-value-card">
          <small>Reply-to</small>
          <strong>{postmarkStatus.replyToEmail || "Uses support email below"}</strong>
        </div>
        <div className="key-value-card">
          <small>Message stream</small>
          <strong>{postmarkStatus.messageStream}</strong>
        </div>
      </div>

      <div className="system-settings-email-help">
        <strong>Automatic variables</strong>
        <p>
          Use <code>{"{{name}}"}</code>, <code>{"{{createPasswordUrl}}"}</code>,{" "}
          <code>{"{{expiresAt}}"}</code>, and <code>{"{{supportEmail}}"}</code>.
        </p>
      </div>

      <div className="system-settings-form-grid">
        <label className="field-label">
          Subject
          <input
            className="input"
            value={template.subject}
            onChange={(event) => updateField("subject", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Preheader
          <input
            className="input"
            value={template.preheader}
            onChange={(event) => updateField("preheader", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Headline
          <input
            className="input"
            value={template.headline}
            onChange={(event) => updateField("headline", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Intro
          <textarea
            className="input"
            rows={4}
            value={template.intro}
            onChange={(event) => updateField("intro", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Body
          <textarea
            className="input"
            rows={6}
            value={template.body}
            onChange={(event) => updateField("body", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          CTA label
          <input
            className="input"
            value={template.ctaLabel}
            onChange={(event) => updateField("ctaLabel", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Expiry notice
          <textarea
            className="input"
            rows={3}
            value={template.expiryNotice}
            onChange={(event) => updateField("expiryNotice", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Help text
          <textarea
            className="input"
            rows={3}
            value={template.helpText}
            onChange={(event) => updateField("helpText", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Signature
          <textarea
            className="input"
            rows={3}
            value={template.signature}
            onChange={(event) => updateField("signature", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Footer text
          <textarea
            className="input"
            rows={3}
            value={template.footerText}
            onChange={(event) => updateField("footerText", event.currentTarget.value)}
          />
        </label>

        <label className="field-label">
          Support email
          <input
            className="input"
            type="email"
            value={template.supportEmail}
            onChange={(event) => updateField("supportEmail", event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="system-settings-actions">
        <p className="system-settings-feedback">{feedbackMessage}</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            void saveTemplate();
          }}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save email template"}
        </button>
      </div>
    </section>
  );
}
