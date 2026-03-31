import Link from "next/link";
import { notFound } from "next/navigation";

import { getStaffAppColleagueById, getStaffAppInitials } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

function StaffAppDetailBackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m14.5 6.5-5 5 5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function StaffAppContactIcon({ kind }: { kind: "phone" | "email" }) {
  if (kind === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8.2 5.6a1.7 1.7 0 0 1 2.2-.3l1.7 1.3a1.7 1.7 0 0 1 .5 2.1l-.8 1.6a13.2 13.2 0 0 0 2 2.6 13.2 13.2 0 0 0 2.6 2l1.6-.8a1.7 1.7 0 0 1 2.1.5l1.3 1.7a1.7 1.7 0 0 1-.3 2.2l-1 1c-.7.7-1.7 1-2.7.8-2.6-.5-5.2-2-7.5-4.3S6 10.5 5.5 7.9c-.2-1 .1-2 .8-2.7l1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m6.5 8.5 5.5 4 5.5-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StaffAppDetailChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default async function StaffAppColleagueDetailPage({
  params,
}: {
  params: Promise<{ colleagueId: string }>;
}) {
  const account = await requireCurrentStaffAppAccount();
  const { colleagueId } = await params;
  const colleague = await getStaffAppColleagueById(account, colleagueId);

  if (!colleague) {
    notFound();
  }

  const initials = getStaffAppInitials(colleague.fullName);

  return (
    <section className="staff-app-screen staff-app-colleague-detail-screen">
      <Link href="/staff-app/colleagues" className="staff-app-colleague-back" aria-label="Back">
        <StaffAppDetailBackIcon />
      </Link>

      <div className="staff-app-colleague-detail-card">
        <div className="staff-app-colleague-detail-head">
          <h1>{colleague.fullName}</h1>
          <div className="staff-app-colleague-detail-avatar" aria-hidden="true">
            {colleague.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={colleague.profileImageUrl} alt={colleague.fullName} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <p>
            {colleague.country}, {colleague.region}
          </p>
        </div>

        <div className="staff-app-colleague-contact-stack">
          <a href={`tel:${colleague.phone}`} className="staff-app-colleague-contact-card">
            <span className="staff-app-colleague-contact-icon" aria-hidden="true">
              <StaffAppContactIcon kind="phone" />
            </span>
            <span className="staff-app-colleague-contact-copy">
              <strong>{colleague.phone}</strong>
              <span>Call colleague</span>
            </span>
            <span className="staff-app-colleague-contact-arrow" aria-hidden="true">
              <StaffAppDetailChevron />
            </span>
          </a>

          <a href={`mailto:${colleague.email}`} className="staff-app-colleague-contact-card">
            <span className="staff-app-colleague-contact-icon" aria-hidden="true">
              <StaffAppContactIcon kind="email" />
            </span>
            <span className="staff-app-colleague-contact-copy">
              <strong>{colleague.email}</strong>
              <span>Email colleague</span>
            </span>
            <span className="staff-app-colleague-contact-arrow" aria-hidden="true">
              <StaffAppDetailChevron />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
