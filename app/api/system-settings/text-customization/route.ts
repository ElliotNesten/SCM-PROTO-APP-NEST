import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { getStaticTextCatalog } from "@/lib/static-text-catalog";
import {
  getTextCustomizationState,
  updateTextCustomizationOverrides,
} from "@/lib/text-customization-store";

async function requireSuperAdminApiProfile() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json(
      { error: "Sign in to access System Settings." },
      { status: 401 },
    );
  }

  if (!isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can access System Settings." },
      { status: 403 },
    );
  }

  return currentProfile;
}

export async function GET() {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const [state, catalog] = await Promise.all([
    getTextCustomizationState(),
    getStaticTextCatalog(),
  ]);

  return NextResponse.json({
    overrides: state.overrides,
    updatedAt: state.updatedAt,
    catalog,
  });
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        overrides?: Record<string, string>;
      }
    | null;

  if (!payload?.overrides || typeof payload.overrides !== "object") {
    return NextResponse.json(
      { error: "Provide the updated text overrides." },
      { status: 400 },
    );
  }

  const state = await updateTextCustomizationOverrides(payload.overrides);

  return NextResponse.json({
    ok: true,
    overrides: state.overrides,
    updatedAt: state.updatedAt,
  });
}
