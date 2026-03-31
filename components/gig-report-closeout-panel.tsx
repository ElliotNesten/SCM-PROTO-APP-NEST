"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { GigCloseoutChecklist } from "@/lib/gig-closeout";
import type { GigStatus } from "@/types/scm";

function formatCloseoutTimestamp(value: string) {
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
  }).format(parsedDate);
}

export function GigReportCloseoutPanel({
  gigId,
  gigStatus,
  initialChecklist,
  initialInvoicesPaidAt,
  initialEconomyComment,
  initialClosedAt,
  initialClosedByName,
  canReopen,
}: {
  gigId: string;
  gigStatus: GigStatus;
  initialChecklist: GigCloseoutChecklist;
  initialInvoicesPaidAt?: string;
  initialEconomyComment?: string;
  initialClosedAt?: string;
  initialClosedByName?: string;
  canReopen?: boolean;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [isClosed, setIsClosed] = useState(gigStatus === "Closed");
  const [invoicesPaidAt, setInvoicesPaidAt] = useState<string | null>(
    initialInvoicesPaidAt ?? null,
  );
  const [economyComment, setEconomyComment] = useState(initialEconomyComment ?? "");
  const [savedEconomyComment, setSavedEconomyComment] = useState(initialEconomyComment ?? "");
  const [closedAt, setClosedAt] = useState<string | null>(initialClosedAt ?? null);
  const [closedByName, setClosedByName] = useState(initialClosedByName ?? "");
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);
  const [closeoutFeedback, setCloseoutFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "economy" | "close" | "override" | "reopen" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecklist(initialChecklist);
  }, [initialChecklist]);

  useEffect(() => {
    setIsClosed(gigStatus === "Closed");
  }, [gigStatus]);

  useEffect(() => {
    setInvoicesPaidAt(initialInvoicesPaidAt ?? null);
  }, [initialInvoicesPaidAt]);

  useEffect(() => {
    setEconomyComment(initialEconomyComment ?? "");
    setSavedEconomyComment(initialEconomyComment ?? "");
  }, [initialEconomyComment]);

  useEffect(() => {
    setClosedAt(initialClosedAt ?? null);
  }, [initialClosedAt]);

  useEffect(() => {
    setClosedByName(initialClosedByName ?? "");
  }, [initialClosedByName]);

  async function updateEconomy(nextPaid?: boolean) {
    setPendingAction("economy");
    setCloseoutError(null);
    setCloseoutFeedback(null);

    const response = await fetch(`/api/gigs/${gigId}/closeout`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoicesPaid: nextPaid,
        economyComment,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          gig?: { status?: string; invoicesPaidAt?: string; economyComment?: string };
          checklist?: GigCloseoutChecklist;
        }
      | null;

    if (!response.ok || !payload?.checklist || !payload?.gig) {
      setCloseoutError(payload?.error ?? "Could not update economy.");
      setPendingAction(null);
      return;
    }

    setChecklist(payload.checklist);
    setInvoicesPaidAt(payload.gig.invoicesPaidAt ?? null);
    const nextComment = payload.gig.economyComment ?? "";
    setEconomyComment(nextComment);
    setSavedEconomyComment(nextComment);
    setCloseoutFeedback(
      nextPaid === undefined
        ? "Economy comment saved."
        : nextPaid
          ? "Invoices marked as paid."
          : "Invoices marked as unpaid.",
    );
    setPendingAction(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function overrideCloseGig() {
    setPendingAction("override");
    setCloseoutError(null);
    setCloseoutFeedback(null);

    const response = await fetch(`/api/gigs/${gigId}/closeout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        override: true,
        missingMandatoryPartsAcknowledged: overrideAcknowledged,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          gig?: { status?: string; closedAt?: string; closedByName?: string };
          checklist?: GigCloseoutChecklist;
        }
      | null;

    if (!response.ok || !payload?.gig) {
      setCloseoutError(payload?.error ?? "Could not override close the gig.");
      setPendingAction(null);
      return;
    }

    setChecklist(payload.checklist ?? initialChecklist);
    setIsClosed(payload.gig.status === "Closed");
    setClosedAt(payload.gig.closedAt ?? null);
    setClosedByName(payload.gig.closedByName ?? "");
    setOverrideAcknowledged(false);
    setCloseoutFeedback("Gig closed with override.");
    setPendingAction(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function closeGig() {
    setPendingAction("close");
    setCloseoutError(null);
    setCloseoutFeedback(null);

    const response = await fetch(`/api/gigs/${gigId}/closeout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          gig?: { status?: string; closedAt?: string; closedByName?: string };
          checklist?: GigCloseoutChecklist;
        }
      | null;

    if (!response.ok || !payload?.gig) {
      setCloseoutError(payload?.error ?? "Could not close the gig.");
      setPendingAction(null);
      return;
    }

    setChecklist(payload.checklist ?? initialChecklist);
    setIsClosed(payload.gig.status === "Closed");
    setClosedAt(payload.gig.closedAt ?? null);
    setClosedByName(payload.gig.closedByName ?? "");
    setCloseoutFeedback("Gig closed.");
    setPendingAction(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function reopenGig() {
    setPendingAction("reopen");
    setCloseoutError(null);
    setCloseoutFeedback(null);

    const response = await fetch(`/api/gigs/${gigId}/closeout`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          gig?: {
            status?: string;
            invoicesPaidAt?: string;
            economyComment?: string;
            closedAt?: string;
            closedByName?: string;
          };
          checklist?: GigCloseoutChecklist;
        }
      | null;

    if (!response.ok || !payload?.gig || !payload?.checklist) {
      setCloseoutError(payload?.error ?? "Could not reopen the gig.");
      setPendingAction(null);
      return;
    }

    setChecklist(payload.checklist);
    setIsClosed(payload.gig.status === "Closed");
    setInvoicesPaidAt(payload.gig.invoicesPaidAt ?? initialInvoicesPaidAt ?? null);
    setEconomyComment(payload.gig.economyComment ?? initialEconomyComment ?? "");
    setSavedEconomyComment(payload.gig.economyComment ?? initialEconomyComment ?? "");
    setClosedAt(payload.gig.closedAt ?? null);
    setClosedByName(payload.gig.closedByName ?? "");
    setCloseoutFeedback("Gig reopened.");
    setPendingAction(null);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="report-closeout-panel">
      <div className="report-closeout-head">
        <div>
          <p className="eyebrow">Closeout</p>
          <h3>Close gig requirements</h3>
          <p className="muted">
            `Close gig` unlocks when the required reports items are complete.
            Use override only when the mandatory parts do not exist for this gig.
          </p>
        </div>

        <div className="report-closeout-status">
          <div className="report-closeout-head-actions">
            {isClosed ? <span className="chip chip-soft active">Gig closed</span> : null}
            {isClosed && canReopen ? (
              <button
                type="button"
                className="button ghost"
                disabled={pendingAction !== null || isPending}
                onClick={() => {
                  void reopenGig();
                }}
              >
                {pendingAction === "reopen" ? "Opening..." : "Open gig again"}
              </button>
            ) : null}
          </div>

          {isClosed && closedAt ? (
            <p className="small-text report-closeout-meta">
              Closed by {closedByName || "Unknown user"} on {formatCloseoutTimestamp(closedAt)}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="report-closeout-grid">
        <article className="report-closeout-card">
          <div className="report-closeout-card-head">
            <div>
              <p className="eyebrow">Economy</p>
              <h4>Invoices</h4>
              <p className="muted">
                Mark invoice payment here and leave an economy note for this gig.
              </p>
            </div>

            {invoicesPaidAt ? (
              <span className="chip chip-soft active">Paid {formatCloseoutTimestamp(invoicesPaidAt)}</span>
            ) : null}
          </div>

          <label className="report-closeout-field">
            <span className="small-text">Comment</span>
            <textarea
              value={economyComment}
              rows={4}
              placeholder="Add an economy comment"
              disabled={isClosed || pendingAction !== null || isPending}
              onChange={(event) => {
                setEconomyComment(event.currentTarget.value);
              }}
            />
          </label>

          <div className="report-closeout-card-actions">
            <button
              type="button"
              className={invoicesPaidAt ? "button" : "button ghost"}
              disabled={isClosed || pendingAction !== null || isPending}
              onClick={() => {
                void updateEconomy(!invoicesPaidAt);
              }}
            >
              {pendingAction === "economy" ? "Saving..." : "Invoices paid"}
            </button>

            <button
              type="button"
              className="button ghost"
              disabled={
                isClosed ||
                pendingAction !== null ||
                isPending ||
                economyComment.trim() === savedEconomyComment.trim()
              }
              onClick={() => {
                void updateEconomy();
              }}
            >
              {pendingAction === "economy" ? "Saving..." : "Save comment"}
            </button>
          </div>
        </article>
      </div>

      <div className="report-closeout-checklist">
        {checklist.requirements.map((requirement) => (
          <span
            key={requirement.key}
            className={`chip ${requirement.satisfied ? "chip-soft active" : ""}`}
          >
            {requirement.label}
          </span>
        ))}
      </div>

      <label className="report-closeout-override-toggle">
        <input
          type="checkbox"
          checked={overrideAcknowledged}
          disabled={isClosed || checklist.allRequiredComplete || pendingAction !== null || isPending}
          onChange={(event) => {
            setOverrideAcknowledged(event.currentTarget.checked);
            setCloseoutError(null);
          }}
        />
        <span>The mandatory parts do not exist for this gig.</span>
      </label>

      <div className="report-closeout-footer">
        <p className="small-text">
          {checklist.allRequiredComplete
            ? "All mandatory reports items are complete. You can close the gig now."
            : "Time report approval, Event Manager, gig files, and invoices paid are required before the gig can be closed normally."}
        </p>

        <div className="report-closeout-footer-actions">
          <button
            type="button"
            className="button"
            disabled={
              isClosed ||
              !checklist.allRequiredComplete ||
              pendingAction !== null ||
              isPending
            }
            onClick={() => {
              void closeGig();
            }}
          >
            {pendingAction === "close" ? "Closing..." : isClosed ? "Gig closed" : "Close gig"}
          </button>

          <button
            type="button"
            className="button ghost danger-outline"
            disabled={
              isClosed ||
              checklist.allRequiredComplete ||
              !overrideAcknowledged ||
              pendingAction !== null ||
              isPending
            }
            onClick={() => {
              void overrideCloseGig();
            }}
          >
            {pendingAction === "override" ? "Closing..." : "Override close gig"}
          </button>
        </div>
      </div>

      {closeoutError ? <p className="form-error">{closeoutError}</p> : null}
      {closeoutFeedback ? <p className="small-text report-closeout-feedback">{closeoutFeedback}</p> : null}
    </section>
  );
}
