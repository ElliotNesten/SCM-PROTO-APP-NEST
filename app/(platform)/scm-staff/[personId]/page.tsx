import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ScmStaffProfileEditor } from "@/components/scm-staff-profile-editor";
import {
  canAccessScmStaffAdministration,
  isSuperAdminRole,
  requireScmStaffDirectoryProfile,
} from "@/lib/auth-session";
import {
  getStoredScmStaffProfileById,
  redactScmStaffPasswordPlaintext,
} from "@/lib/scm-staff-store";

type ScmStaffProfilePageProps = {
  params: Promise<{ personId: string }>;
  searchParams?: Promise<{
    invite?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getInviteStatusMessage(status: string | undefined) {
  if (status === "sent") {
    return "SCM Staff profile created and activation email sent.";
  }

  if (status === "failed") {
    return "SCM Staff profile created, but the activation email could not be sent.";
  }

  return "";
}

export default async function ScmStaffProfilePage({
  params,
  searchParams,
}: ScmStaffProfilePageProps) {
  noStore();
  const { personId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [currentScmStaffProfile, profile] = await Promise.all([
    requireScmStaffDirectoryProfile(),
    getStoredScmStaffProfileById(personId),
  ]);

  if (!profile) {
    notFound();
  }

  const canManageAdministrativeFields = canAccessScmStaffAdministration(
    currentScmStaffProfile.roleKey,
  );
  const canRevealStoredPassword = isSuperAdminRole(currentScmStaffProfile.roleKey);
  const isOwnProfile = currentScmStaffProfile.id === profile.id;
  const canEditBasicFields = canManageAdministrativeFields || isOwnProfile;
  const canViewStoredPassword = canRevealStoredPassword || isOwnProfile;
  const editableProfile = canViewStoredPassword
    ? profile
    : redactScmStaffPasswordPlaintext(profile);

  return (
    <ScmStaffProfileEditor
      initialProfile={editableProfile}
      allowDelete={canManageAdministrativeFields}
      canEditBasicFields={canEditBasicFields}
      canManageAdministrativeFields={canManageAdministrativeFields}
      canEditProfileImage={
        isSuperAdminRole(currentScmStaffProfile.roleKey) ||
        isOwnProfile
      }
      canEditRole={isSuperAdminRole(currentScmStaffProfile.roleKey)}
      canChangePassword={canRevealStoredPassword || isOwnProfile}
      canViewStoredPassword={canViewStoredPassword}
      canRevealStoredPassword={canRevealStoredPassword}
      requiresCurrentPassword={isOwnProfile && !canRevealStoredPassword}
      initialStatusMessage={getInviteStatusMessage(
        pickQueryValue(resolvedSearchParams?.invite),
      )}
    />
  );
}
