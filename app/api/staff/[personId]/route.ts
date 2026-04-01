import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  deleteStoredStaffProfile,
  getStoredStaffProfileById,
  updateStoredStaffProfile,
} from "@/lib/staff-store";
import {
  ensureStaffAppAccountForLinkedStaffProfile,
  syncStaffAppAccountFromLinkedStaffProfile,
  updateStaffAppAccountPasswordByLinkedStaffProfileId,
} from "@/lib/staff-app-store";
import type { RegistrationStatus } from "@/types/backend";
import type { StaffApprovalStatus } from "@/types/scm";
import {
  staffRoleKeys,
  type StoredStaffRoleProfiles,
} from "@/types/staff-role";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string }>;
};

type StaffProfilePayload = {
  displayName?: string;
  email?: string;
  phone?: string;
  country?: string;
  region?: string;
  regions?: string[];
  roles?: string[];
  priority?: number;
  availability?: string;
  approvalStatus?: StaffApprovalStatus;
  accessRoleLabel?: string;
  registrationStatus?: RegistrationStatus;
  profileApproved?: boolean;
  profileImageName?: string;
  bankName?: string;
  bankDetails?: string;
  personalNumber?: string;
  driverLicenseManual?: boolean;
  driverLicenseAutomatic?: boolean;
  allergies?: string;
  roleProfiles?: Partial<StoredStaffRoleProfiles>;
  profileComments?: string;
  pendingRecords?: string[];
  staffAppPassword?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const payload = (await request.json().catch(() => null)) as StaffProfilePayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Missing staff profile payload." }, { status: 400 });
  }

  const requestedStaffAppPassword =
    typeof payload.staffAppPassword === "string"
      ? payload.staffAppPassword.trim()
      : undefined;

  if (payload.staffAppPassword !== undefined && requestedStaffAppPassword) {
    if (requestedStaffAppPassword.length < 6) {
      return NextResponse.json(
        { error: "Staff App password must be at least 6 characters long." },
        { status: 400 },
      );
    }
  }

  const existingProfile = await getStoredStaffProfileById(personId);

  if (!existingProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
  }

  const updatedProfile = await updateStoredStaffProfile(personId, {
    displayName: payload.displayName ?? existingProfile.displayName,
    email: payload.email ?? existingProfile.email,
    phone: payload.phone ?? existingProfile.phone,
    country: payload.country ?? existingProfile.country,
    region: payload.region ?? existingProfile.region,
    regions: Array.isArray(payload.regions) ? payload.regions : existingProfile.regions,
    roles: Array.isArray(payload.roles) ? payload.roles : existingProfile.roles,
    priority: Number(payload.priority ?? existingProfile.priority),
    availability: payload.availability ?? existingProfile.availability,
    approvalStatus: payload.approvalStatus ?? existingProfile.approvalStatus,
    accessRoleLabel: payload.accessRoleLabel ?? existingProfile.accessRoleLabel,
    registrationStatus:
      payload.registrationStatus ?? existingProfile.registrationStatus,
    profileApproved: payload.profileApproved ?? existingProfile.profileApproved,
    profileImageName:
      payload.profileImageName ?? existingProfile.profileImageName,
    bankName: payload.bankName ?? existingProfile.bankName,
    bankDetails: payload.bankDetails ?? existingProfile.bankDetails,
    personalNumber: payload.personalNumber ?? existingProfile.personalNumber,
    driverLicenseManual:
      payload.driverLicenseManual ?? existingProfile.driverLicenseManual,
    driverLicenseAutomatic:
      payload.driverLicenseAutomatic ?? existingProfile.driverLicenseAutomatic,
    allergies: payload.allergies ?? existingProfile.allergies,
    roleProfiles: payload.roleProfiles
      ? (Object.fromEntries(
          staffRoleKeys.map((roleKey) => [
            roleKey,
            {
              ...existingProfile.roleProfiles[roleKey],
              ...payload.roleProfiles?.[roleKey],
            },
          ]),
        ) as StoredStaffRoleProfiles)
      : existingProfile.roleProfiles,
    profileComments: payload.profileComments ?? existingProfile.profileComments,
    pendingRecords: Array.isArray(payload.pendingRecords)
      ? payload.pendingRecords
      : existingProfile.pendingRecords,
  });

  if (!updatedProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
  }

  await ensureStaffAppAccountForLinkedStaffProfile({
    id: updatedProfile.id,
    displayName: updatedProfile.displayName,
    email: updatedProfile.email,
    phone: updatedProfile.phone,
    country: updatedProfile.country,
    region: updatedProfile.region,
    roleProfiles: updatedProfile.roleProfiles,
    roles: updatedProfile.roles,
    priority: updatedProfile.priority,
    profileImageUrl: updatedProfile.profileImageUrl,
  });

  await syncStaffAppAccountFromLinkedStaffProfile({
    id: updatedProfile.id,
    displayName: updatedProfile.displayName,
    email: updatedProfile.email,
    phone: updatedProfile.phone,
    country: updatedProfile.country,
    region: updatedProfile.region,
    roleProfiles: updatedProfile.roleProfiles,
    roles: updatedProfile.roles,
    priority: updatedProfile.priority,
    profileImageUrl: updatedProfile.profileImageUrl,
  });

  if (requestedStaffAppPassword) {
    await updateStaffAppAccountPasswordByLinkedStaffProfileId(
      personId,
      requestedStaffAppPassword,
    );
  }

  return NextResponse.json({ ok: true, profile: updatedProfile });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const existingProfile = await getStoredStaffProfileById(personId);

  if (!existingProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
  }

  if (existingProfile.approvalStatus !== "Archived") {
    return NextResponse.json(
      { error: "Only archived staff profiles can be deleted." },
      { status: 400 },
    );
  }

  const deletionResult = await deleteStoredStaffProfile(personId);

  if (!deletionResult) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
  }

  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    archivedDocumentCount: deletionResult.archivedDocumentCount,
  });
}
