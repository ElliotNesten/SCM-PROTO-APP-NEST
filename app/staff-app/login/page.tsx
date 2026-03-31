import Image from "next/image";

import { loginToStaffApp } from "@/app/staff-app/actions";
import { LoginPasswordField } from "@/components/login-password-field";
import { getBrandSettings } from "@/lib/brand-store";

type StaffAppLoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    email?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getLoginErrorMessage(errorCode: string | undefined) {
  if (errorCode === "missing") {
    return "Enter both email and password to continue.";
  }

  if (errorCode === "invalid") {
    return "The email or password is incorrect.";
  }

  return "";
}

export default async function StaffAppLoginPage({
  searchParams,
}: StaffAppLoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const brandSettings = await getBrandSettings();
  const savedEmail = pickQueryValue(resolvedSearchParams?.email) ?? "anton@scm.se";
  const errorMessage = getLoginErrorMessage(
    pickQueryValue(resolvedSearchParams?.error),
  );

  return (
    <div className="staff-app-shell login">
      <div className="staff-app-device login">
        <section className="staff-app-login-screen">
          <div className="staff-app-login-brand-card">
            <div className="staff-app-login-brand-top">
              <div className="staff-app-login-logo-shell">
                <Image
                  src={brandSettings.logoUrl}
                  alt="SCM"
                  width={216}
                  height={76}
                  className="staff-app-login-logo"
                  unoptimized
                />
              </div>
              <span className="staff-app-login-platform-badge">SCM Platform</span>
            </div>

            <div className="staff-app-login-hero">
              <p className="staff-app-kicker">SCM Staff App</p>
              <h1>Everything around your next shift.</h1>
            </div>
          </div>

          <form
            action={loginToStaffApp}
            className="staff-app-card staff-app-form-card staff-app-login-form"
          >
            <div className="staff-app-login-form-head">
              <p className="staff-app-kicker">SCM Staff account</p>
              <h2>Sign in</h2>
            </div>

            <div className="staff-app-login-pill-row">
              <span className="staff-app-login-pill subtle">Secure mobile access</span>
            </div>

            <label className="field full-width">
              <span>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={savedEmail}
                placeholder="name@scm.se"
                autoComplete="email"
                required
              />
            </label>

            <LoginPasswordField
              name="password"
              label="Password"
              defaultValue="anton123"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />

            {errorMessage ? <p className="staff-app-inline-alert danger">{errorMessage}</p> : null}
            <button type="submit" className="staff-app-button">
              Log in to staff app
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
