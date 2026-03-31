import Link from "next/link";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { StaffApplicationReviewPanel } from "@/components/staff-application-review-panel";
import { StaffRegionEditFilter } from "@/components/staff-region-edit-filter";
import { StatusBadge } from "@/components/status-badge";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { canAccessPlatformStaffDirectory } from "@/lib/platform-access";
import { getAllStoredStaffApplications } from "@/lib/staff-application-store";
import {
  getAllStoredStaffProfiles,
  getArchivedStaffDocuments,
} from "@/lib/staff-store";

type PeoplePageProps = {
  searchParams: Promise<{
    status?: string | string[];
    country?: string | string[];
    region?: string | string[];
    archiveView?: string | string[];
    countryMenu?: string | string[];
    review?: string | string[];
  }>;
};

const filters = ["All", "Approved", "Applicant", "Archived"] as const;
const countryFilters = ["All", "Sweden", "Norway", "Denmark"] as const;
const archiveViews = ["Archived staff", "Old staff documents"] as const;
const visibleStatusFilters = filters.filter((filter) => filter !== "All");
const swedenQuickRegionFilters = [
  { label: "Stockholm", value: "Stockholm" },
  { label: "Göteborg", value: "Gothenburg" },
  { label: "Malmö", value: "Malmo" },
] as const;

function normalizeRegionList(regions: string[], fallbackRegion: string) {
  const normalized = Array.from(
    new Set(
      (regions.length > 0 ? regions : [fallbackRegion])
        .map((region) => region.trim())
        .filter(Boolean),
    ),
  );

  return normalized;
}

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getCountryFlag(country: string) {
  if (country === "Sweden") {
    return "🇸🇪";
  }

  if (country === "Norway") {
    return "🇳🇴";
  }

  if (country === "Denmark") {
    return "🇩🇰";
  }

  return "";
}

function resolveFilter(
  value: string | string[] | undefined,
): (typeof filters)[number] {
  const candidate = Array.isArray(value) ? value[0] : value;
  return filters.includes(candidate as (typeof filters)[number])
    ? (candidate as (typeof filters)[number])
    : "All";
}

function resolveCountryFilter(
  value: string | string[] | undefined,
): (typeof countryFilters)[number] {
  const candidate = Array.isArray(value) ? value[0] : value;
  return countryFilters.includes(candidate as (typeof countryFilters)[number])
    ? (candidate as (typeof countryFilters)[number])
    : "All";
}

function resolveArchiveView(
  value: string | string[] | undefined,
): (typeof archiveViews)[number] {
  const candidate = Array.isArray(value) ? value[0] : value;
  return archiveViews.includes(candidate as (typeof archiveViews)[number])
    ? (candidate as (typeof archiveViews)[number])
    : "Archived staff";
}

function resolveRegionFilter(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() ?? "";
}

function resolveCountryMenuOpen(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "open";
}

