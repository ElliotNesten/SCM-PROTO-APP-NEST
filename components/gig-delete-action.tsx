"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GigDeleteAction({
  gigId,
  gigArtist,
}: {
  gigId: string;
  gigArtist: string;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  async function deleteGig() {
    setIsDeleting(true);
    setDeleteMessage(null);

    const response = await fetch(`/api/gigs/${gigId}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setDeleteMessage(payload?.error ?? "Could not delete the archived gig.");
      setIsDeleting(false);
      return;
    }

    router.push("/gigs");
  }

  return (
    <>
      <button
        type="button"
        className="button ghost danger-outline"
        onClick={() => {
          setDeleteMessage(null);
          setShowConfirm(true);
        }}
      >
        Delete gig
      </button>

      {showConfirm ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-gig-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Delete gig</p>
                <h2 id="delete-gig-title">Permanent removal</h2>
                <p className="page-subtitle">
                  This permanently deletes the archived gig <strong>{gigArtist}</strong>,
                  including its shifts, shared gig access, files, and related shift
                  communication. This action cannot be undone.
                </p>
              </div>

              {deleteMessage ? <p className="muted">{deleteMessage}</p> : null}

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    void deleteGig();
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Confirm delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
