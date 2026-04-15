"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ProfileImage } from "@/components/profile-image";
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
  canEditBasicFields = true,
  canManageAdministrativeFields = true,
  canEditRole = true,
  canEditProfileImage = true,
  canChangePassword = false,
  canViewStoredPassword = false,
  canRevealStoredPassword = false,
  requiresCurrentPassword = false,
  initialStatusMessage = "",
}: {
  initialProfile: StoredScmStaffProfile;
  backHref?: string;
  backLabel?: string;
  allowDelete?: boolean;
  canEditBasicFields?: boolean;
  canManageAdministrativeFields?: boolean;
  canEditRole?: boolean;
  canEditProfileImage?: boolean;
  canChangePassword?: boolean;
  canViewStoredPassword?: boolean;
  canRevealStoredPassword?: boolean;
  requiresCurrentPassword?: boolean;
  initialStatusMessage?: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState(initialStatusMessage);
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState(
    canRevealStoredPassword ? (initialProfile.passwordPlaintext ?? "") : "",
  );
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("");
  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [regionDraft, setRegionDraft] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    router.prefetch(backHref);
    router.prefetch("/scm-staff");
  }, [backHref, router]);

  const roleDefinition = getScmRoleDefinition(profile.roleKey);
  const isRegionalManager = profile.roleKey === "regionalManager";
  const usesScopedAccess = isRegionalManager;
  const showsSwedenRegions = isRegionalManager && profile.country === "Sweden";
  const canEditPassword = canRevealStoredPassword || canChangePassword;
  const canSaveProfile =
    canEditBasicFields || canManageAdministrativeFields || canEditRole || canEditPassword;
  const canViewStoredPasswordReference = canViewStoredPassword && !canRevealStoredPassword;
  const passwordFieldLabel = canRevealStoredPassword
    ? "Password"
    : canViewStoredPasswordReference
      ? "Password"
    : requiresCurrentPassword
      ? "Change password"
      : "Password";
  const passwordFieldPlaceholder = canRevealStoredPassword
    ? "Leave blank to keep the current password"
    : requiresCurrentPassword
      ? "New password"
      : "Enter a new password to replace the current one";

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
    if (!canSaveProfile) {
      setSaveMessage("You can only edit your own SCM Staff profile.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const nextCountry =
      profile.roleKey === "regionalManager" ? profile.country : "Global";
    const nextRegions = profile.roleKey === "regionalManager" ? profile.regions : [];
    const trimmedCurrentPasswordDraft = currentPasswordDraft.trim();
    const trimmedPasswordDraft = passwordDraft.trim();
    const trimmedConfirmPasswordDraft = confirmPasswordDraft.trim();
    const currentStoredPassword = profile.passwordPlaintext?.trim() ?? "";
    const touchedSelfServicePasswordFields =
      trimmedCurrentPasswordDraft.length > 0 ||
      trimmedPasswordDraft.length > 0 ||
      trimmedConfirmPasswordDraft.length > 0;
    let nextPassword = "";

    if (canRevealStoredPassword) {
      if (
        trimmedPasswordDraft.length > 0 &&
        trimmedPasswordDraft !== currentStoredPassword
      ) {
        if (trimmedPasswordDraft.length < 8) {
          setSaveMessage("SCM Staff password must be at least 8 characters long.");
          setSaving(false);
          return;
        }

        nextPassword = trimmedPasswordDraft;
      }
    } else if (canChangePassword && touchedSelfServicePasswordFields) {
      if (
        !trimmedCurrentPasswordDraft ||
        !trimmedPasswordDraft ||
        !trimmedConfirmPasswordDraft
      ) {
        setSaveMessage(
          "Enter your current password, your new password, and confirm it before saving.",
        );
        setSaving(false);
        return;
      }

      if (trimmedPasswordDraft.length < 8) {
        setSaveMessage("SCM Staff password must be at least 8 characters long.");
        setSaving(false);
        return;
      }

      if (trimmedPasswordDraft !== trimmedConfirmPasswordDraft) {
        setSaveMessage("The new password confirmation does not match.");
        setSaving(false);
        return;
      }

      nextPassword = trimmedPasswordDraft;
    }

    const response = await fetch(`/api/scm-staff/${profile.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: canEditBasicFields ? profile.firstName.trim() : undefined,
        lastName: canEditBasicFields ? profile.lastName.trim() : undefined,
        email: canEditBasicFields ? profile.email.trim() : undefined,
        currentPassword: requiresCurrentPassword ? trimmedCurrentPasswordDraft : undefined,
        password: nextPassword,
        phone: canEditBasicFields ? profile.phone.trim() : undefined,
        roleKey: canEditRole ? profile.roleKey : undefined,
        country: canManageAdministrativeFields ? nextCountry : undefined,
        regions: canManageAdministrativeFields ? nextRegions : undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { profile?: StoredScmStaffProfile; error?: string }
      | null;

    if (response.ok && payload?.profile) {
      setProfile(payload.profile);
      setCurrentPasswordDraft("");
      setPasswordDraft(
        canRevealStoredPassword ? (payload.profile.passwordPlaintext ?? "") : "",
      );
      setConfirmPasswordDraft("");
      setShowPasswordDraft(false);
      setSaveMessage("SCM staff profile saved.");
    } else {
      setSaveMessage(payload?.error ?? "Could not save SCM staff profile.");
    }

    setSaving(false);
  }

  async function uploadProfileImage() {
    if (!canEditProfileImage) {
      setSaveMessage("You can only change your own SCM Staff profile image.");
      return;
    }

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
    } catch {
      setSaveMessage("Could not delete SCM staff profile.");
      setDeleting(false);
    }
  }

  return (
    <div className="staff-profile-editor">
      <PageHeader
        title={`${profile.firstName} ${profile.lastName}`}
        subtitle={getScopeSubtitle(profile)}
        leading={
          <div className="staff-profile-header-image">
            <div className="staff-profile-header-image-preview">
              <ProfileImage
                fullName={`${profile.firstName} ${profile.lastName}`}
                imageUrl={profile.profileImageUrl}
                alt={`${profile.firstName} ${profile.lastName} profile`}
                className="staff-profile-header-image-media"
                fallbackText={getDisplayInitials(`${profile.firstName} ${profile.lastName}`)}
                loading="eager"
              />
              {canEditProfileImage ? (
                <label
                  className="staff-profile-header-image-trigger"
                  htmlFor={`scm-staff-image-${profile.id}`}
                >
                  {uploadingImage ? "UPLOADING" : "EDIT"}
                </label>
              ) : null}
            </div>
            {canEditProfileImage ? (
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
            ) : null}
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
                <h2>Account details</h2>
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
                <small>First name</small>
                <input
                  type="text"
                  value={profile.firstName}
                  disabled={!canEditBasicFields}
                  onChange={(event) => updateField("firstName", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Last name</small>
                <input
                  type="text"
                  value={profile.lastName}
                  disabled={!canEditBasicFields}
                  onChange={(event) => updateField("lastName", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Email</small>
                <input
                  type="email"
                  value={profile.email}
                  disabled={!canEditBasicFields}
                  onChange={(event) => updateField("email", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Phone</small>
                <input
                  type="text"
                  value={profile.phone}
                  disabled={!canEditBasicFields}
                  onChange={(event) => updateField("phone", event.currentTarget.value)}
                />
              </label>

              <div className="key-value-card key-value-card-editable">
                <small>{passwordFieldLabel}</small>
                {canRevealStoredPassword ? (
                  <div className="password-field-row">
                    <input
                      type={showPasswordDraft ? "text" : "password"}
                      value={passwordDraft}
                      placeholder={passwordFieldPlaceholder}
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
                ) : canChangePassword && requiresCurrentPassword ? (
                  <div className="password-field-stack">
                    {canViewStoredPasswordReference ? (
                      <div className="password-field-row">
                        <input
                          type={showStoredPassword ? "text" : "password"}
                          value={profile.passwordPlaintext ?? ""}
                          placeholder="Saved password is not available yet"
                          readOnly
                        />
                        <button
                          type="button"
                          className="button ghost password-visibility-button"
                          onClick={() => setShowStoredPassword((current) => !current)}
                          disabled={!profile.passwordPlaintext?.trim()}
                        >
                          {showStoredPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    ) : null}
                    <input
                      type={showPasswordDraft ? "text" : "password"}
                      value={currentPasswordDraft}
                      placeholder="Current password"
                      onChange={(event) => setCurrentPasswordDraft(event.currentTarget.value)}
                    />
                    <div className="password-field-row">
                      <input
                        type={showPasswordDraft ? "text" : "password"}
                        value={passwordDraft}
                        placeholder={passwordFieldPlaceholder}
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
                    <input
                      type={showPasswordDraft ? "text" : "password"}
                      value={confirmPasswordDraft}
                      placeholder="Confirm new password"
                      onChange={(event) => setConfirmPasswordDraft(event.currentTarget.value)}
                    />
                  </div>
                ) : canEditPassword ? (
                  <div className="password-field-row">
                    <input
                      type={showPasswordDraft ? "text" : "password"}
                      value={passwordDraft}
                      placeholder={passwordFieldPlaceholder}
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
                ) : (
                  <p className="muted small-text">
                    Only Super Admin can view or reset another SCM Staff password.
                  </p>
                )}
                {canViewStoredPassword && !profile.passwordPlaintext?.trim() ? (
                  <p className="muted small-text">
                    The current password is not stored yet. Save a new password here, or log in
                    once more to register it.
                  </p>
                ) : null}
                {canChangePassword && requiresCurrentPassword ? (
                  <p className="muted small-text">
                    Change your own login password here. Enter your current password and choose a
                    new one with at least 8 characters.
                  </p>
                ) : null}
                {!canRevealStoredPassword && canEditPassword && !requiresCurrentPassword ? (
                  <p className="muted small-text">
                    The current registered password is hidden for your role. Enter a new one to
                    replace it.
                  </p>
                ) : null}
              </div>

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
              <p className="muted">
                {saveMessage ||
                  (!canSaveProfile
                    ? "This SCM Staff profile is read-only for your role."
                    : "")}
              </p>
              {canSaveProfile ? (
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
              ) : null}
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
                <h3>Access area</h3>
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
