import path from "node:path";

import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { deleteStoredPublicUpload } from "@/lib/public-file-storage";
import {
  getSystemScmInfoSettings,
  updateSystemScmInfoSettings,
  type StaffAppScmInfoSettings,
} from "@/lib/system-scm-info-store";

const publicRootDirectory = path.join(process.cwd(), "public");
const arenaDocumentRootDirectory = path.join(publicRootDirectory, "system-scm-arena-documents");

function collectArenaDocumentUrls(settings: StaffAppScmInfoSettings) {
  return new Set(
    settings.arenaInfo.catalog.flatMap((arena) =>
      Object.values(arena.documents)
        .map((document) => document.pdfUrl)
        .filter(Boolean),
    ),
  );
}

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

  const previousSettings = await getSystemScmInfoSettings();
  const settings = await updateSystemScmInfoSettings(payload.settings);
  const previousUrls = collectArenaDocumentUrls(previousSettings);
  const nextUrls = collectArenaDocumentUrls(settings);

  await Promise.allSettled(
    Array.from(previousUrls)
      .filter((fileUrl) => !nextUrls.has(fileUrl))
      .map((fileUrl) =>
        deleteStoredPublicUpload({
          fileUrl,
          localUrlPrefix: "/system-scm-arena-documents/",
          localRootDirectory: arenaDocumentRootDirectory,
        }),
      ),
  );

  return NextResponse.json({
    ok: true,
    settings,
  });
}
