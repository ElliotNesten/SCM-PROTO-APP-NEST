import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { canManagePlatformFieldStaffProfile } from "@/lib/platform-access";
import { buildStaffDocumentPdf } from "@/lib/staff-document-pdf";
import { getStoredStaffDocumentById } from "@/lib/staff-document-store";
import { getCurrentStaffAppAccount } from "@/lib/staff-app-session";
import { getStoredStaffProfileById } from "@/lib/staff-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { personId, documentId } = await context.params;
  const [document, profile, currentScmProfile, currentStaffAppAccount] = await Promise.all([
    getStoredStaffDocumentById(personId, documentId),
    getStoredStaffProfileById(personId),
    getCurrentAuthenticatedScmStaffProfile(),
    getCurrentStaffAppAccount(),
  ]);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!currentScmProfile && !currentStaffAppAccount) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const canAccessAsSelf =
    currentStaffAppAccount?.linkedStaffProfileId?.trim() === personId;
  const canAccessAsScm =
    Boolean(profile) && canManagePlatformFieldStaffProfile(currentScmProfile, profile);

  if (!canAccessAsSelf && !canAccessAsScm) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const pdfBuffer = await buildStaffDocumentPdf(document);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Content-Length": String(pdfBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
