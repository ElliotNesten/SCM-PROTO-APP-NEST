"use client";

import { useState } from "react";

type VerificationState = "valid" | "expired" | "consumed" | "invalidated" | "missing";

function formatExpiryTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });
}

export function CreatePasswordForm({
  token,
  verificationState,
  email,
  expiresAt,
}: {
  token: string;
  verificationState: VerificationState;
  email: string;
  expiresAt: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!password.trim() || !confirmPassword.trim()) {
      setErrorMessage("Enter your password in both fields.");
      return;
    }

    if (password.trim().length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/staff-app/create-password/set-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          redirectTo?: string;
        }
      | null;

    if (!response.ok) {
      setErrorMessage(payload?.error ?? "Your password could not be created right now.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = payload?.redirectTo || "/staff-app/onboarding";
  }

  if (verificationState !== "valid") {
    return (
      <div className="staff-app-create-password-card">
        <p className="staff-app-kicker">SCM activation</p>
        <h1>This link is no longer valid</h1>
        <p>
          This password link is{" "}
          {verificationState === "expired" ? "expired" : "no longer valid"}. Email
          {" "}
          INFO@scm.se or contact your nearest manager to receive a new link.
        </p>
      </div>
    );
  }

  return (
    <div className="staff-app-create-password-card">
      <div className="staff-app-create-password-copy">
        <p className="staff-app-kicker">SCM activation</p>
        <h1>Create your password</h1>
        <p>
          The account for <strong>{email}</strong> will be activated as soon as you save a new
          password.
          {expiresAt ? (
            <>
              {" "}
              This link is valid until <strong>{formatExpiryTimestamp(expiresAt)}</strong>.
            </>
          ) : null}
        </p>
      </div>

      <form className="staff-app-create-password-form" onSubmit={handleSubmit}>
        <label className="staff-app-form-field">
          <span>New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
        </label>

        <label className="staff-app-form-field">
          <span>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            required
          />
        </label>

        {errorMessage ? <p className="staff-app-inline-alert danger">{errorMessage}</p> : null}

        <button type="submit" className="staff-app-button" disabled={isSubmitting}>
          {isSubmitting ? "Activating..." : "Create my password"}
        </button>
      </form>
    </div>
  );
}
