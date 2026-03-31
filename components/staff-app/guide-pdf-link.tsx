function buildClassName(className?: string) {
  return ["staff-app-button", "secondary", "staff-app-guide-pdf-link", className]
    .filter(Boolean)
    .join(" ");
}

export function StaffAppGuidePdfLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={buildClassName(className)}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}
