"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  staffApplicationCountryOptions,
  swedenStaffApplicationRegionOptions,
} from "@/types/job-applications";

type SubmissionState = "idle" | "submitting" | "success";

const thankYouMessage =
  "Thank you for your application. We will review it as soon as possible. More information will be sent by email.";

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function createInitialFormState() {
  return {
    profileImage: null as File | null,
    firstName: "",
    lastName: "",
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formState, setFormState] = useState(createInitialFormState);
  const selectedFileLabel = useMemo(
    () => formState.profileImage?.name ?? "Upload profile image",
    [formState.profileImage],
  );
  const requiresSwedenDropdown = formState.country === "Sweden";
  const displayInitials = useMemo(
    () => getDisplayInitials(`${formState.firstName} ${formState.lastName}`) || "SC",
    [formState.firstName, formState.lastName],
  );

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!formState.profileImage) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(formState.profileImage);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [formState.profileImage]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!formState.profileImage) {
      setErrorMessage("Profile image is required.");
      return;
    }

    setSubmissionState("submitting");

    const payload = new FormData();
    payload.set("profileImage", formState.profileImage);
    payload.set("firstName", formState.firstName);
    payload.set("lastName", formState.lastName);
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
      setErrorMessage(data?.error ?? "Your application could not be submitted right now.");
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
                    <p>Submit your application here. All fields are required.</p>
                  </div>

                  <button
                    type="button"
                    className="staff-app-modal-close"
                    onClick={closeModal}
                    aria-label="Close"
                  >
                    X
                  </button>
                </div>

                {submissionState === "success" ? (
                  <div className="staff-app-modal-success">
                    <p>{thankYouMessage}</p>
                    <button type="button" className="staff-app-button" onClick={closeModal}>
                      Close
                    </button>
                  </div>
                ) : (
                  <form className="staff-app-modal-form" onSubmit={handleSubmit}>
                    <label className="staff-app-form-field">
                      <span>Profile image</span>
                      <div className="staff-app-upload-field">
                        <div className="staff-app-upload-preview" aria-hidden="true">
                          {previewUrl ? (
                            <img src={previewUrl} alt="" className="staff-app-upload-preview-image" />
                          ) : (
                            <span className="staff-app-upload-preview-fallback">
                              {displayInitials}
                            </span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                          onChange={(event) => {
                            const nextProfileImage = event.currentTarget.files?.[0] ?? null;
                            setFormState((current) => ({
                              ...current,
                              profileImage: nextProfileImage,
                            }));
                          }}
                          required
                        />
                        <strong>{selectedFileLabel}</strong>
                      </div>
                    </label>

                    <label className="staff-app-form-field">
                      <span>First name</span>
                      <input
                        type="text"
                        value={formState.firstName}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            firstName: event.currentTarget.value,
                          }));
                        }}
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Last name</span>
                      <input
                        type="text"
                        value={formState.lastName}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            lastName: event.currentTarget.value,
                          }));
                        }}
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(event) => {
                          const nextEmail = event.currentTarget.value;
                          setFormState((current) => ({
                            ...current,
                            email: nextEmail,
                          }));
                        }}
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Phone number</span>
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(event) => {
                          const nextPhone = event.currentTarget.value;
                          setFormState((current) => ({
                            ...current,
                            phone: nextPhone,
                          }));
                        }}
                        required
                      />
                    </label>

                    <label className="staff-app-form-field">
                      <span>Country</span>
                      <select
                        value={formState.country}
                        onChange={(event) => {
                          const nextCountry = event.currentTarget.value;
                          setFormState((current) => ({
                            ...current,
                            country: nextCountry,
                            region: nextCountry === "Sweden" ? "Stockholm" : "",
                          }));
                        }}
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
                          onChange={(event) => {
                            const nextRegion = event.currentTarget.value;
                            setFormState((current) => ({
                              ...current,
                              region: nextRegion,
                            }));
                          }}
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
                        <span>Region / city</span>
                        <input
                          type="text"
                          value={formState.region}
                          onChange={(event) => {
                            const nextRegion = event.currentTarget.value;
                            setFormState((current) => ({
                              ...current,
                              region: nextRegion,
                            }));
                          }}
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
                        Cancel
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
