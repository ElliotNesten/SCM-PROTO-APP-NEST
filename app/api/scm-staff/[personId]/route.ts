import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createPasswordHash, verifyPasswordHash } from "@/lib/password-utils";
import {
  canAccessScmStaffAdministration,
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";

import {
  deleteStoredScmStaffProfile,
  getStoredScmStaffProfileById,
  redactScmStaffPasswordPlaintext,
  updateStoredScmStaffProfile,
} from "@/lib/scm-staff-store";
import { isManuallyManagedScmStaffRole, type ScmStaffRoleKey } from "@/types/scm-rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string }>;
};

type ScmStaffPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  password?: string;
  phone?: string;
  roleKey?: ScmStaffRoleKey;
  country?: string;
  regions?: string[];
  assignedGigIds?: string[];
  linkedStaffId?: string;
  linkedStaffName?: string;
  profileImageName?: string;
  profileImageUrl?: string;
  notes?: string;
};

function normalizeScopeRegions(regions: string[]) {
  return regions.map((region) => region.trim()).filter(Boolean);
}

function haveSameRegions(left: string[], right: string[]) {
  const normalizedLeft = normalizeScopeRegions(left);
  const normalizedRight = normalizeScopeRegions(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((region, index) => region === normalizedRight[index]);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const payload = (await request.json().catch(() => null)) as ScmStaffPayload | null;
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!payload) {
    return NextResponse.json(
      { error: "Missing SCM staff profile payload." },
      { status: 400 },
    );
  }

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const existingProfile = await getStoredScmStaffProfileById(personId);

  if (!existingProfile) {
    return NextResponse.json({ error: "SCM staff profile not found." }, { status: 404 });
  }

  const isOwnProfile = currentProfile.id === existingProfile.id;
  const canManageAdministrativeFields = canAccessScmStaffAdministration(currentProfile.roleKey);
  const canEditBasicFields = canManageAdministrativeFields || isOwnProfile;
  const canResetPassword = isSuperAdminRole(currentProfile.roleKey);
  const requestedPassword = payload.password?.trim() ?? "";
  const requestedCurrentPassword = payload.currentPassword?.trim() ?? "";
  const nextCountry = payload.country?.trim() ?? existingProfile.country;
  const nextRegions = Array.isArray(payload.regions)
    ? normalizeScopeRegions(payload.regions)
    : existingProfile.regions;
  const nextNotes = payload.notes?.trim() ?? existingProfile.notes;

  if (!canEditBasicFields) {
    return NextResponse.json(
      { error: "You can only edit your own SCM Staff profile." },
      { status: 403 },
    );
  }

  const nextRoleKey = payload.roleKey ?? existingProfile.roleKey;

  if (!isManuallyManagedScmStaffRole(nextRoleKey)) {
    return NextResponse.json(
      { error: "Temporary Gig Manager access can only be granted from Share gig info." },
      { status: 400 },
    );
  }

  const isChangingRole = nextRoleKey !== existingProfile.roleKey;

  if (isChangingRole && !isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can change SCM Staff roles." },
      { status: 403 },
    );
  }

  if (
    !canManageAdministrativeFields &&
    (nextCountry !== existingProfile.country ||
      !haveSameRegions(nextRegions, existingProfile.regions) ||
      nextNotes !== existingProfile.notes)
  ) {
    return NextResponse.json(
      { error: "You can only change SCM Staff scope settings for profiles you administer." },
      { status: 403 },
    );
  }

  if (requestedPassword) {
    if (!canResetPassword && !isOwnProfile) {
      return NextResponse.json(
        { error: "You can only change your own SCM Staff password." },
        { status: 403 },
      );
    }

    if (requestedPassword.length < 8) {
      return NextResponse.json(
        { error: "SCM Staff password must be at least 8 characters long." },
        { status: 400 },
      );
    }

    if (!canResetPassword) {
      if (!requestedCurrentPassword) {
        return NextResponse.json(
          { error: "Enter your current password to change it." },
          { status: 400 },
        );
      }

      if (!verifyPasswordHash(requestedCurrentPassword, existingProfile.passwordHash)) {
        return NextResponse.json(
          { error: "Your current password is incorrect." },
          { status: 400 },
        );
      }
    }
  }

  const updatedProfile = await updateStoredScmStaffProfile(personId, {
    firstName:
      canEditBasicFields
        ? (payload.firstName ?? existingProfile.firstName)
        : existingProfile.firstName,
    lastName:
      canEditBasicFields
        ? (payload.lastName ?? existingProfile.lastName)
        : existingProfile.lastName,
    email:
      canEditBasicFields
        ? (payload.email ?? existingProfile.email)
        : existingProfile.email,
    passwordHash:
      requestedPassword
        ? createPasswordHash(requestedPassword)
        : existingProfile.passwordHash,
    phone:
      canEditBasicFields
        ? (payload.phone ?? existingProfile.phone)
        : existingProfile.phone,
    roleKey: nextRoleKey,
    country: canManageAdministrativeFields ? nextCountry : existingProfile.country,
    regions: canManageAdministrativeFields ? nextRegions : existingProfile.regions,
    assignedGigIds: [],
    linkedStaffId: undefined,
    linkedStaffName: undefined,
    profileImageName: payload.profileImageName ?? existingProfile.profileImageName,
    profileImageUrl: payload.profileImageUrl ?? existingProfile.profileImageUrl,
    notes: canManageAdministrativeFields ? nextNotes : existingProfile.notes,
  });

  if (!updatedProfile) {
    return NextResponse.json({ error: "SCM staff profile not found." }, { status: 404 });
  }

  revalidatePath("/scm-staff");
  revalidatePath(`/scm-staff/${personId}`);
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    profile: redactScmStaffPasswordPlaintext(updatedProfile),
    isOwnProfile,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessScmStaffAdministration(currentProfile.roleKey)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const deletedProfile = await deleteStoredScmStaffProfile(personId);

  if (!deletedProfile) {
    return NextResponse.json({ error: "SCM staff profile not found." }, { status: 404 });
  }

  revalidatePath("/scm-staff");
  revalidatePath(`/scm-staff/${personId}`);
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true });
}
