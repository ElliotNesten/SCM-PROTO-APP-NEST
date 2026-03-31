import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  getSystemPdfTemplates,
  isShiftPdfTemplateId,
  updateSystemPdfTemplate,
} from "@/lib/system-template-store";
import {
  normalizeShiftPdfTemplate,
  shiftPdfPlaceholderOrder,
  type ShiftPdfPlaceholderKey,
  type ShiftPdfTemplate,
} from "@/types/system-settings";

function isAllowedPlaceholderKey(value: string): value is ShiftPdfPlaceholderKey {
  return shiftPdfPlaceholderOrder.includes(value as ShiftPdfPlaceholderKey);
}

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

  const state = await getSystemPdfTemplates();

  return NextResponse.json({
    templates: state.templates,
  });
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        templateId?: string;
        template?: Partial<ShiftPdfTemplate>;
      }
    | null;

  if (!payload?.templateId || !isShiftPdfTemplateId(payload.templateId)) {
    return NextResponse.json({ error: "Choose a valid template." }, { status: 400 });
  }

  const rawTemplate = payload.template;

  if (!rawTemplate) {
    return NextResponse.json({ error: "Template data is required." }, { status: 400 });
  }

  const nextTemplate = normalizeShiftPdfTemplate({
    id: payload.templateId,
    label: rawTemplate.label?.trim() || "",
    description: rawTemplate.description?.trim() || "",
    title: rawTemplate.title?.trim() || "",
    intro: rawTemplate.intro?.trim() || "",
    footer: rawTemplate.footer?.trim() || "",
    enabledPlaceholders: (rawTemplate.enabledPlaceholders ?? []).filter(
      (placeholderKey): placeholderKey is ShiftPdfPlaceholderKey =>
        typeof placeholderKey === "string" && isAllowedPlaceholderKey(placeholderKey),
    ),
  });

  const savedTemplate = await updateSystemPdfTemplate(payload.templateId, nextTemplate);

  return NextResponse.json({
    ok: true,
    template: savedTemplate,
  });
}
