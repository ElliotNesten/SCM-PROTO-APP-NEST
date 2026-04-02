import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatStaffAppDate,
  formatStaffAppTimestamp,
} from "@/lib/staff-app-data";
import {
  getStaffAppScmGigConversationThreads,
  getStaffAppScmGigWorkspace,
  type StaffAppScmRosterEntry,
} from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";
import { ScmLiveMessagesPanel } from "@/components/staff-app/scm-live-messages-panel";

import {
  updateScmGigRosterEntryAction,
  uploadScmGigFileAction,
} from "../actions";

type StaffAppScmLiveGigPageProps = {
  params: Promise<{
    gigId: string;
  }>;
  searchParams?: Promise<{
    chat?: string | string[];
    roster?: string | string[];
  }>;
};

type StaffAppScmLiveComposer = "all" | "stand-leaders" | "new-chat";

function getToneClassName(tone: "neutral" | "success" | "warn" | "danger") {
  if (tone === "success") {
    return "success";
  }

  if (tone === "warn") {
    return "warn";
  }

  if (tone === "danger") {
    return "danger";
  }

  return "neutral";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getArtistInitials(artist: string) {
  return artist
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getShiftStaffingCopy(shift: {
  plannedCount: number;
  confirmedCount: number;
  gapCount: number;
}) {
  const comingLabel = `${shift.confirmedCount} coming`;

  if (shift.gapCount > 0) {
    return {
      comingLabel,
      statusLabel: `${shift.gapCount} staff short`,
    };
  }

  if (shift.confirmedCount > shift.plannedCount) {
    return {
      comingLabel,
      statusLabel: `${shift.confirmedCount - shift.plannedCount} extra booked`,
    };
  }

  return {
    comingLabel,
    statusLabel: "Fully staffed",
  };
}

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveActiveMessageComposer(
  value: string | undefined,
): StaffAppScmLiveComposer | null {
  if (value === "all" || value === "stand-leaders" || value === "new-chat") {
    return value;
  }

  return null;
}

function resolveRosterExpanded(value: string | undefined) {
  return value === "open";
}

function getStockholmNowSnapshot() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`,
    timeKey: `${valueByType.get("hour")}:${valueByType.get("minute")}`,
  };
}

function hasShiftStarted(
  gigDate: string,
  shiftStartTime: string,
  now: ReturnType<typeof getStockholmNowSnapshot>,
) {
  return now.dateKey > gigDate || (now.dateKey === gigDate && now.timeKey >= shiftStartTime);
}

function getLiveRosterStatusMeta(
  entry: StaffAppScmRosterEntry,
  gigDate: string,
  now: ReturnType<typeof getStockholmNowSnapshot>,
) {
  if (entry.bookingStatus === "Pending") {
    return {
      label: "Pending",
      tone: "warn" as const,
    };
  }

  if (entry.bookingStatus === "Waitlisted") {
    return {
      label: "Waitlist",
      tone: "neutral" as const,
    };
  }

  if (entry.checkedOut) {
    return {
      label: "Checked out",
      tone: "neutral" as const,
    };
  }

  if (entry.checkedIn) {
    return {
      label: "Checked in",
      tone: "success" as const,
    };
  }

  if (entry.bookingStatus === "Confirmed") {
    if (hasShiftStarted(gigDate, entry.shiftStartTime, now)) {
      return {
        label: "Late checkin",
        tone: "danger" as const,
      };
    }

    return {
      label: "Waiting for check in",
      tone: "warn" as const,
    };
  }

  return {
    label: entry.statusLabel,
    tone: entry.tone,
  };
}

function buildLiveViewHref(
  livePath: string,
  options: {
    activeComposer?: StaffAppScmLiveComposer | null;
    rosterOpen?: boolean;
    hash?: string;
  },
) {
  const params = new URLSearchParams();

  if (options.activeComposer) {
    params.set("chat", options.activeComposer);
  }

  if (options.rosterOpen) {
    params.set("roster", "open");
  }

  const query = params.toString();
  const hash = options.hash ? `#${options.hash}` : "";

  return `${livePath}${query ? `?${query}` : ""}${hash}`;
}

function formatMissingStaffRoleLabel(role: string, count: number) {
  if (count === 1) {
    return role;
  }

  const lowerRole = role.trim().toLowerCase();

  if (lowerRole.endsWith("s")) {
    return role;
  }

  if (lowerRole.endsWith("y")) {
    return `${role.slice(0, -1)}ies`;
  }

  return `${role}s`;
}

function buildMissingStaffSummary(
  shifts: Array<{
    role: string;
    gapCount: number;
  }>,
) {
  const missingByRole = new Map<string, number>();
  let totalMissingStaff = 0;

  for (const shift of shifts) {
    if (shift.gapCount <= 0) {
      continue;
    }

    totalMissingStaff += shift.gapCount;
    missingByRole.set(shift.role, (missingByRole.get(shift.role) ?? 0) + shift.gapCount);
  }

  const items = [...missingByRole.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([role, count]) => `${count} ${formatMissingStaffRoleLabel(role, count)}`);

  return {
    totalMissingStaff,
    copy:
      items.length > 0
        ? items.join(" | ")
        : "Fully staffed across all passes.",
  };
}

function ScmLiveMetric({
  label,
  value,
  copy,
  href,
}: {
  label: string;
  value: string;
  copy: string;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} className="staff-app-scm-live-metric staff-app-scm-live-metric-link">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{copy}</p>
      </Link>
    );
  }

  return (
    <article className="staff-app-scm-live-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{copy}</p>
    </article>
  );
}

