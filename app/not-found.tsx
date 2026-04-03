import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-shell">
      <div className="card centered-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="page-subtitle">
          This page doesn't exist yet.
        </p>
        <div className="page-actions">
          <Link href="/dashboard" className="button">
            Back to dashboard
          </Link>
          <Link href="/gigs" className="button ghost">
            Browse gigs
          </Link>
        </div>
      </div>
    </div>
  );
}