function buildPeopleHref(
  status: (typeof filters)[number],
  country: (typeof countryFilters)[number],
  archiveView?: (typeof archiveViews)[number],
  region?: string,
  countryMenuOpen?: boolean,
) {
  const params = new URLSearchParams();

  if (status !== "All") {
    params.set("status", status);
  }

  if (country !== "All") {
    params.set("country", country);
  }

  if (country === "Sweden" && region) {
    params.set("region", region);
  }

  if (status === "Archived" && archiveView && archiveView !== "Archived staff") {
    params.set("archiveView", archiveView);
  }

  if (countryMenuOpen) {
    params.set("countryMenu", "open");
  }

  const query = params.toString();
  return query ? `/people?${query}` : "/people";
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  noStore();
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessPlatformStaffDirectory(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  const { status, country, region, archiveView, countryMenu, review } = await searchParams;
  const [peopleDirectory, archivedDocuments, applications] = await Promise.all([
    getAllStoredStaffProfiles(),
    getArchivedStaffDocuments(),
    getAllStoredStaffApplications(),
  ]);
  const activeFilter = resolveFilter(status);
  const activeCountry = resolveCountryFilter(country);
  const activeRegion = resolveRegionFilter(region);
  const activeArchiveView = resolveArchiveView(archiveView);
  const isCountryMenuOpen =
    activeCountry !== "All" || resolveCountryMenuOpen(countryMenu);
  const matchesCountryFilter = (countryValue: string) =>
    activeCountry === "All" ? true : countryValue === activeCountry;
  const matchesRegionFilter = (regions: string[], fallbackRegion: string) =>
    activeCountry === "Sweden" && activeRegion
      ? normalizeRegionList(regions, fallbackRegion).includes(activeRegion)
      : true;
  const availableSwedenRegions = Array.from(
    new Set(
      peopleDirectory
        .filter((person) => person.country === "Sweden")
        .flatMap((person) => normalizeRegionList(person.regions, person.region)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const statsScopedPeople = peopleDirectory.filter(
    (person) =>
      matchesCountryFilter(person.country) &&
      matchesRegionFilter(person.regions, person.region),
  );
  const approvedCount = statsScopedPeople.filter(
    (person) => person.approvalStatus === "Approved",
  ).length;
  const applicantCount = statsScopedPeople.filter(
    (person) => person.approvalStatus === "Applicant",
  ).length;
  const filteredPeople = peopleDirectory.filter((person) => {
    const matchesStatus =
      activeFilter === "All" ? true : person.approvalStatus === activeFilter;
    const matchesCountry = matchesCountryFilter(person.country);
    const matchesRegion = matchesRegionFilter(person.regions, person.region);

    return matchesStatus && matchesCountry && matchesRegion;
  });
  const filteredArchivedDocuments = archivedDocuments.filter((document) => {
    const matchesCountry =
      activeCountry === "All" ? true : document.sourceCountry === activeCountry;
    const matchesRegion =
      activeCountry === "Sweden" && activeRegion
        ? document.sourceRegion === activeRegion
        : true;

    return matchesCountry && matchesRegion;
  });

  return (
    <div className="staff-directory-page">
      <PageHeader
        title="Staff"
        subtitle="Registry and profile area for field staff and applicants."
        actions={
          <div className="page-actions">
            <Link href="/people/new" className="button">
              New Staff
            </Link>
          </div>
        }
      />

      <div className="staff-top-layout">
        <section className="card staff-top-filter-card">
          <div className="staff-filter-stack">
            <div className="chip-row staff-filter-row">
              {visibleStatusFilters.map((filter) => {
                return (
                  <Link
                    key={filter}
                    href={buildPeopleHref(
                      filter,
                      activeCountry,
                      filter === "Archived" ? activeArchiveView : undefined,
                      activeCountry === "Sweden" ? activeRegion : "",
                      isCountryMenuOpen,
                    )}
                    className={`chip ${filter === "Applicant" ? "staff-status-chip-applicant" : ""} ${activeFilter === filter ? "active" : ""}`}
                  >
                    {filter}
                    {filter === "Applicant" ? (
                      <span
                        className={`staff-filter-badge ${activeFilter === filter ? "active" : ""} ${applicantCount > 0 ? "visible" : "hidden"}`}
                        aria-hidden={applicantCount > 0 ? undefined : true}
                      >
                        {applicantCount > 0 ? applicantCount : ""}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <div className="chip-row staff-filter-row">
              <Link
                href={buildPeopleHref(
                  activeFilter,
                  "All",
                  activeArchiveView,
                  "",
                  activeCountry === "All" ? !isCountryMenuOpen : true,
                )}
                className={`chip chip-soft ${isCountryMenuOpen ? "active" : ""}`}
              >
                Country
              </Link>
            </div>
            {isCountryMenuOpen ? (
              <div className="chip-row staff-filter-row">
                {countryFilters
                  .filter((filter) => filter !== "All")
                  .map((filter) => (
                    <Link
                      key={filter}
                      href={buildPeopleHref(
                        activeFilter,
                        filter,
                        activeArchiveView,
                        filter === "Sweden" ? activeRegion : "",
                        true,
                      )}
                      className={`chip chip-soft ${activeCountry === filter ? "active" : ""}`}
                    >
                      {filter}
                    </Link>
                  ))}
              </div>
            ) : null}
            {activeCountry === "Sweden" ? (
              <div className="chip-row staff-filter-row">
                {swedenQuickRegionFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={buildPeopleHref(
                      activeFilter,
                      activeCountry,
                      activeArchiveView,
                      filter.value,
                      true,
                    )}
                    className={`chip chip-soft ${activeRegion === filter.value ? "active" : ""}`}
                  >
                    {filter.label}
                  </Link>
                ))}
                <StaffRegionEditFilter
                  options={availableSwedenRegions}
                  activeRegion={activeRegion}
                />
              </div>
            ) : null}
            {activeFilter === "Archived" ? (
              <div className="chip-row staff-filter-row">
                {archiveViews.map((view) => (
                  <Link
                    key={view}
                    href={buildPeopleHref(
                      activeFilter,
                      activeCountry,
                      view,
                      activeCountry === "Sweden" ? activeRegion : "",
                      isCountryMenuOpen,
                    )}
                    className={`chip chip-soft ${activeArchiveView === view ? "active" : ""}`}
                  >
                    {view}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="card staff-top-stats-card">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">Profile stats</p>
              <h3>Registered profiles</h3>
            </div>
            <span className="helper-caption">{statsScopedPeople.length} profiles</span>
          </div>
          <div className="staff-top-stats-grid">
            <div className="staff-top-stat-card">
              <small>Approved profiles</small>
              <strong>{approvedCount}</strong>
            </div>
            <div className="staff-top-stat-card">
              <small>Applicant profiles</small>
              <strong>{applicantCount}</strong>
            </div>
          </div>
        </section>
      </div>

      <StaffApplicationReviewPanel
        applications={applications}
        reviewCode={Array.isArray(review) ? review[0] : review}
      />

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Registry</p>
            <h2>{activeFilter === "Archived" && activeArchiveView === "Old staff documents" ? "Old staff documents" : "Staff list"}</h2>
          </div>
          <span className="helper-caption">
            {activeFilter === "Archived" && activeArchiveView === "Old staff documents"
              ? `${filteredArchivedDocuments.length} records`
              : `${filteredPeople.length} records`}
          </span>
        </div>

        <div className="list-stack">
          {activeFilter === "Archived" && activeArchiveView === "Old staff documents" ? (
            filteredArchivedDocuments.length === 0 ? (
              <div className="empty-panel">No old staff documents have been archived yet.</div>
            ) : (
              filteredArchivedDocuments.map((document) => (
                <div key={document.archivedId} className="list-row">
                  <div>
                    <strong>{document.fileName}</strong>
                    <p className="muted">
                      {document.sourceDisplayName} | {document.sourceRegion}, {document.sourceCountry}
                    </p>
                    <p className="muted small-text">
                      {document.fileType} | {(document.fileSize / 1024).toFixed(0)} KB | Archived{" "}
                      {new Date(document.archivedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <StatusBadge label="Archived" tone="neutral" />
                </div>
              ))
            )
          ) : (
            filteredPeople.length === 0 ? (
              <div className="empty-panel">No staff match the current filters.</div>
            ) : (
              <div className="staff-list-grid">
                {filteredPeople.map((person) => (
                  <Link
                    key={person.id}
                    href={`/people/${person.id}`}
                    className="staff-grid-card"
                  >
                    <div className="staff-list-avatar" aria-hidden="true">
                      {person.profileImageUrl ? (
                        <Image
                          src={person.profileImageUrl}
                          alt=""
                          className="staff-list-avatar-img"
                          width={72}
                          height={72}
                        />
                      ) : (
                        getDisplayInitials(person.displayName)
                      )}
                    </div>
                    <div className="staff-grid-card-body">
                      <div className="staff-list-name-row">
                        <strong>{person.displayName}</strong>
                        {activeCountry === "All" && getCountryFlag(person.country) ? (
                          <span className="staff-list-flag" aria-label={person.country}>
                            {getCountryFlag(person.country)}
                          </span>
                        ) : null}
                      </div>
                      <p className="muted">
                        {person.region}, {person.country}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
