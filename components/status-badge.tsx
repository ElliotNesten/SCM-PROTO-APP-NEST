import type { BookingStatus, GigStatus, StaffApprovalStatus } from "@/types/scm";

type BadgeTone = "neutral" | "info" | "success" | "warn" | "danger";

export function statusTone(
  value: GigStatus | BookingStatus | StaffApprovalStatus | string,
): BadgeTone {
  if (
    value === "Closed" ||
    value === "Completed" ||
    value === "Reported" ||
    value === "Approved" ||
    value === "Confirmed"
  ) {
    return "success";
  }

  if (value === "Investigating" || value === "Identified" || value === "Waitlisted") {
    return "warn";
  }

  if (value === "Applicant" || value === "Pending") {
    return "info";
  }

  if (value === "Archived") {
    return "danger";
  }

  return "neutral";
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`status-badge status-${tone ?? statusTone(label)}`}
      data-text-edit-exclude="true"
    >
      {label}
    </span>
  );
}
