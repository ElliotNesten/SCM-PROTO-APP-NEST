import Link from "next/link";

function StaffAppBackChevron() {
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

export function StaffAppPageBackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} className="staff-app-colleague-back" aria-label={label}>
      <StaffAppBackChevron />
    </Link>
  );
}
