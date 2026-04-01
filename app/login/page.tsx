import Image from "next/image";
import Link from "next/link";

import { loginWithScmStaff, logoutCurrentUser } from "@/app/auth-actions";
import { LoginPasswordField } from "@/components/login-password-field";
import { getBrandSettings } from "@/lib/brand-store";
import { getCurrentAuthenticatedUserSummary } from "@/lib/auth-session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    email?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(errorCode: string | undefined) {
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
  const brandSettings = await getBrandSettings();
  const savedEmail = pickQueryValue(resolvedSearchParams?.email) ?? "";
  const errorMessage = getErrorMessage(pickQueryValue(resolvedSearchParams?.error));

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-card">
          <div className="login-surface">
            <div className="login-brand-panel">
              <div className="login-brand">
                <Link href="/" className="login-brand-logo" aria-label="SCM home">
                  <Image
                    src={brandSettings.logoUrl}
                    alt="SCM"
                    width={240}
                    height={84}
                    className="login-brand-logo-image"
                    unoptimized
                  />
                </Link>
                <div className="login-brand-copy">
                  <p className="eyebrow">SCM PLATFORM</p>
                  <h1>Welcome back</h1>
                  <p className="page-subtitle">
                    Sign in with your SCM Staff account or shared gig access to manage the
                    platform areas available to you.
                  </p>
                </div>
              </div>
            </div>

            <div className="login-form-panel">
              {currentUser ? (
                <div className="login-session-banner">
                  <div>
                    <strong>Currently signed in as {currentUser.displayName}</strong>
                    <p className="muted">
                      Continue working, sign out, or switch to another platform account below.
                    </p>
                  </div>
                  <div className="page-actions">
                    <Link href="/dashboard" className="button ghost">
                      Back to dashboard
                    </Link>
                    <form action={logoutCurrentUser}>
                      <button type="submit" className="button ghost">
                        Log out
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}

              <form action={loginWithScmStaff} className="login-form-card">
                <div className="login-form-head">
                  <p className="eyebrow">SCM Staff account</p>
                  <h2>Sign in</h2>
                </div>

                <div className="login-form-fields">
                  <label className="field full-width">
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="edwin.jones@scm.se"
                      defaultValue={savedEmail}
                      required
                    />
                  </label>
                  <LoginPasswordField
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

                <div className="login-assistance">
                  <span className="login-forgot-link">Forgot password?</span>
                  <span className="login-forgot-copy">
                    Contact a Super Admin to resend activation or reset your access.
                  </span>
                </div>

                <button type="submit" className="button login-submit-button">
                  Log in
                </button>

                <div className="login-footnote">
                  <p className="muted">
                    Legacy seeded accounts may still use a demo password based on first name +
                    <code>123</code> until they are changed or replaced by an activation invite.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
