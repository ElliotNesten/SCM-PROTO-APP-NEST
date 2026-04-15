"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { StaffDocumentsPanel } from "@/components/staff-documents-panel";
import { PageHeader } from "@/components/page-header";
import { ProfileImage } from "@/components/profile-image";
import {
  formatHourlyRateLabel,
  getStandardHourlyRate,
  resolveEffectiveHourlyRate,
  sanitizeHourlyRateOverride,
  sanitizeRoleProfileHourlyRateOverrides,
} from "@/lib/compensation";
import { StatusBadge } from "@/components/status-badge";
import type { StoredStaffProfile } from "@/lib/staff-store";
import type { StaffAppRoleScope } from "@/types/staff-app";
import {
  compensationCountries,
  type SystemCompensationSettings,
} from "@/types/compensation";
import type { StoredStaffDocument } from "@/types/staff-documents";
import { staffRoleKeys, type StaffRoleKey } from "@/types/staff-role";

const countryOptions = compensationCountries;

const swedenRegionOptions = ["Stockholm", "Gothenburg", "Malmo"] as const;
const autoSaveDelayMs = 300;
const archivedPeopleHref = "/people?status=Archived&archiveView=Old%20staff%20documents";

type RoleHourlyRateChange = {
  roleKey: StaffRoleKey;
  previousLabel: string;
  nextLabel: string;
};

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function formatRoleScopeLabel(roleKey: StaffRoleKey) {
  return roleKey;
}

