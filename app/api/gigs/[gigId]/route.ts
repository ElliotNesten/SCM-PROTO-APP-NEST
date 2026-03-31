import { promises as fs } from "fs";
import path from "path";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resolveGigOverviewIndicator } from "@/data/scm-data";
import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { isGigArchived } from "@/lib/gig-archive";
import { deleteStoredGig, getStoredGigById, updateStoredGigOverview } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import {
  buildScmStaffRepresentativeOptions,
  buildTemporaryGigManagerOptions,
  hasRepresentativeOptionDisplayName,
} from "@/lib/scm-representative-options";
import { isScandinavianCountry } from "@/lib/scandinavian-countries";
import { getAllStoredScmStaffProfiles } from "@/lib/scm-staff-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import { deleteStoredShiftCommunication } from "@/lib/shift-communication-store";
import { deleteStoredGigShifts, getStoredGigShifts } from "@/lib/shift-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

type OverviewPayload = {
  artist?: string;
  arena?: string;
  city?: string;
  country?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  promoter?: string;
  merchCompany?: string;
  merchRepresentative?: string;
  scmRepresentative?: string;
  projectManager?: string;
  notes?: string;
  ticketsSold?: number;
  estimatedSpendPerVisitor?: number;
  arenaNotes?: string;
  securitySetup?: string;
  generalComments?: string;
  customNoteFields?: Array<{
    id?: string;
    title?: string;
    body?: string;
  }>;
  overviewIndicator?: "identified" | "inProgress" | "confirmed" | "noMerch";
};

const publicRootDirectory = path.join(process.cwd(), "public");
const gigFilesRootDirectory = path.join(publicRootDirectory, "gig-files");
const gigImagesRootDirectory = path.join(publicRootDirectory, "gig-images");

async function deleteGigAssetDirectory(rootDirectory: string, gigId: string) {
  const normalizedRoot = path.resolve(rootDirectory);
  const normalizedTarget = path.resolve(path.join(rootDirectory, gigId));

  if (
    normalizedTarget !== normalizedRoot &&
    !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return;
  }

  await fs.rm(normalizedTarget, { recursive: true, force: true });
}

