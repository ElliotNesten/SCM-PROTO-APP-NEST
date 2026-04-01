"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  getRegionalManagerRegionSummary,
  getScmRoleDefinition,
  hasAllSwedenRegions,
  scmStaffManagedRoleOrder,
  type ScmStaffManagedRoleKey,
  type ScmStaffRoleKey,
  type StoredScmStaffProfile,
  swedenRegionOptions,
} from "@/types/scm-rbac";

const countryOptions = ["Sweden", "Norway", "Denmark", "Finland"] as const;

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function getRoleBadgeTone(roleKey: ScmStaffRoleKey) {
  if (roleKey === "superAdmin") {
    return "warn" as const;
  }

  if (roleKey === "regionalManager") {
    return "success" as const;
  }

  if (roleKey === "temporaryGigManager") {
    return "info" as const;
  }

  return "neutral" as const;
}

function formatRoleLabel(roleKey: ScmStaffRoleKey) {
  return getScmRoleDefinition(roleKey).label;
}

function formatCountryLabel(country: string) {
  return country === "Global" ? "Global scope" : country;
}

function formatRegionLabel(region: string) {
  return region;
}

function getScopeSubtitle(profile: StoredScmStaffProfile) {
  if (profile.roleKey === "superAdmin" || profile.roleKey === "officeStaff") {
    return getScmRoleDefinition(profile.roleKey).scopeLabel;
  }

  if (profile.roleKey === "regionalManager") {
    const scopeRegionLabel =
      profile.country === "Sweden"
        ? getRegionalManagerRegionSummary(profile.country, profile.regions)
        : "";

    return [profile.country, scopeRegionLabel].filter(Boolean).join(", ");
  }

  return getScmRoleDefinition(profile.roleKey).scopeLabel;
}

