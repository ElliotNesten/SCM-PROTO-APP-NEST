import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  getSystemCompensationSettings,
  updateSystemCompensationSettings,
} from "@/lib/system-compensation-store";
import type { CompensationRateMatrix } from "@/types/compensation";

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

  const settings = await getSystemCompensationSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        defaultHourlyRates?: Partial<CompensationRateMatrix>;
      }
    | null;

  if (!payload?.defaultHourlyRates) {
    return NextResponse.json(
      { error: "Default hourly wages are required." },
      { status: 400 },
    );
  }

  const settings = await updateSystemCompensationSettings({
    defaultHourlyRates: payload.defaultHourlyRates as CompensationRateMatrix,
  });

  return NextResponse.json({
    ok: true,
    settings,
  });
}
