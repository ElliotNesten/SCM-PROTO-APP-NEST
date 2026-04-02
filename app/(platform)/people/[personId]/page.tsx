import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { StaffProfileEditor } from "@/components/staff-profile-editor";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  canAccessPlatformFieldStaffProfile,
  canAccessPlatformStaffDirectory,
} from "@/lib/platform-access";
import { getStaffAppAccountByLinkedStaffProfileId } from "@/lib/staff-app-store";
import { getStoredStaffDocuments } from "@/lib/staff-document-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import type { StoredStaffDocument } from "@/types/staff-documents";

type PersonProfilePageProps = {
  params: Promise<{ personId: string }>;
};

export default async function PersonProfilePage({ params }: PersonProfilePageProps) {
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessPlatformStaffDirectory(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  const { personId } = await params;
  const [profile, compensationSettings] = await Promise.all([
    getStoredStaffProfileById(personId),
    getSystemCompensationSettings(),
  ]);

  if (!profile) {
    notFound();
  }

  const showExtendedCards =
    currentProfile.roleKey !== "regionalManager" ||
    canAccessPlatformFieldStaffProfile(currentProfile, profile);
  let documents: StoredStaffDocument[] = [];
  let linkedStaffAppAccount: Awaited<
    ReturnType<typeof getStaffAppAccountByLinkedStaffProfileId>
  > = null;

  if (showExtendedCards) {
    [documents, linkedStaffAppAccount] = await Promise.all([
      getStoredStaffDocuments(personId),
      getStaffAppAccountByLinkedStaffProfileId(profile.id),
    ]);
  }

  return (
    <StaffProfileEditor
      initialProfile={profile}
      initialDocuments={documents}
      compensationSettings={compensationSettings}
      linkedStaffAppAccount={
        linkedStaffAppAccount
          ? {
              roleScopes: linkedStaffAppAccount.roleScopes ?? [],
            }
          : null
      }
      showExtendedCards={showExtendedCards}
    />
  );
}
