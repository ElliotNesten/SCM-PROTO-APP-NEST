import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  getApprovedApplicationEmailTemplate,
  updateApprovedApplicationEmailTemplate,
} from "@/lib/system-email-template-store";
import type { StaffApplicationApprovalEmailTemplate } from "@/types/job-applications";

async function requireSuperAdminApiProfile() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Sign in to access System Settings." }, { status: 401 });
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

  return NextResponse.json({
    template: await getApprovedApplicationEmailTemplate(),
  });
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        template?: Partial<StaffApplicationApprovalEmailTemplate>;
      }
    | null;

  if (!payload?.template) {
    return NextResponse.json({ error: "Template data is required." }, { status: 400 });
  }

  const currentTemplate = await getApprovedApplicationEmailTemplate();
  const nextTemplate: StaffApplicationApprovalEmailTemplate = {
    ...currentTemplate,
    ...payload.template,
    id: "approvedApplication",
  };

  const savedTemplate = await updateApprovedApplicationEmailTemplate(nextTemplate);

  return NextResponse.json({
    ok: true,
    template: savedTemplate,
  });
}