function revalidateGigPaths(gigId: string) {
  revalidatePath("/gigs");
  revalidatePath("/dashboard");
  revalidatePath(`/gigs/${gigId}`);
  revalidatePath("/staff-app/gigs");
  revalidatePath("/staff-app/gigs/open");
  revalidatePath("/staff-app/gigs/standby");
  revalidatePath("/staff-app/gigs/unassigned");
  revalidatePath("/staff-app/home");
  revalidatePath("/staff-app/schedule");
  revalidatePath("/staff-app/check-in");
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const payload = (await request.json().catch(() => null)) as OverviewPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Missing gig overview payload." }, { status: 400 });
  }

  const existingGig = await getStoredGigById(gigId);

  if (!existingGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const currentScmStaffProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentScmStaffProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessPlatformGig(currentScmStaffProfile, existingGig)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const currentRoleKey = currentScmStaffProfile?.roleKey;
  const canEditAllCoreDetails =
    currentRoleKey === "superAdmin" || currentRoleKey === "officeStaff";
  const canEditRegionalManagerCoreFields = currentRoleKey === "regionalManager";

  if (
    payload.country !== undefined &&
    !isScandinavianCountry(payload.country.trim())
  ) {
    return NextResponse.json(
      { error: "Country must be Sweden, Norway, Denmark, or Finland." },
      { status: 400 },
    );
  }

  if (
    payload.scmRepresentative !== undefined &&
    (canEditAllCoreDetails || canEditRegionalManagerCoreFields)
  ) {
    const requestedScmRepresentative = payload.scmRepresentative.trim();

    if (
      requestedScmRepresentative &&
      requestedScmRepresentative !== existingGig.scmRepresentative
    ) {
      const [scmStaffProfiles, staffProfiles] = await Promise.all([
        getAllStoredScmStaffProfiles(),
        getAllStoredStaffProfiles(),
      ]);
      const scmStaffRepresentativeOptions =
        buildScmStaffRepresentativeOptions(scmStaffProfiles);
      const temporaryGigManagerOptions = buildTemporaryGigManagerOptions(staffProfiles);
      const isAllowedRepresentative =
        hasRepresentativeOptionDisplayName(
          scmStaffRepresentativeOptions,
          requestedScmRepresentative,
        ) ||
        hasRepresentativeOptionDisplayName(
          temporaryGigManagerOptions,
          requestedScmRepresentative,
        );

      if (!isAllowedRepresentative) {
        return NextResponse.json(
          { error: "SCM representative must be selected from an existing profile." },
          { status: 400 },
        );
      }
    }
  }

  const updatedGig = await updateStoredGigOverview(gigId, {
    artist: canEditAllCoreDetails ? (payload.artist ?? existingGig.artist) : existingGig.artist,
    arena: canEditAllCoreDetails ? (payload.arena ?? existingGig.arena) : existingGig.arena,
    city: canEditAllCoreDetails ? (payload.city ?? existingGig.city) : existingGig.city,
    country: canEditAllCoreDetails
      ? (payload.country ?? existingGig.country)
      : existingGig.country,
    date: canEditAllCoreDetails ? (payload.date ?? existingGig.date) : existingGig.date,
    startTime: canEditAllCoreDetails
      ? (payload.startTime ?? existingGig.startTime)
      : existingGig.startTime,
    endTime: canEditAllCoreDetails
      ? (payload.endTime ?? existingGig.endTime)
      : existingGig.endTime,
    promoter: canEditAllCoreDetails
      ? (payload.promoter ?? existingGig.promoter)
      : existingGig.promoter,
    merchCompany: canEditAllCoreDetails
      ? (payload.merchCompany ?? existingGig.merchCompany)
      : existingGig.merchCompany,
    merchRepresentative: canEditAllCoreDetails
      ? (payload.merchRepresentative ?? existingGig.merchRepresentative)
      : existingGig.merchRepresentative,
    scmRepresentative:
      canEditAllCoreDetails || canEditRegionalManagerCoreFields
        ? (payload.scmRepresentative ?? existingGig.scmRepresentative)
        : existingGig.scmRepresentative,
    projectManager: canEditAllCoreDetails
      ? (payload.projectManager ?? (existingGig.projectManager ?? ""))
      : (existingGig.projectManager ?? ""),
    notes: payload.notes ?? existingGig.notes,
    ticketsSold: Number(
      canEditAllCoreDetails || canEditRegionalManagerCoreFields
        ? (payload.ticketsSold ?? existingGig.ticketsSold)
        : existingGig.ticketsSold,
    ),
    estimatedSpendPerVisitor: Number(
      canEditAllCoreDetails || canEditRegionalManagerCoreFields
        ? (payload.estimatedSpendPerVisitor ?? existingGig.estimatedSpendPerVisitor)
        : existingGig.estimatedSpendPerVisitor,
    ),
    arenaNotes: payload.arenaNotes ?? (existingGig.arenaNotes ?? ""),
    securitySetup: payload.securitySetup ?? (existingGig.securitySetup ?? ""),
    generalComments: payload.generalComments ?? (existingGig.generalComments ?? ""),
    customNoteFields: Array.isArray(payload.customNoteFields)
      ? payload.customNoteFields.map((item, index) => ({
          id: item.id ?? `custom-note-${index + 1}`,
          title: item.title ?? "",
          body: item.body ?? "",
        }))
      : (existingGig.customNoteFields ?? []),
    overviewIndicator:
      payload.overviewIndicator ??
      existingGig.overviewIndicator ??
      resolveGigOverviewIndicator(existingGig),
  });

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  if (
    existingGig.overviewIndicator !== "noMerch" &&
    updatedGig.overviewIndicator === "noMerch"
  ) {
    await getStoredGigShifts(gigId);
  }

  revalidateGigPaths(gigId);

  return NextResponse.json({ ok: true, gig: updatedGig });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const existingGig = await getStoredGigById(gigId);

  if (!existingGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const currentScmStaffProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentScmStaffProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentScmStaffProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can permanently delete gigs." },
      { status: 403 },
    );
  }

  if (!isGigArchived(existingGig)) {
    return NextResponse.json(
      { error: "Only archived gigs can be permanently deleted." },
      { status: 400 },
    );
  }

  const deletedGig = await deleteStoredGig(gigId);

  if (!deletedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  await Promise.all([
    deleteStoredGigShifts(gigId),
    deleteStoredShiftCommunication(gigId),
    deleteGigAssetDirectory(gigFilesRootDirectory, gigId),
    deleteGigAssetDirectory(gigImagesRootDirectory, gigId),
  ]);

  revalidateGigPaths(gigId);
  revalidatePath("/staff-app/gigs/managed");

  return NextResponse.json({ ok: true, deletedGigId: deletedGig.id });
}
