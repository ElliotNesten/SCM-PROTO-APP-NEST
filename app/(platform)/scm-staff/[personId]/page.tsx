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
};

export default async function ScmStaffProfilePage({
  params,
}: ScmStaffProfilePageProps) {
  noStore();
  const { personId } = await params;
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
    />
  );
}
