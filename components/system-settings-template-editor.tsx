"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  buildShiftPdfTemplateLines,
  createShiftPdfPreviewContext,
  shiftPdfPlaceholderDefinitions,
  shiftPdfPlaceholderOrder,
  type ShiftPdfTemplate,
  type ShiftPdfTemplateId,
} from "@/types/system-settings";

type TemplateCollection = Record<ShiftPdfTemplateId, ShiftPdfTemplate>;

const templateIdOrder: ShiftPdfTemplateId[] = ["employmentContract", "timeReport"];

export function SystemSettingsTemplateEditor({
  initialTemplates,
}: {
  initialTemplates: TemplateCollection;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeTemplateId, setActiveTemplateId] =
    useState<ShiftPdfTemplateId>("employmentContract");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeTemplate = templates[activeTemplateId];
  const previewLines = useMemo(() => {
    return buildShiftPdfTemplateLines(
      activeTemplate,
      createShiftPdfPreviewContext(activeTemplateId),
    );
  }, [activeTemplate, activeTemplateId]);

  function updateTemplate(nextValues: Partial<ShiftPdfTemplate>) {
    setTemplates((currentTemplates) => ({
      ...currentTemplates,
      [activeTemplateId]: {
        ...currentTemplates[activeTemplateId],
        ...nextValues,
      },
    }));
  }

  function togglePlaceholder(placeholderKey: (typeof shiftPdfPlaceholderOrder)[number]) {
    const currentPlaceholders = activeTemplate.enabledPlaceholders;
    const isEnabled = currentPlaceholders.includes(placeholderKey);

    updateTemplate({
      enabledPlaceholders: isEnabled
        ? currentPlaceholders.filter((currentKey) => currentKey !== placeholderKey)
        : [...currentPlaceholders, placeholderKey],
    });
  }

  async function saveTemplate() {
    setFeedbackMessage(null);

    const response = await fetch("/api/system-settings/templates", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: activeTemplateId,
        template: activeTemplate,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; template?: ShiftPdfTemplate }
      | null;

    if (!response.ok || !payload?.template) {
      setFeedbackMessage(payload?.error ?? "Could not save template changes.");
      return;
    }

    setTemplates((currentTemplates) => ({
      ...currentTemplates,
      [activeTemplateId]: payload.template!,
    }));
    setFeedbackMessage("Template saved.");

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="system-settings-layout">
      <section className="card system-settings-editor">
        <div className="system-settings-tab-row">
          {templateIdOrder.map((templateId) => {
            const template = templates[templateId];

            return (
              <button
                key={template.id}
                type="button"
                className={`chip ${template.id === activeTemplateId ? "active" : ""}`}
                onClick={() => setActiveTemplateId(template.id)}
              >
                {template.label}
              </button>
            );
          })}
        </div>

        <div className="system-settings-copy">
          <h2>{activeTemplate.label}</h2>
          <p>{activeTemplate.description}</p>
        </div>

        <div className="system-settings-form-grid">
          <label className="field-label">
            Template title
            <input
              className="input"
              value={activeTemplate.title}
              onChange={(event) => updateTemplate({ title: event.currentTarget.value })}
            />
          </label>

          <label className="field-label">
            Introduction text
            <textarea
              className="input"
              rows={4}
              value={activeTemplate.intro}
              onChange={(event) => updateTemplate({ intro: event.currentTarget.value })}
            />
          </label>

          <label className="field-label">
            Footer text
            <textarea
              className="input"
              rows={4}
              value={activeTemplate.footer}
              onChange={(event) => updateTemplate({ footer: event.currentTarget.value })}
            />
          </label>
        </div>

        <div className="system-settings-placeholder-panel">
          <div className="system-settings-copy">
            <h3>Dynamic placeholder fields</h3>
            <p>Choose which generated values should appear in this PDF template.</p>
          </div>

          <div className="system-settings-placeholder-grid">
            {shiftPdfPlaceholderOrder.map((placeholderKey) => {
              const definition = shiftPdfPlaceholderDefinitions[placeholderKey];
              const isEnabled = activeTemplate.enabledPlaceholders.includes(placeholderKey);

              return (
                <label key={placeholderKey} className="system-settings-placeholder-item">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => togglePlaceholder(placeholderKey)}
                  />
                  <span>
                    <strong>{definition.label}</strong>
                    <small>{definition.valuePrefix}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="system-settings-actions">
          {feedbackMessage ? (
            <p className="system-settings-feedback">{feedbackMessage}</p>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="button"
            onClick={() => void saveTemplate()}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save template"}
          </button>
        </div>
      </section>

      <aside className="card system-settings-preview">
        <div className="system-settings-copy">
          <h2>Preview generated result</h2>
          <p>This preview uses a sample shift context and updates as you edit the template.</p>
        </div>

        <div className="system-settings-preview-document">
          {previewLines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className={index === 0 ? "system-settings-preview-title" : undefined}
            >
              {line}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}