export default async function StaffAppScmLiveGigPage({
  params,
  searchParams,
}: StaffAppScmLiveGigPageProps) {
  const { gigId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const profile = await requireCurrentStaffAppScmProfile();
  const [workspace, conversationThreads] = await Promise.all([
    getStaffAppScmGigWorkspace(profile, gigId),
    getStaffAppScmGigConversationThreads(profile, gigId),
  ]);

  if (!workspace) {
    notFound();
  }

  const livePath = `/staff-app/scm/live/${gigId}`;
  const stockholmNow = getStockholmNowSnapshot();
  const activeMessageComposer = resolveActiveMessageComposer(
    pickQueryValue(resolvedSearchParams?.chat),
  );
  const isRosterOpen = resolveRosterExpanded(pickQueryValue(resolvedSearchParams?.roster));
  const rosterTogglePath = buildLiveViewHref(livePath, {
    activeComposer: activeMessageComposer,
    rosterOpen: !isRosterOpen,
    hash: "roster",
  });
  const rosterReturnTo = buildLiveViewHref(livePath, {
    activeComposer: activeMessageComposer,
    rosterOpen: true,
    hash: "roster",
  });
  const quickShiftPath = workspace.quickActionTargetShiftId
    ? `${livePath}/shifts/${workspace.quickActionTargetShiftId}`
    : "/staff-app/scm/gigs";
  const timeReportPath = `${livePath}/time-report`;
  const missingStaffSummary = buildMissingStaffSummary(workspace.shifts);
  const remainingTimeReportCount = Math.max(
    workspace.summary.correctableTimeEntryCount - workspace.summary.approvedTimeReportCount,
    0,
  );

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-top">
          <div className="staff-app-scm-live-hero-visual">
            {workspace.gig.profileImageUrl ? (
              <Image
                src={workspace.gig.profileImageUrl}
                alt={workspace.gig.artist}
                fill
                sizes="112px"
                className="staff-app-scm-live-hero-image"
                unoptimized
                priority
              />
            ) : (
              <span className="staff-app-scm-live-hero-fallback">
                {getArtistInitials(workspace.gig.artist)}
              </span>
            )}
          </div>

          <div className="staff-app-scm-live-hero-copy">
            <p className="staff-app-kicker">Operational live view</p>
            <h1>{workspace.gig.artist}</h1>
            <p>
              {workspace.gig.arena}, {workspace.gig.city}
            </p>
          </div>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <span className="staff-app-scm-live-pill">{formatStaffAppDate(workspace.gig.date)}</span>
        </div>

        <div className="staff-app-scm-live-pass-summary">
          <div className="staff-app-scm-live-pass-summary-head">
            <strong>Passes for this gig</strong>
            <span>
              {workspace.shifts.length} pass{workspace.shifts.length === 1 ? "" : "es"}
            </span>
          </div>

          <div className="staff-app-scm-live-pass-list">
            {workspace.shifts.map((shift) => {
              const staffingCopy = getShiftStaffingCopy(shift);

              return (
                <Link
                  key={shift.id}
                  href={`${livePath}/shifts/${shift.id}`}
                  className="staff-app-scm-live-pass-item"
                >
                  <div className="staff-app-scm-live-pass-copy">
                    <div className="staff-app-scm-live-pass-head">
                      <div>
                        <strong>{shift.role}</strong>
                        <p>
                          {shift.startTime} - {shift.endTime}
                        </p>
                      </div>
                      <span className={`staff-app-scm-status-pill ${getToneClassName(
                        shift.requiresAttention
                          ? "danger"
                          : shift.shiftStatus === "upcoming"
                            ? "warn"
                            : shift.shiftStatus === "finished"
                              ? "neutral"
                              : "success",
                      )}`}>
                        {shift.shiftStatusLabel}
                      </span>
                    </div>

                    <div className="staff-app-scm-live-pass-inline-stats">
                      <span>{shift.onSiteCount}/{shift.plannedCount} on site</span>
                      <span>{shift.confirmedCount} confirmed</span>
                      <span>{shift.gapCount} missing</span>
                    </div>
                  </div>

                  <div className="staff-app-scm-live-pass-meta">
                    <span className="staff-app-scm-live-pass-count">
                      {staffingCopy.comingLabel}
                    </span>
                    <span className="staff-app-scm-live-pass-status">
                      {staffingCopy.statusLabel}
                    </span>
                    <span className="staff-app-scm-live-pass-link-copy">
                      Open team list
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="staff-app-scm-live-action-grid">
          <Link href={quickShiftPath} className="staff-app-button">
            Add or adjust staff
          </Link>
          <a href="#messages" className="staff-app-button secondary">
            Messages
          </a>
          <a href="#files" className="staff-app-button secondary">
            Files and uploads
          </a>
        </div>
      </div>

      <div className="staff-app-scm-live-metric-grid">
        <ScmLiveMetric
          label="Checked in"
          value={`${workspace.summary.checkedInCount}/${workspace.summary.plannedCount}`}
          copy="Current on-site staffing compared with planned headcount."
        />
        <ScmLiveMetric
          label="Full shifts"
          value={`${workspace.summary.fullShiftCount}/${workspace.summary.totalShiftCount}`}
          copy="Passes that are currently staffed to planned level."
        />
        <ScmLiveMetric
          label="Missing staff"
          value={`${missingStaffSummary.totalMissingStaff}`}
          copy={missingStaffSummary.copy}
        />
        <ScmLiveMetric
          label="Time report"
          value={`${remainingTimeReportCount}`}
          copy={`${workspace.summary.approvedTimeReportCount}/${workspace.summary.correctableTimeEntryCount} booked entries approved.`}
          href={timeReportPath}
        />
      </div>

      <div className="staff-app-card" id="roster">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Live roster</p>
            <h2>People status</h2>
          </div>
          <Link href={rosterTogglePath} className="staff-app-button secondary compact">
            {isRosterOpen ? "Hide roster" : "Open roster"}
          </Link>
        </div>

        {isRosterOpen ? (
          <div className="staff-app-scm-live-roster">
            {workspace.roster.length === 0 ? (
              <p className="staff-app-empty-state">No staffing records are linked to this gig yet.</p>
            ) : (
              workspace.roster.map((entry) => {
                const rosterStatusMeta = getLiveRosterStatusMeta(
                  entry,
                  workspace.gig.date,
                  stockholmNow,
                );

                return (
                  <article key={entry.id} className="staff-app-scm-live-roster-card">
                    <div className="staff-app-scm-live-roster-copy">
                      <div className="staff-app-scm-live-roster-head">
                        <div>
                          <strong>{entry.staffName}</strong>
                          <p>{entry.shiftRole}</p>
                        </div>
                        <span
                          className={`staff-app-scm-status-pill ${getToneClassName(
                            rosterStatusMeta.tone,
                          )}`}
                        >
                          {rosterStatusMeta.label}
                        </span>
                      </div>

                      <div className="staff-app-scm-live-inline-stats">
                        <span>{entry.staffPhone || entry.staffEmail || "No contact info"}</span>
                        <span>
                          {entry.shiftStartTime} - {entry.shiftEndTime}
                        </span>
                        {entry.workedTimeLabel ? <span>{entry.workedTimeLabel}</span> : null}
                      </div>
                    </div>

                    <div className="staff-app-scm-live-roster-actions">
                      {entry.bookingStatus === "Confirmed" &&
                      entry.status !== "checkedIn" &&
                      entry.status !== "checkedOut" ? (
                        <form action={updateScmGigRosterEntryAction}>
                          <input type="hidden" name="gigId" value={gigId} />
                          <input type="hidden" name="shiftId" value={entry.shiftId} />
                          <input type="hidden" name="staffId" value={entry.staffId} />
                          <input type="hidden" name="intent" value="checkInNow" />
                          <input type="hidden" name="returnTo" value={rosterReturnTo} />
                          <button type="submit" className="staff-app-button secondary compact">
                            Check in
                          </button>
                        </form>
                      ) : null}

                      {entry.bookingStatus === "Confirmed" && entry.status === "checkedIn" ? (
                        <form action={updateScmGigRosterEntryAction}>
                          <input type="hidden" name="gigId" value={gigId} />
                          <input type="hidden" name="shiftId" value={entry.shiftId} />
                          <input type="hidden" name="staffId" value={entry.staffId} />
                          <input type="hidden" name="intent" value="checkOutNow" />
                          <input type="hidden" name="returnTo" value={rosterReturnTo} />
                          <button type="submit" className="staff-app-button secondary compact">
                            Check out
                          </button>
                        </form>
                      ) : null}

                      <Link
                        href={`${livePath}/shifts/${entry.shiftId}`}
                        className="staff-app-button secondary compact"
                      >
                        Adjust
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <ScmLiveMessagesPanel
        gigId={gigId}
        livePath={livePath}
        activeComposer={activeMessageComposer}
        isRosterOpen={isRosterOpen}
        roster={workspace.roster}
        conversationThreads={conversationThreads ?? []}
      />

      <div className="staff-app-card" id="files">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Gig files</p>
            <h2>Platform-linked documents and uploads</h2>
          </div>
        </div>

        <div className="staff-app-scm-live-file-list">
          {workspace.files.length === 0 ? (
            <p className="staff-app-empty-state">No gig files have been uploaded yet.</p>
          ) : (
            workspace.files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                className="staff-app-scm-live-file-card"
                target="_blank"
                rel="noreferrer"
              >
                <strong>{file.fileName}</strong>
                <p>{file.folderName || (file.section === "reports" ? "Reports" : "Files")}</p>
                <span>
                  {formatFileSize(file.fileSize)} | {formatStaffAppTimestamp(file.uploadedAt)}
                </span>
              </a>
            ))
          )}
        </div>

        <div className="staff-app-scm-live-upload-grid">
          <form
            action={uploadScmGigFileAction}
            className="staff-app-scm-live-upload-card"
            encType="multipart/form-data"
          >
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="returnTo" value={livePath} />
            <input type="hidden" name="section" value="files" />
            <input type="hidden" name="folderName" value="General Files" />
            <strong>Upload gig document</strong>
            <p>Attach updated files from SCM Platform directly into the operational file flow.</p>
            <input type="file" name="file" accept=".pdf,.docx,.xlsx,.msg" required />
            <button type="submit" className="staff-app-button secondary compact">
              Upload file
            </button>
          </form>

          <form
            action={uploadScmGigFileAction}
            className="staff-app-scm-live-upload-card"
            encType="multipart/form-data"
          >
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="returnTo" value={livePath} />
            <input type="hidden" name="section" value="reports" />
            <input type="hidden" name="folderName" value="End-of-Day Report & Receipts" />
            <strong>Capture report or receipt</strong>
            <p>Use the phone camera for quick upload into the correct end-of-day report box.</p>
            <input type="file" name="file" accept="image/*" capture="environment" required />
            <button type="submit" className="staff-app-button secondary compact">
              Save photo
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
