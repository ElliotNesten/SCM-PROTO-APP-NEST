import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { StaffProfileEditor } from "@/components/staff-profile-editor";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { canAccessPlatformStaffDirectory } from "@/lib/platform-access";
import { getStaffAppAccountByLinkedStaffProfileId } from "@/lib/staff-app-store";
import { getStoredStaffDocuments } from "@/lib/staff-document-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";

type PersonProfilePageProps = {
  params: Promise<{ personId: string }>;
};

export default async function PersonProfilePage({ params }: PersonProfilePageProps) {
  noStore();
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessPlatformStaffDirectory(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  const { personId } = await params;
  const [profile, documents, compensationSettings] = await Promise.all([
    getStoredStaffProfileById(personId),
    getStoredStaffDocuments(personId),
    getSystemCompensationSettings(),
  ]);

  if (!profile) {
    notFound();
  }

  const linkedStaffAppAccount = await getStaffAppAccountByLinkedStaffProfileId(profile.id);

  return (
    <StaffProfileEditor
      initialProfile={profile}
      initialDocuments={documents}
      compensationSettings={compensationSettings}
      linkedStaffAppAccount={{
        roleScopes: linkedStaffAppAccount?.roleScopes ?? [],
      }}
    />
  );
}
