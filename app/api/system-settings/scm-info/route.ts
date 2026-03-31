import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  getSystemScmInfoSettings,
  updateSystemScmInfoSettings,
  type StaffAppScmInfoSettings,
} from "@/lib/system-scm-info-store";

async function requireSuperAdminApiProfile() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Sign in to access System Settings." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can access SCM info settings." },
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

  const settings = await getSystemScmInfoSettings();

  return NextResponse.json({
    settings,
  });
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        settings?: Partial<StaffAppScmInfoSettings>;
      }
    | null;

  if (!payload?.settings) {
    return NextResponse.json({ error: "SCM info settings are required." }, { status: 400 });
  }

  const settings = await updateSystemScmInfoSettings(payload.settings);

  return NextResponse.json({
    ok: true,
    settings,
  });
}
