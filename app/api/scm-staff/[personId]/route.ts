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
  displayName?: string;
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
  const canRevealStoredPassword = isSuperAdminRole(currentProfile.roleKey);
  const requestedPassword = payload.password?.trim() ?? "";
  const requestedCurrentPassword = payload.currentPassword?.trim() ?? "";

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

  if (requestedPassword) {
    if (!canRevealStoredPassword && !isOwnProfile) {
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

    if (!canRevealStoredPassword) {
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
    displayName: payload.displayName ?? existingProfile.displayName,
    email: payload.email ?? existingProfile.email,
    passwordHash:
      requestedPassword
        ? createPasswordHash(requestedPassword)
        : existingProfile.passwordHash,
    passwordPlaintext:
      requestedPassword
        ? requestedPassword
        : existingProfile.passwordPlaintext,
    phone: payload.phone ?? existingProfile.phone,
    roleKey: nextRoleKey,
    country: payload.country ?? existingProfile.country,
    regions: Array.isArray(payload.regions) ? payload.regions : existingProfile.regions,
    assignedGigIds: [],
    linkedStaffId: undefined,
    linkedStaffName: undefined,
    profileImageName: payload.profileImageName ?? existingProfile.profileImageName,
    profileImageUrl: payload.profileImageUrl ?? existingProfile.profileImageUrl,
    notes: payload.notes ?? existingProfile.notes,
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
    profile: canRevealStoredPassword
      ? updatedProfile
      : redactScmStaffPasswordPlaintext(updatedProfile),
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
