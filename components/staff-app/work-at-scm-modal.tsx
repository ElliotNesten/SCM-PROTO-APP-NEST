"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  staffApplicationCountryOptions,
  swedenStaffApplicationRegionOptions,
} from "@/types/job-applications";

type SubmissionState = "idle" | "submitting" | "success";

const thankYouMessage =
  "Tack for din ansokan, vi kommer att kolla sa snart som mojligt. Mer info kommer via mail.";

function createInitialFormState() {
  return {
    profileImage: null as File | null,
    displayName: "",
    email: "",
    phone: "",
    country: "Sweden",
    region: "Stockholm",
  };
}

export function WorkAtScmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState(createInitialFormState);
  const selectedFileLabel = useMemo(
    () => formState.profileImage?.name ?? "Upload profile image",
    [formState.profileImage],
  );
  const requiresSwedenDropdown = formState.country === "Sweden";

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!formState.profileImage) {
      setErrorMessage("Profilbild ar obligatorisk.");
      return;
    }

    setSubmissionState("submitting");

    const payload = new FormData();
    payload.set("profileImage", formState.profileImage);
    payload.set("displayName", formState.displayName);
    payload.set("email", formState.email);
    payload.set("phone", formState.phone);
    payload.set("country", formState.country);
    payload.set("region", formState.region);

    const response = await fetch("/api/staff-app/work-at-scm/applications", {
      method: "POST",
      body: payload,
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.error ?? "Ansokan kunde inte skickas just nu.");
      setSubmissionState("idle");
      return;
    }

    setSubmissionState("success");
    setFormState(createInitialFormState());
  }

  function closeModal() {
    setIsOpen(false);
    setErrorMessage("");
    setSubmissionState("idle");
    setFormState(createInitialFormState());
  }

  return (
    <>
      <button
        type="button"
        className="staff-app-button secondary staff-app-work-at-scm-trigger"
        onClick={() => setIsOpen(true)}
      >
        Work at SCM
      </button>

      {isOpen && portalRoot
        ? createPortal(
            <div className="staff-app-modal-overlay" role="presentation">
              <div
                className="staff-app-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-at-scm-title"
              >
                <div className="staff-app-modal-head">
                  <div>
                    <p className="staff-app-kicker">SCM recruitment</p>
                    <h2 id="work-at-scm-title">Work at SCM</h2>
                    <p>Skicka in din ansokan direkt har. Alla falt ar obligatoriska.</p>
                  </div>

                  <button
                    type="button"
                    className="staff-app-modal-close"
                    onClick={closeModal}
                    aria-label="Stang"
                  >
                    X
                  </button>
                </div>

                {submissionState === "success" ? (
                  <div className="staff-app-modal-success">
                    <p>{thankYouMessage}</p>
                    <button type="button" className="staff-app-button" onClick={closeModal}>
                      Stang
                    </button>
                  </div>
                ) : (
                  <form className="staff-app-modal-form" onSubmit={handleSubmit}>
                    <label className="staff-app-form-field">
                      <span>Profilbild</span>
                      <div className="staff-app-upload-field">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              profileImage: event.currentTarget.files?.[0] ?? null,
                            }))
                          }
                          required
                        />
                        <strong>{selectedFileLabel}</strong>
                        <small>PNG, JPG eller WEBP, max 5 MB</small>
                      </div>
                    </label>

                    <label className="staff-app-form-field">
                      <span>Namn</span>
                      <input
                        type="text"
                        value={formState.displayName}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            displayName: event.currentTarget.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            email: event.currentTarget.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Telefonnummer</span>
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            phone: event.currentTarget.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Land</span>
                      <select
                        value={formState.country}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            country: event.currentTarget.value,
                            region: event.currentTarget.value === "Sweden" ? "Stockholm" : "",
                          }))
                        }
                        required
                      >
                        {staffApplicationCountryOptions.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </label>

                    {requiresSwedenDropdown ? (
                      <label className="staff-app-form-field">
                        <span>Region</span>
                        <select
                          value={formState.region}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              region: event.currentTarget.value,
                            }))
                          }
                          required
                        >
                          {swedenStaffApplicationRegionOptions.map((region) => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="staff-app-form-field">
                        <span>Region / stad</span>
                        <input
                          type="text"
                          value={formState.region}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              region: event.currentTarget.value,
                            }))
                          }
                          required
                        />
                      </label>
                    )}

                    {errorMessage ? (
                      <p className="staff-app-inline-alert danger">{errorMessage}</p>
                    ) : null}

                    <div className="staff-app-modal-actions">
                      <button
                        type="button"
                        className="staff-app-button secondary"
                        onClick={closeModal}
                        disabled={submissionState === "submitting"}
                      >
                        Avbryt
                      </button>
                      <button
                        type="submit"
                        className="staff-app-button"
                        disabled={submissionState === "submitting"}
                      >
                        {submissionState === "submitting" ? "Sending..." : "Apply"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>,
            portalRoot,
          )
        : null}
    </>
  );
}