export function StaffProfileEditor({
  initialProfile,
  initialDocuments,
  compensationSettings,
  linkedStaffAppAccount,
  showExtendedCards = true,
}: {
  initialProfile: StoredStaffProfile;
  initialDocuments: StoredStaffDocument[];
  compensationSettings: SystemCompensationSettings;
  linkedStaffAppAccount: {
    roleScopes: StaffAppRoleScope[];
  } | null;
  showExtendedCards?: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHourlyRateConfirm, setShowHourlyRateConfirm] = useState(false);
  const [pendingHourlyRateChanges, setPendingHourlyRateChanges] = useState<
    RoleHourlyRateChange[]
  >([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [regionDraft, setRegionDraft] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const regionInputRef = useRef<HTMLInputElement | null>(null);
  const allergiesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hourlyRateInputRefs = useRef<Partial<Record<StaffRoleKey, HTMLInputElement | null>>>(
    {},
  );
  const latestProfileSaveSignatureRef = useRef("");
  const employeeProfileCardRef = useRef<HTMLDivElement | null>(null);
  const [rolesCardHeight, setRolesCardHeight] = useState<number | null>(null);
  const [showRegionInput, setShowRegionInput] = useState(false);
  const [showAllergiesField, setShowAllergiesField] = useState(false);
  const [openRoleComments, setOpenRoleComments] = useState<
    Partial<Record<StaffRoleKey, boolean>>
  >({});
  const [approvedHourlyRateEditors, setApprovedHourlyRateEditors] = useState<
    Partial<Record<StaffRoleKey, boolean>>
  >({});
  const [blockedAutoSaveSignature, setBlockedAutoSaveSignature] = useState<string | null>(null);
  const [pendingHourlyRateEditorRole, setPendingHourlyRateEditorRole] =
    useState<StaffRoleKey | null>(null);
  const isSwedenProfile = profile.country === "Sweden";

  useEffect(() => {
    router.prefetch("/people");
    router.prefetch(archivedPeopleHref);
  }, [router]);

  const regionOptions = useMemo(
    () =>
      dedupeStrings([
        ...(isSwedenProfile ? [...swedenRegionOptions] : []),
        ...profile.regions,
        profile.region,
      ]),
    [isSwedenProfile, profile.region, profile.regions],
  );

  const liveStaffAppScope = useMemo(() => {
    const enabledRoleScopes = [] as StaffAppRoleScope[];
    const enabledMobileRoles = enabledRoleScopes.map((scope) => scope.role);
    const scopeLevel =
      enabledRoleScopes[0]?.level ?? Math.min(5, Math.max(1, profile.priority));
    return {
      roleScopes: enabledRoleScopes,
      label:
        enabledMobileRoles.length > 0
          ? `${enabledMobileRoles.join(" / ")} · Level ${scopeLevel}`
          : `No mobile pass access · Level ${scopeLevel}`,
    };
  }, [profile.priority, profile.roleProfiles]);
  void liveStaffAppScope;

  useEffect(() => {
    if (!showExtendedCards) {
      setRolesCardHeight(null);
      return;
    }

    const employeeProfileCard = employeeProfileCardRef.current;

    if (!employeeProfileCard || typeof window === "undefined") {
      return;
    }

    const syncRolesCardHeight = () => {
      if (window.innerWidth <= 960) {
        setRolesCardHeight(null);
        return;
      }

      setRolesCardHeight(Math.ceil(employeeProfileCard.getBoundingClientRect().height));
    };

    syncRolesCardHeight();

    const resizeObserver = new ResizeObserver(() => {
      syncRolesCardHeight();
    });

    resizeObserver.observe(employeeProfileCard);
    window.addEventListener("resize", syncRolesCardHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncRolesCardHeight);
    };
  }, [showExtendedCards]);

  useEffect(() => {
    if (showRegionInput) {
      regionInputRef.current?.focus();
    }
  }, [showRegionInput]);

  useEffect(() => {
    if (showAllergiesField) {
      allergiesInputRef.current?.focus();
    }
  }, [showAllergiesField]);

  function buildSanitizedRoleProfiles(profileDraft: StoredStaffProfile) {
    return sanitizeRoleProfileHourlyRateOverrides(
      profileDraft.roleProfiles,
      profileDraft.country,
      compensationSettings.defaultHourlyRates,
    );
  }

  function buildProfileSavePayload(profileDraft: StoredStaffProfile) {
    const nextRoleProfiles = buildSanitizedRoleProfiles(profileDraft);

    return {
      firstName: profileDraft.firstName.trim(),
      lastName: profileDraft.lastName.trim(),
      email: profileDraft.email.trim(),
      phone: profileDraft.phone.trim(),
      country: profileDraft.country.trim(),
      region: profileDraft.regions[0] ?? profileDraft.region.trim(),
      regions: profileDraft.regions,
      roles: staffRoleKeys.filter((roleKey) => profileDraft.roleProfiles[roleKey].enabled),
      priority: Math.min(
        ...staffRoleKeys
          .filter((roleKey) => profileDraft.roleProfiles[roleKey].enabled)
          .map((roleKey) => profileDraft.roleProfiles[roleKey].priority),
        5,
      ),
      availability: profileDraft.availability.trim(),
      approvalStatus: profileDraft.approvalStatus,
      accessRoleLabel: profileDraft.accessRoleLabel.trim(),
      registrationStatus: profileDraft.registrationStatus,
      profileApproved: profileDraft.profileApproved,
      profileImageName: profileDraft.profileImageName.trim(),
      bankName: profileDraft.bankName.trim(),
      bankDetails: profileDraft.bankDetails.trim(),
      personalNumber: profileDraft.personalNumber.trim(),
      driverLicenseManual: profileDraft.driverLicenseManual,
      driverLicenseAutomatic: profileDraft.driverLicenseAutomatic,
      allergies: profileDraft.allergies.trim(),
      roleProfiles: nextRoleProfiles,
      profileComments: staffRoleKeys
        .filter((roleKey) => nextRoleProfiles[roleKey].comment.trim().length > 0)
        .map((roleKey) => `[${roleKey}] ${nextRoleProfiles[roleKey].comment.trim()}`)
        .join("\n"),
      pendingRecords: profileDraft.pendingRecords.map((item) => item.trim()).filter(Boolean),
    };
  }

  function buildHourlyRateChangeLabel(
    profileDraft: StoredStaffProfile,
    roleKey: StaffRoleKey,
    overrideValue: number | null,
  ) {
    if (overrideValue === null) {
      return `Standard (${getStandardHourlyRate(
        profileDraft.country,
        roleKey,
        compensationSettings.defaultHourlyRates,
      ).label})`;
    }

    return formatHourlyRateLabel(profileDraft.country, overrideValue);
  }

  function getHourlyRateChanges(
    previousProfile: StoredStaffProfile,
    nextProfile: StoredStaffProfile,
  ) {
    const previousRoleProfiles = buildSanitizedRoleProfiles(previousProfile);
    const nextRoleProfiles = buildSanitizedRoleProfiles(nextProfile);

    return staffRoleKeys.flatMap((roleKey) => {
      const previousOverride =
        previousRoleProfiles[roleKey].hourlyRateOverride ?? null;
      const nextOverride = nextRoleProfiles[roleKey].hourlyRateOverride ?? null;

      if (previousOverride === nextOverride) {
        return [];
      }

      return [
        {
          roleKey,
          previousLabel: buildHourlyRateChangeLabel(
            previousProfile,
            roleKey,
            previousOverride,
          ),
          nextLabel: buildHourlyRateChangeLabel(nextProfile, roleKey, nextOverride),
        },
      ];
    });
  }

  const currentProfileSavePayload = useMemo(
    () => buildProfileSavePayload(profile),
    [compensationSettings.defaultHourlyRates, profile],
  );
  const savedProfileSavePayload = useMemo(
    () => buildProfileSavePayload(savedProfileSnapshot),
    [compensationSettings.defaultHourlyRates, savedProfileSnapshot],
  );
  const currentProfileSaveSignature = useMemo(
    () => JSON.stringify(currentProfileSavePayload),
    [currentProfileSavePayload],
  );
  const savedProfileSaveSignature = useMemo(
    () => JSON.stringify(savedProfileSavePayload),
    [savedProfileSavePayload],
  );
  const hasUnsavedProfileChanges =
    currentProfileSaveSignature !== savedProfileSaveSignature;

  useEffect(() => {
    latestProfileSaveSignatureRef.current = currentProfileSaveSignature;
  }, [currentProfileSaveSignature]);

  useEffect(() => {
    if (
      blockedAutoSaveSignature !== null &&
      blockedAutoSaveSignature !== currentProfileSaveSignature
    ) {
      setBlockedAutoSaveSignature(null);
    }
  }, [blockedAutoSaveSignature, currentProfileSaveSignature]);

  function updateField<Key extends keyof StoredStaffProfile>(
    key: Key,
    value: StoredStaffProfile[Key],
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateRegions(nextRegions: string[]) {
    const normalizedRegions = dedupeStrings(nextRegions);

    setProfile((current) => ({
      ...current,
      regions: normalizedRegions,
      region: normalizedRegions[0] ?? current.region,
    }));
  }

  function updateRoleProfile(
    roleKey: StaffRoleKey,
    updates: Partial<StoredStaffProfile["roleProfiles"][StaffRoleKey]>,
  ) {
    setProfile((current) => ({
      ...current,
      roleProfiles: {
        ...current.roleProfiles,
        [roleKey]: {
          ...current.roleProfiles[roleKey],
          ...updates,
        },
      },
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
      regionInputRef.current?.focus();
      return;
    }

    updateRegions([...profile.regions, regionDraft]);
    setRegionDraft("");
    setShowRegionInput(false);
  }

  function toggleRegionInput() {
    setShowRegionInput((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setRegionDraft("");
      }

      return nextValue;
    });
  }

  function toggleRoleComment(roleKey: StaffRoleKey) {
    setOpenRoleComments((current) => ({
      ...current,
      [roleKey]: !current[roleKey],
    }));
  }

  function requestHourlyRateEdit(roleKey: StaffRoleKey) {
    if (approvedHourlyRateEditors[roleKey]) {
      hourlyRateInputRefs.current[roleKey]?.focus();
      return;
    }

    setPendingHourlyRateEditorRole(roleKey);
  }

  function approveHourlyRateEdit(roleKey: StaffRoleKey) {
    setApprovedHourlyRateEditors((current) => ({
      ...current,
      [roleKey]: true,
    }));
    setPendingHourlyRateEditorRole(null);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        hourlyRateInputRefs.current[roleKey]?.focus();
      });
    }
  }

  function changeRolePriority(roleKey: StaffRoleKey, direction: -1 | 1) {
    const currentPriority = profile.roleProfiles[roleKey].priority;
    const nextPriority = Math.min(5, Math.max(1, currentPriority + direction));

    updateRoleProfile(roleKey, {
      priority: nextPriority,
    });
  }

  const primaryStatusAction =
    profile.approvalStatus === "Applicant"
      ? {
          label: "Approve",
          className: "button success",
        }
      : profile.approvalStatus === "Approved"
        ? {
            label: "Archive",
            className: "button warn",
          }
        : {
            label: "Activate",
            className: "button success",
          };

  async function handlePrimaryStatusAction() {
    setSaveMessage("");

    setActionLoading(true);

    const nextStatus =
      profile.approvalStatus === "Applicant"
        ? "Approved"
        : profile.approvalStatus === "Approved"
          ? "Archived"
          : "Approved";
    const nextRegistrationStatus =
      profile.approvalStatus === "Approved" ? "DEACTIVATED" : "APPROVED";

    try {
      const response = await fetch(`/api/staff/${profile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvalStatus: nextStatus,
          registrationStatus: nextRegistrationStatus,
          profileApproved: nextStatus === "Approved",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { profile?: StoredStaffProfile; error?: string }
        | null;

      if (response.ok && payload?.profile) {
        setProfile(payload.profile);
        setSavedProfileSnapshot(payload.profile);
        setSaveMessage(
          nextStatus === "Approved"
            ? profile.approvalStatus === "Archived"
              ? "Employee profile activated."
              : "Employee profile approved."
            : "Employee profile archived.",
        );
      } else {
        setSaveMessage(payload?.error ?? "Could not update profile status.");
      }
    } catch {
      setSaveMessage("Could not update profile status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDeleteProfile() {
    setActionLoading(true);
    setSaveMessage("");

    try {
      const response = await fetch(`/api/staff/${profile.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setSaveMessage(payload?.error ?? "Could not delete employee profile.");
        setActionLoading(false);
        return;
      }

      setShowDeleteConfirm(false);
      router.push(archivedPeopleHref);
    } catch {
      setSaveMessage("Could not delete employee profile.");
      setActionLoading(false);
    }
  }

  async function saveProfile(
    skipHourlyRateConfirm = false,
    saveMode: "auto" | "confirm" = "auto",
  ) {
    const nextRoleProfiles = buildSanitizedRoleProfiles(profile);
    const nextProfileDraft = {
      ...profile,
      roleProfiles: nextRoleProfiles,
    } satisfies StoredStaffProfile;
    const requestBody = buildProfileSavePayload(nextProfileDraft);
    const requestSignature = JSON.stringify(requestBody);
    const hourlyRateChanges = getHourlyRateChanges(
      savedProfileSnapshot,
      nextProfileDraft,
    );

    if (requestSignature === savedProfileSaveSignature) {
      return;
    }

    if (
      !skipHourlyRateConfirm &&
      hourlyRateChanges.some((change) => !approvedHourlyRateEditors[change.roleKey])
    ) {
      setPendingHourlyRateChanges(hourlyRateChanges);
      setShowHourlyRateConfirm(true);
      return;
    }

    setSaving(true);
    setSaveMessage("Saving changes...");

    try {
      const response = await fetch(`/api/staff/${profile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => null)) as
        | { profile?: StoredStaffProfile; error?: string }
        | null;

      if (response.ok && payload?.profile) {
        if (latestProfileSaveSignatureRef.current === requestSignature) {
          setProfile(payload.profile);
        }

        setSavedProfileSnapshot(payload.profile);
        setBlockedAutoSaveSignature(null);
        setShowHourlyRateConfirm(false);
        setPendingHourlyRateChanges([]);
        setSaveMessage(
          saveMode === "confirm"
            ? "Salary changes approved and saved automatically."
            : "Changes saved automatically.",
        );
      } else {
        setBlockedAutoSaveSignature(requestSignature);
        setSaveMessage(payload?.error ?? "Could not save employee profile.");
      }
    } catch {
      setBlockedAutoSaveSignature(requestSignature);
      setSaveMessage("Could not save employee profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStaffAppPassword() {
    if (!linkedStaffAppAccount) {
      setPasswordMessage("No linked Staff App account was found for this employee.");
      return;
    }

    if (!passwordDraft.trim() || !confirmPasswordDraft.trim()) {
      setPasswordMessage("Enter the new Staff App password twice before saving.");
      return;
    }

    if (passwordDraft.trim().length < 8) {
      setPasswordMessage("Staff App password must be at least 8 characters long.");
      return;
    }

    if (passwordDraft !== confirmPasswordDraft) {
      setPasswordMessage("The password confirmation does not match.");
      return;
    }

    setSavingPassword(true);
    setPasswordMessage("");

    try {
      const response = await fetch(`/api/staff/${profile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffAppPassword: passwordDraft.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (response.ok) {
        setPasswordDraft("");
        setConfirmPasswordDraft("");
        setPasswordMessage("Staff App password updated.");
      } else {
        setPasswordMessage(payload?.error ?? "Could not update the Staff App password.");
      }
    } catch {
      setPasswordMessage("Could not update the Staff App password.");
    } finally {
      setSavingPassword(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (
      !hasUnsavedProfileChanges ||
      saving ||
      actionLoading ||
      uploadingImage ||
      showDeleteConfirm ||
      showHourlyRateConfirm ||
      pendingHourlyRateEditorRole !== null ||
      blockedAutoSaveSignature === currentProfileSaveSignature
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveProfile(false, "auto");
    }, autoSaveDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    actionLoading,
    blockedAutoSaveSignature,
    currentProfileSaveSignature,
    hasUnsavedProfileChanges,
    pendingHourlyRateEditorRole,
    saving,
    showDeleteConfirm,
    showHourlyRateConfirm,
    uploadingImage,
  ]);

  useEffect(() => {
    if (
      saveMessage !== "Changes saved automatically." &&
      saveMessage !== "Salary changes approved and saved automatically."
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveMessage((current) =>
        current === "Changes saved automatically." ||
        current === "Salary changes approved and saved automatically."
          ? ""
          : current,
      );
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveMessage]);

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

    const response = await fetch(`/api/staff/${profile.id}/image`, {
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
      setSavedProfileSnapshot((current) => ({
        ...current,
        profileImageName: payload.profileImageName ?? current.profileImageName,
        profileImageUrl: payload.profileImageUrl ?? current.profileImageUrl,
      }));
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      setSaveMessage("Profile image updated.");
    } else {
      setSaveMessage(payload?.error ?? "Could not upload profile image.");
    }

    setUploadingImage(false);
  }

  const subtitleRegions =
    profile.regions.length > 0 ? profile.regions.join(", ") : profile.region;
  const pendingHourlyRateEditorStandard =
    pendingHourlyRateEditorRole !== null
      ? getStandardHourlyRate(
          profile.country,
          pendingHourlyRateEditorRole,
          compensationSettings.defaultHourlyRates,
        )
      : null;
  const showStaffAppAccessCard = showExtendedCards && linkedStaffAppAccount !== null;

  return (
    <div className="staff-profile-editor">
      <PageHeader
        title={`${profile.firstName} ${profile.lastName}`}
        subtitle={`${profile.country}, ${subtitleRegions}`}
        leading={
          <div className="staff-profile-header-image">
            <div className="staff-profile-header-image-preview">
              <ProfileImage
                fullName={`${profile.firstName} ${profile.lastName}`}
                imageUrl={profile.profileImageUrl}
                alt={`${profile.firstName} ${profile.lastName} profile`}
                className="staff-profile-header-image-media"
                loading="eager"
              />
              <label
                className="staff-profile-header-image-trigger"
                htmlFor={`staff-image-${profile.id}`}
              >
                {uploadingImage ? "UPLOADING" : "EDIT"}
              </label>
            </div>
            <input
              id={`staff-image-${profile.id}`}
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
          <Link href="/people" className="button ghost">
            Back to staff
          </Link>
        }
        eyebrow=""
      />

      <section
        className={`content-grid staff-profile-grid${
          showExtendedCards ? "" : " staff-profile-grid--employee-only"
        }`}
      >
        <div className="stack-column staff-profile-primary-column">
          <div ref={employeeProfileCardRef} className="card staff-profile-compact-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Employee profile</p>
                <h2>Personal details</h2>
              </div>
              <div className="staff-profile-status-actions">
                <StatusBadge label={profile.approvalStatus} />
                <button
                  type="button"
                  className={primaryStatusAction.className}
                  onClick={() => {
                    void handlePrimaryStatusAction();
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Working..." : primaryStatusAction.label}
                </button>
                {profile.approvalStatus === "Archived" ? (
                  <button
                    type="button"
                    className="button ghost danger-outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionLoading}
                  >
                    Delete
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
                  onChange={(event) => updateField("firstName", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Last name</small>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(event) => updateField("lastName", event.currentTarget.value)}
                />
              </label>

              <label className="key-value-card key-value-card-editable">
                <small>Personal number</small>
                <input
                  type="text"
                  value={profile.personalNumber}
                  onChange={(event) => updateField("personalNumber", event.currentTarget.value)}
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
                <small>Email</small>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => updateField("email", event.currentTarget.value)}
                />
              </label>

              <div className="key-value-card key-value-card-editable staff-profile-regions-card">
                <small>Regions</small>
                {isSwedenProfile ? (
                  <>
                    <div className="staff-profile-region-grid">
                      {regionOptions.map((region) => {
                        const isActive = profile.regions.includes(region);

                        return (
                          <button
                            key={region}
                            type="button"
                            className={`staff-profile-region-chip${isActive ? " active" : ""}`}
                            onClick={() => toggleRegion(region)}
                          >
                            {region === "Malmo" ? "Malmö" : region}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`staff-profile-region-chip staff-profile-region-add-trigger${
                          showRegionInput ? " active" : ""
                        }`}
                        onClick={toggleRegionInput}
                        aria-expanded={showRegionInput}
                      >
                        Add region
                      </button>
                    </div>
                    {showRegionInput ? (
                      <div className="staff-profile-region-add">
                        <input
                          ref={regionInputRef}
                          type="text"
                          placeholder="Type region"
                          value={regionDraft}
                          onChange={(event) => setRegionDraft(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addCustomRegion();
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              setRegionDraft("");
                              setShowRegionInput(false);
                            }
                          }}
                        />
                        <button type="button" className="button ghost" onClick={addCustomRegion}>
                          Save
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-panel">
                    Regions are only active for Sweden.
                  </div>
                )}
              </div>

              <label className="key-value-card key-value-card-editable">
                <small>Country</small>
                <select
                  value={profile.country}
                  onChange={(event) => updateField("country", event.currentTarget.value)}
                >
                  {countryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="key-value-card key-value-card-editable staff-profile-bank-card">
                <small>Bank details</small>
                <div className="staff-profile-bank-grid">
                  <label className="staff-profile-inline-field">
                    <span>Bank</span>
                    <input
                      type="text"
                      value={profile.bankName}
                      onChange={(event) => updateField("bankName", event.currentTarget.value)}
                    />
                  </label>

                  <label className="staff-profile-inline-field">
                    <span>Bank number</span>
                    <input
                      type="text"
                      value={profile.bankDetails}
                      onChange={(event) => updateField("bankDetails", event.currentTarget.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="key-value-card key-value-card-editable staff-profile-extra-card">
                <small>Additional info</small>
                <div className="staff-profile-checkbox-grid">
                  <label className="staff-profile-checkbox">
                    <input
                      type="checkbox"
                      checked={profile.driverLicenseManual}
                      onChange={(event) =>
                        updateField("driverLicenseManual", event.currentTarget.checked)
                      }
                    />
                    <span>Manual driver license</span>
                  </label>
                  <label className="staff-profile-checkbox">
                    <input
                      type="checkbox"
                      checked={profile.driverLicenseAutomatic}
                      onChange={(event) =>
                        updateField("driverLicenseAutomatic", event.currentTarget.checked)
                      }
                    />
                    <span>Automatic driver license</span>
                  </label>
                </div>

                <div className="staff-profile-inline-field">
                  <button
                    type="button"
                    className={`staff-profile-role-comment-toggle${
                      showAllergiesField ? " open" : ""
                    }${profile.allergies.trim().length > 0 ? " has-value" : ""}`}
                    onClick={() => setShowAllergiesField((current) => !current)}
                    aria-expanded={showAllergiesField}
                  >
                    <span>Allergies</span>
                    <span className="staff-profile-role-comment-toggle-meta">
                      {showAllergiesField
                        ? "Hide"
                        : profile.allergies.trim().length > 0
                          ? "Edit"
                          : "Add"}
                    </span>
                  </button>

                  {showAllergiesField ? (
                    <label className="staff-profile-inline-field staff-profile-role-comment-field">
                      <span>Allergies</span>
                      <textarea
                        ref={allergiesInputRef}
                        rows={2}
                        value={profile.allergies}
                        onChange={(event) => updateField("allergies", event.currentTarget.value)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>

            {saveMessage ? (
              <div className="overview-editor-actions overview-editor-actions-status-only staff-profile-actions">
                <p className="muted">{saveMessage}</p>
              </div>
            ) : null}
          </div>

          {showExtendedCards ? (
            <div
              className="card staff-profile-compact-card staff-profile-roles-card"
              style={rolesCardHeight ? { height: `${rolesCardHeight}px` } : undefined}
            >
              <div className="section-head">
                <div>
                  <p className="eyebrow">Roles</p>
                  <h2>Roles and notes</h2>
                </div>
              </div>

              <div className="staff-profile-role-grid">
                {staffRoleKeys.map((roleKey) => {
                  const roleProfile = profile.roleProfiles[roleKey];
                  const normalizedHourlyRateOverride = sanitizeHourlyRateOverride(
                    roleProfile.hourlyRateOverride,
                    profile.country,
                    roleKey,
                    compensationSettings.defaultHourlyRates,
                  );
                  const standardHourlyRate = getStandardHourlyRate(
                    profile.country,
                    roleKey,
                    compensationSettings.defaultHourlyRates,
                  );
                  const effectiveHourlyRate = resolveEffectiveHourlyRate({
                    country: profile.country,
                    roleKey,
                    roleProfiles: {
                      ...profile.roleProfiles,
                      [roleKey]: {
                        ...roleProfile,
                        hourlyRateOverride: normalizedHourlyRateOverride,
                      },
                    },
                    defaultHourlyRates: compensationSettings.defaultHourlyRates,
                  });
                  const hasHourlyRateOverride = normalizedHourlyRateOverride !== null;
                  const isCommentOpen = openRoleComments[roleKey] ?? false;
                  const hasComment = roleProfile.comment.trim().length > 0;
                  const isHourlyRateEditorEnabled =
                    approvedHourlyRateEditors[roleKey] ?? false;

                  return (
                    <div
                      key={roleKey}
                      className={`key-value-card key-value-card-editable staff-profile-role-card${
                        roleProfile.enabled ? " active" : ""
                      }`}
                    >
                      <div className="staff-profile-role-card-head">
                        <div>
                          <strong>{formatRoleScopeLabel(roleKey)}</strong>
                        </div>
                      </div>

                      <div className="staff-profile-role-control-grid">
                        <button
                          type="button"
                          className={`staff-profile-role-control-card staff-profile-role-permission-control${
                            roleProfile.enabled ? " active" : ""
                          }`}
                          onClick={() =>
                            updateRoleProfile(roleKey, {
                              enabled: !roleProfile.enabled,
                            })
                          }
                        >
                          <span>Permission</span>
                          <strong>{roleProfile.enabled ? "On" : "Off"}</strong>
                        </button>

                        <div className="staff-profile-role-control-card staff-profile-role-priority-control">
                          <span>Priority level</span>
                          <div className="staff-profile-role-priority-stepper">
                            <button
                              type="button"
                              className="staff-profile-role-priority-button"
                              onClick={() => changeRolePriority(roleKey, -1)}
                              disabled={roleProfile.priority <= 1}
                              aria-label={`Decrease priority for ${roleKey}`}
                            >
                              -
                            </button>
                            <strong>{roleProfile.priority}</strong>
                            <button
                              type="button"
                              className="staff-profile-role-priority-button"
                              onClick={() => changeRolePriority(roleKey, 1)}
                              disabled={roleProfile.priority >= 5}
                              aria-label={`Increase priority for ${roleKey}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="staff-profile-role-rate-grid">
                        <div className="staff-profile-role-rate-pill">
                          <span>Standard wage</span>
                          <strong>{standardHourlyRate.label}</strong>
                        </div>
                        <div
                          className={`staff-profile-role-rate-pill staff-profile-role-rate-pill-editable${
                            hasHourlyRateOverride ? " active" : ""
                          }${isHourlyRateEditorEnabled ? " editing" : ""}`}
                        >
                          <div className="staff-profile-role-rate-pill-head">
                            <span>Effective wage</span>
                            <span
                              className={`staff-profile-role-rate-edit-status${
                                isHourlyRateEditorEnabled ? " editing" : ""
                              }`}
                            >
                              {isHourlyRateEditorEnabled ? "Editing" : "Locked"}
                            </span>
                          </div>
                          {isHourlyRateEditorEnabled ? (
                            <div className="staff-profile-role-rate-input-row">
                              <span className="staff-profile-role-rate-prefix">
                                {effectiveHourlyRate.currency}
                              </span>
                              <input
                                ref={(node) => {
                                  hourlyRateInputRefs.current[roleKey] = node;
                                }}
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                className="staff-profile-role-rate-input"
                                aria-label={`Effective wage for ${roleKey}`}
                                placeholder={`${standardHourlyRate.hourlyRate}`}
                                value={roleProfile.hourlyRateOverride ?? ""}
                                onChange={(event) =>
                                  updateRoleProfile(roleKey, {
                                    hourlyRateOverride:
                                      event.currentTarget.value.trim().length > 0
                                        ? Number(event.currentTarget.value)
                                        : null,
                                  })
                                }
                              />
                              <span className="staff-profile-role-rate-suffix">/ h</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="staff-profile-role-rate-trigger"
                              onClick={() => requestHourlyRateEdit(roleKey)}
                            >
                              <strong>{effectiveHourlyRate.label}</strong>
                              <span>Unlock to edit</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="staff-profile-role-comment">
                        <button
                          type="button"
                          className={`staff-profile-role-comment-toggle${
                            isCommentOpen ? " open" : ""
                          }${hasComment ? " has-value" : ""}`}
                          onClick={() => toggleRoleComment(roleKey)}
                          aria-expanded={isCommentOpen}
                        >
                          <span>Comment</span>
                          <span className="staff-profile-role-comment-toggle-meta">
                            {isCommentOpen ? "Hide" : hasComment ? "Edit" : "Add"}
                          </span>
                        </button>

                        {isCommentOpen ? (
                          <label className="staff-profile-inline-field staff-profile-role-comment-field">
                            <span>Comment</span>
                            <textarea
                              rows={2}
                              value={roleProfile.comment}
                              onChange={(event) =>
                                updateRoleProfile(roleKey, {
                                  comment: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : null}

          {showStaffAppAccessCard ? (
            <div className="card staff-profile-compact-card staff-profile-secondary-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Staff App Access</p>
                  <h2>App login</h2>
                </div>
              </div>

              <div className="key-value-grid staff-profile-compact-grid">
                <div className="key-value-card staff-profile-card-wide">
                  <small>Login email</small>
                  <strong>{profile.email}</strong>
                </div>

                <div className="key-value-card key-value-card-editable staff-profile-card-wide staff-profile-password-card">
                  <div className="staff-profile-bank-grid">
                    <label className="staff-profile-inline-field">
                      <span>New password</span>
                      <input
                        type="password"
                        value={passwordDraft}
                        onChange={(event) => setPasswordDraft(event.currentTarget.value)}
                      />
                    </label>

                    <label className="staff-profile-inline-field">
                      <span>Confirm password</span>
                      <input
                        type="password"
                        value={confirmPasswordDraft}
                        onChange={(event) => setConfirmPasswordDraft(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="overview-editor-actions staff-profile-actions">
                <p className="muted">{passwordMessage}</p>
                <button
                  type="button"
                  className="button"
                  onClick={() => void saveStaffAppPassword()}
                  disabled={savingPassword}
                >
                  {savingPassword ? "Saving..." : "Save Staff App password"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {showExtendedCards ? (
          <div
            className={`stack-column staff-profile-documents-column${
              showStaffAppAccessCard ? "" : " staff-profile-documents-column-full"
            }`}
          >
            <StaffDocumentsPanel personId={profile.id} initialDocuments={initialDocuments} />
          </div>
        ) : null}
      </section>

      {showDeleteConfirm ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-profile-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Delete profile</p>
                <h2 id="delete-profile-title">Permanent removal</h2>
                <p className="page-subtitle">
                  Are you sure you want to permanently delete this profile?
                </p>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    void confirmDeleteProfile();
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingHourlyRateEditorRole !== null && pendingHourlyRateEditorStandard ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hourly-rate-edit-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Unlock wage editing</p>
                <h2 id="hourly-rate-edit-title">
                  Approve custom wage editing for {formatRoleScopeLabel(pendingHourlyRateEditorRole)}
                </h2>
                <p className="page-subtitle">
                  Effective wage is locked until you approve profile-specific editing for this
                  role. This makes it clear that you are overriding the standard wage.
                </p>
              </div>

              <div className="key-value-card">
                <small>Standard wage</small>
                <strong>{pendingHourlyRateEditorStandard.label}</strong>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setPendingHourlyRateEditorRole(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => approveHourlyRateEdit(pendingHourlyRateEditorRole)}
                >
                  Unlock editing
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showHourlyRateConfirm ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hourly-rate-confirm-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Confirm salary override</p>
                <h2 id="hourly-rate-confirm-title">Approve profile-specific wage changes</h2>
                <p className="page-subtitle">
                  You changed one or more role wages on this profile. Confirm the
                  override before the new salary is saved.
                </p>
              </div>

              <ul className="staff-profile-rate-change-list">
                {pendingHourlyRateChanges.map((change) => (
                  <li key={change.roleKey}>
                    <strong>{change.roleKey}</strong>
                    <span>
                      {change.previousLabel} to {change.nextLabel}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    setBlockedAutoSaveSignature(currentProfileSaveSignature);
                    setShowHourlyRateConfirm(false);
                    setPendingHourlyRateChanges([]);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void saveProfile(true, "confirm");
                  }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Confirm salary changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
