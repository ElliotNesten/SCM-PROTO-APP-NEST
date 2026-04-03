"use client";

import { useState } from "react";

type LoginPasswordFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export function LoginPasswordField({
  name,
  label,
  placeholder = "Enter your password",
  required = false,
  defaultValue,
  autoComplete,
  disabled = false,
}: LoginPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  function showPassword() {
    setIsVisible(true);
  }

  function hidePassword() {
    setIsVisible(false);
  }

  return (
    <label className="login-field">
      <span className="login-field-label">{label}</span>
      <div className="login-password-field-shell">
        <input
          name={name}
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          className="login-password-visibility-button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          title="Hold to reveal password"
          disabled={disabled}
          onPointerDown={(event) => {
            event.preventDefault();
            showPassword();
          }}
          onPointerUp={hidePassword}
          onPointerLeave={hidePassword}
          onPointerCancel={hidePassword}
          onBlur={hidePassword}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              showPassword();
            }
          }}
          onKeyUp={hidePassword}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </button>
      </div>
    </label>
  );
}
