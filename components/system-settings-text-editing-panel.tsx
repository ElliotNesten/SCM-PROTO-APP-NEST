"use client";

import { useState } from "react";

import { useTextCustomization } from "@/components/text-customization-provider";

export function SystemSettingsTextEditingPanel() {
  const {
    activateEditMode,
    isEditMode,
    isLoadingEditor,
    pendingCount,
    statusMessage,
  } = useTextCustomization();
  const [showConfirm, setShowConfirm] = useState(false);

  async function confirmActivation() {
    const didActivate = await activateEditMode();

    if (didActivate) {
      setShowConfirm(false);
    }
  }

  return (
    <>
      <section className="card system-settings-text-mode-card">
        <div className="system-settings-copy">
          <p className="eyebrow">GLOBAL TEXT EDIT MODE</p>
          <h2>Enable inline editing for static system text</h2>
          <p>
            Turn on a global editing layer for hardcoded interface copy. Dynamic
            data such as user information, gig data, and dates stays untouched.
          </p>
        </div>

        {statusMessage ? <p className="system-settings-feedback">{statusMessage}</p> : null}

        <div className="system-settings-text-mode-actions">
          <button
            type="button"
            className="button"
            onClick={() => setShowConfirm(true)}
            disabled={isLoadingEditor || isEditMode}
          >
            {isLoadingEditor
              ? "Preparing editor..."
              : isEditMode
                ? "Text edit mode is active"
                : "Activate global text edit mode"}
          </button>

          <span className="helper-caption">
            {isEditMode
              ? `${pendingCount} unsaved text change${pendingCount === 1 ? "" : "s"} in the current editing session.`
              : "After activation, click static text to edit it inline. Inside links and buttons, use Shift + click."}
          </span>
        </div>
      </section>

      {showConfirm ? (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          data-text-edit-runtime="true"
        >
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="text-edit-mode-title"
            data-text-edit-runtime="true"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Enable text editing</p>
                <h2 id="text-edit-mode-title">Activate global text edit mode</h2>
                <p className="page-subtitle">
                  Static interface text across the system will become clickable and
                  editable inline. Dynamic values such as user names, gig data, and
                  dates will remain unchanged.
                </p>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isLoadingEditor}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void confirmActivation();
                  }}
                  disabled={isLoadingEditor}
                >
                  {isLoadingEditor ? "Preparing..." : "Confirm and activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