export function ScmStaffProfileEditor({
  initialProfile,
  backHref = "/scm-staff",
  backLabel = "Back to SCM Staff",
  allowDelete = false,
  canManageAdministrativeFields = true,
  canEditRole = true,
  initialStatusMessage = "",
}: {
  initialProfile: StoredScmStaffProfile;
  backHref?: string;
  backLabel?: string;
  allowDelete?: boolean;
  canManageAdministrativeFields?: boolean;
  canEditRole?: boolean;
  initialStatusMessage?: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState(initialStatusMessage);
  const [passwordDraft, setPasswordDraft] = useState(
    initialProfile.passwordPlaintext ?? "",
  );
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [regionDraft, setRegionDraft] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const roleDefinition = getScmRoleDefinition(profile.roleKey);
  const isRegionalManager = profile.roleKey === "regionalManager";
  const usesScopedAccess = isRegionalManager;
  const showsSwedenRegions = isRegionalManager && profile.country === "Sweden";

  const availableRegionOptions = useMemo(
    () => dedupeStrings([...swedenRegionOptions, ...profile.regions]),
    [profile.regions],
  );

  function updateField<Key extends keyof StoredScmStaffProfile>(
    key: Key,
    value: StoredScmStaffProfile[Key],
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateRole(nextRoleKey: ScmStaffManagedRoleKey) {
    setProfile((current) => ({
      ...current,
      roleKey: nextRoleKey,
      country:
        nextRoleKey === "regionalManager"
          ? current.country === "Global"
            ? "Sweden"
            : current.country
          : "Global",
      regions:
        nextRoleKey === "regionalManager"
          ? current.country === "Sweden"
            ? current.regions
            : []
          : [],
    }));
    setSaveMessage("");
  }

  function updateRegionalCountry(nextCountry: string) {
    setProfile((current) => ({
      ...current,
      country: nextCountry,
      regions: nextCountry === "Sweden" ? current.regions : [],
    }));
    setRegionDraft("");
    setSaveMessage("");
  }

  function updateRegions(nextRegions: string[]) {
    setProfile((current) => ({
      ...current,
      regions: dedupeStrings(nextRegions),
    }));
  }

  function toggleRegion(region: string) {
    if (profile.regions.includes(region)) {
      updateRegions(profile.regions.filter((currentRegion) => currentRegion !== region));
      return;
    }

    updateRegions([...profile.regions, region]);
  }

  function addCustomRegion() {
    if (!regionDraft.trim()) {
      return;
    }

    updateRegions([...profile.regions, regionDraft]);
    setRegionDraft("");
  }

  function selectAllSwedenRegions() {
    updateRegions([...swedenRegionOptions]);
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMessage("");

    const nextCountry =
      profile.roleKey === "regionalManager" ? profile.country : "Global";
    const nextRegions = profile.roleKey === "regionalManager" ? profile.regions : [];

    const response = await fetch(`/api/scm-staff/${profile.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: profile.displayName.trim(),
        email: profile.email.trim(),
        password: passwordDraft,
        phone: profile.phone.trim(),
        roleKey: canEditRole ? profile.roleKey : undefined,
        country: nextCountry,
        regions: nextRegions,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { profile?: StoredScmStaffProfile; error?: string }
      | null;

    if (response.ok && payload?.profile) {
      setProfile(payload.profile);
      setPasswordDraft(payload.profile.passwordPlaintext ?? "");
      setSaveMessage("SCM staff profile saved.");
      router.refresh();
    } else {
      setSaveMessage(payload?.error ?? "Could not save SCM staff profile.");
    }

    setSaving(false);
  }

  async function uploadProfileImage() {
    const selectedImage = imageInputRef.current?.files?.[0] ?? null;

    if (!selectedImage) {
      setSaveMessage("Choose a profile image first.");
      return;
    }

    setUploadingImage(true);
    setSaveMessage("");

    const formData = new FormData();
    formData.append("image", selectedImage);

    const response = await fetch(`/api/scm-staff/${profile.id}/image`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { profileImageName?: string; profileImageUrl?: string; error?: string }
      | null;

    if (response.ok && payload?.profileImageName && payload?.profileImageUrl) {
      setProfile((current) => ({
        ...current,
        profileImageName: payload.profileImageName ?? current.profileImageName,
        profileImageUrl: payload.profileImageUrl ?? current.profileImageUrl,
      }));
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      setSaveMessage("SCM staff profile image updated.");
      router.refresh();
    } else {
      setSaveMessage(payload?.error ?? "Could not upload SCM staff profile image.");
    }

    setUploadingImage(false);
  }

  async function deleteProfile() {
    setDeleting(true);
    setSaveMessage("");

    try {
      const response = await fetch(`/api/scm-staff/${profile.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setSaveMessage(payload?.error ?? "Could not delete SCM staff profile.");
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      router.push("/scm-staff");
      router.refresh();
    } catch {
      setSaveMessage("Could not delete SCM staff profile.");
      setDeleting(false);
    }
  }

  return (
    <div className="staff-profile-editor">
      <PageHeader
        title={profile.displayName}
        subtitle={getScopeSubtitle(profile)}
        leading={
          <div className="staff-profile-header-image">
            <div className="staff-profile-header-image-preview" aria-hidden="true">
              {profile.profileImageUrl ? (
                <Image
                  src={profile.profileImageUrl}
                  alt={`${profile.displayName} profile`}
                  className="staff-profile-header-image-media"
                  width={108}
                  height={108}
                />
              ) : (
                getDisplayInitials(profile.displayName)
              )}
            </div>
            <label
              className="staff-profile-header-image-trigger"
              htmlFor={`scm-staff-image-${profile.id}`}
            >
              {uploadingImage ? "Uploading..." : "Change image"}
            </label>
            <input
              id={`scm-staff-image-${profile.id}`}
              ref={imageInputRef}
              className="gig-image-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={() => {
                void uploadProfileImage();
              }}
            />
          </div>
        }
        actions={
          <Link href={backHref} className="button ghost">
            {backLabel}
          </Link>
        }
        eyebrow=""
      />

      <section className="content-grid">
        <div className="stack-column">
          <div className="card staff-profile-compact-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">SCM Staff</p>
                <h2>Role assignment</h2>
              </div>
              <div className="staff-profile-status-actions">
                <StatusBadge
                  label={roleDefinition.label}
                  tone={getRoleBadgeTone(profile.roleKey)}
                />
                {allowDelete && canManageAdministrativeFields ? (
                  <button
                    type="button"
                    className="button ghost danger-outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting}
                  >
                    Delete profile
                  </button>
                ) : null}
              </div>
            </div>

            <div className="key-value-grid staff-profile-compact-grid">
              <label className="key-value-card key-value-card-editable">
                <small>Name</small>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(event) => updateField("displayName", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Email</small>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => updateField("email", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Phone</small>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(event) => updateField("phone", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Login password</small>
                <div className="password-field-row">
                  <input
                    type={showPasswordDraft ? "text" : "password"}
                    value={passwordDraft}
                    placeholder="Leave blank to keep the current password"
                    onChange={(event) => setPasswordDraft(event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="button ghost password-visibility-button"
                    onClick={() => setShowPasswordDraft((current) => !current)}
                  >
                    {showPasswordDraft ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Role</small>
                <select
                  value={profile.roleKey}
                  disabled={!canEditRole}
                  onChange={(event) =>
                    updateRole(event.currentTarget.value as ScmStaffManagedRoleKey)
                  }
                >
                  {scmStaffManagedRoleOrder.map((roleKey) => (
                    <option key={roleKey} value={roleKey}>
                      {formatRoleLabel(roleKey)}
                    </option>
                  ))}
                </select>
              </label>

              {isRegionalManager ? (
                <>
                  <label className="key-value-card key-value-card-editable">
                    <small>Country</small>
                    <select
                      value={profile.country}
                      disabled={!canManageAdministrativeFields}
                      onChange={(event) => updateRegionalCountry(event.currentTarget.value)}
                    >
                      {countryOptions.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>

                  {showsSwedenRegions ? (
                    <div className="key-value-card key-value-card-editable staff-profile-regions-card">
                      <small>Regions</small>
                      <div className="staff-profile-region-grid">
                        <button
                          type="button"
                          className={`staff-profile-region-chip${
                            hasAllSwedenRegions(profile.regions) ? " active" : ""
                          }`}
                          disabled={!canManageAdministrativeFields}
                          onClick={selectAllSwedenRegions}
                        >
                          All regions
                        </button>
                        {availableRegionOptions.map((region) => {
                          const isActive = profile.regions.includes(region);

                          return (
                            <button
                              key={region}
                              type="button"
                              className={`staff-profile-region-chip${isActive ? " active" : ""}`}
                              disabled={!canManageAdministrativeFields}
                              onClick={() => toggleRegion(region)}
                            >
                              {formatRegionLabel(region)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="staff-profile-region-add">
                        <input
                          type="text"
                          placeholder="Add region"
                          value={regionDraft}
                          disabled={!canManageAdministrativeFields}
                          onChange={(event) => setRegionDraft(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addCustomRegion();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="button ghost"
                          onClick={addCustomRegion}
                          disabled={!canManageAdministrativeFields}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {!usesScopedAccess ? (
                <div className="key-value-card full-width-column">
                  <small>Scope</small>
                  <p className="muted">
                    {roleDefinition.label} has {formatCountryLabel(profile.country).toLowerCase()}{" "}
                    access and can work across the entire platform.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="overview-editor-actions staff-profile-actions">
              <p className="muted">{saveMessage}</p>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
            </div>
          </div>
        </div>

        <div className="stack-column">
          <div className="card">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Permissions</p>
                <h3>{roleDefinition.label}</h3>
              </div>
              <span className="helper-caption">{roleDefinition.scopeLabel}</span>
            </div>
            <p className="page-subtitle">{roleDefinition.description}</p>

            <div className="staff-profile-role-grid">
              <div className="key-value-card scm-staff-permission-card">
                <small>Can manage</small>
                <ul className="scm-staff-permission-list">
                  {roleDefinition.permissions.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </div>

              <div className="key-value-card scm-staff-permission-card">
                <small>Restrictions</small>
                {roleDefinition.restrictions.length > 0 ? (
                  <ul className="scm-staff-permission-list">
                    {roleDefinition.restrictions.map((restriction) => (
                      <li key={restriction}>{restriction}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No additional restrictions for this role.</p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Scope</p>
                <h3>Assigned coverage</h3>
              </div>
            </div>

            {profile.roleKey === "regionalManager" ? (
              <div className="key-value-card">
                <strong>{profile.country}</strong>
                <p className="muted">
                  {profile.country !== "Sweden"
                    ? "No regions required for this country."
                    : hasAllSwedenRegions(profile.regions)
                      ? "All regions"
                      : profile.regions.length > 0
                    ? profile.regions.map(formatRegionLabel).join(", ")
                    : "No regions selected yet."}
                </p>
              </div>
            ) : (
              <div className="key-value-card">
                <strong>{roleDefinition.scopeLabel}</strong>
                <p className="muted">
                  This role is not restricted to a specific country, region, or gig.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {showDeleteConfirm ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-scm-staff-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Delete profile</p>
                <h2 id="delete-scm-staff-title">Permanent removal</h2>
                <p className="page-subtitle">
                  Are you sure you want to permanently delete this SCM Staff profile?
                </p>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    void deleteProfile();
                  }}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
