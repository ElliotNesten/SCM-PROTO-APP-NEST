import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ScmStaffProfileEditor } from "@/components/scm-staff-profile-editor";
import {
  isSuperAdminRole,
  requireScmStaffAdministrationProfile,
} from "@/lib/auth-session";
import { getStoredScmStaffProfileById } from "@/lib/scm-staff-store";

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
    requireScmStaffAdministrationProfile(),
    getStoredScmStaffProfileById(personId),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <ScmStaffProfileEditor
      initialProfile={profile}
      allowDelete
      canManageAdministrativeFields
      canEditRole={isSuperAdminRole(currentScmStaffProfile.roleKey)}
      initialStatusMessage={getInviteStatusMessage(
        pickQueryValue(resolvedSearchParams?.invite),
      )}
    />
  );
}
