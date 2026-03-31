"use client";

import { useState } from "react";

type VerificationState = "valid" | "expired" | "consumed" | "invalidated" | "missing";

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
      setErrorMessage("Fyll i losenordet i bada falten.");
      return;
    }

    if (password.trim().length < 8) {
      setErrorMessage("Losenordet maste vara minst 8 tecken.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Losenorden matchar inte.");
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
      setErrorMessage(payload?.error ?? "Kunde inte skapa losenordet just nu.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = payload?.redirectTo || "/staff-app/onboarding";
  }

  if (verificationState !== "valid") {
    return (
      <div className="staff-app-create-password-card">
        <p className="staff-app-kicker">SCM activation</p>
        <h1>Linken ar inte giltig langre</h1>
        <p>
          Den har losenordslanken ar {verificationState === "expired" ? "utgangen" : "inte giltig"}.
          Maila INFO@scm.se eller kontakta din narmaste chef for att fa en ny lank.
        </p>
      </div>
    );
  }

  return (
    <div className="staff-app-create-password-card">
      <div className="staff-app-create-password-copy">
        <p className="staff-app-kicker">SCM activation</p>
        <h1>Skapa ditt losenord</h1>
        <p>
          Kontot for <strong>{email}</strong> aktiveras direkt nar du sparar ett nytt losenord.
          {expiresAt ? (
            <>
              {" "}
              Lanken galler till <strong>{new Date(expiresAt).toLocaleString("sv-SE")}</strong>.
            </>
          ) : null}
        </p>
      </div>

      <form className="staff-app-create-password-form" onSubmit={handleSubmit}>
        <label className="staff-app-form-field">
          <span>Nytt losenord</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
        </label>

        <label className="staff-app-form-field">
          <span>Bekrafta losenord</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            required
          />
        </label>

        {errorMessage ? <p className="staff-app-inline-alert danger">{errorMessage}</p> : null}

        <button type="submit" className="staff-app-button" disabled={isSubmitting}>
          {isSubmitting ? "Aktiverar..." : "Skapa mitt losenord"}
        </button>
      </form>
    </div>
  );
}
