import { redirect } from "next/navigation";

import { loginWithScmStaff, logoutCurrentUser } from "@/app/auth-actions";
import { LoginPasswordField } from "@/components/login-password-field";
import { getCurrentAuthenticatedUserSummary } from "@/lib/auth-session";
import { getSessionCookieConfigurationNotice, isSessionCookieConfigurationMissingInProduction } from "@/lib/session-cookie";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    email?: string | string[];
    mode?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(errorCode: string | undefined) {
  if (errorCode === "config") {
    return getSessionCookieConfigurationNotice();
  }

  if (errorCode === "missing") {
    return "Enter both email and password to sign in.";
  }

  if (errorCode === "invalid") {
    return "The email or password is incorrect.";
  }

  if (errorCode === "expired") {
    return "This temporary gig access has expired for the platform login.";
  }

  return "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentUser = await getCurrentAuthenticatedUserSummary();
  const loginMode = pickQueryValue(resolvedSearchParams?.mode);
  const authConfigurationIssue = isSessionCookieConfigurationMissingInProduction();

  if (currentUser && loginMode !== "switch") {
    redirect("/dashboard");
  }

  const savedEmail = pickQueryValue(resolvedSearchParams?.email) ?? "";
  const errorMessage = getErrorMessage(pickQueryValue(resolvedSearchParams?.error));

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-card">
          <div className="login-icon-wrap">
            <svg className="login-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16.5" r="1.5" />
            </svg>
          </div>

          <div className="login-form-head">
            <h2>Sign in with email</h2>
            <p className="login-subtitle">Enter your credentials to access your account</p>
          </div>

          {currentUser ? (
            <div className="login-session-banner">
              <div>
                <strong>Signed in as {currentUser.firstName} {currentUser.lastName}</strong>
                <p className="muted">
                  Continue, log out, or switch account.
                </p>
              </div>
              <div className="page-actions">
                <a href="/dashboard" className="button ghost">
                  Back to dashboard
                </a>
                <form action={logoutCurrentUser}>
                  <button type="submit" className="button ghost">
                    Log out
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {authConfigurationIssue ? (
            <div className="note-block tone-warn">
              <p>{getSessionCookieConfigurationNotice()}</p>
            </div>
          ) : null}

          <form action={loginWithScmStaff} className="login-form">
            {loginMode === "switch" ? (
              <input type="hidden" name="mode" value="switch" />
            ) : null}

            <div className="login-form-fields">
              <label className="login-field">
                <span className="login-field-label">Email address</span>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    name="email"
                    type="email"
                    placeholder="name@scm.se"
                    defaultValue={savedEmail}
                    disabled={authConfigurationIssue}
                    required
                  />
                </div>
              </label>
              <LoginPasswordField
                name="password"
                label="Password"
                placeholder="Enter your password"
                disabled={authConfigurationIssue}
                required
              />
            </div>

            {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

            <div className="login-forgot">
              <span className="login-forgot-link">Forgot password?</span>
            </div>

            <button
              type="submit"
              className="login-submit-button"
              disabled={authConfigurationIssue}
            >
              {authConfigurationIssue ? "Authentication unavailable" : "Sign in"}
            </button>

            <p className="login-footnote">
              Demo accounts use first name + <code>123</code> as password.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
