"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { equipmentOptions } from "@/data/equipment-options";
import {
  assignStoredGigTemporaryManager,
  createStoredGig,
  updateStoredGigProjectManager,
} from "@/lib/gig-store";
import {
  buildScmStaffRepresentativeOptions,
  hasRepresentativeOptionDisplayName,
} from "@/lib/scm-representative-options";
import { normalizeScandinavianCountry } from "@/lib/scandinavian-countries";
import { getAllStoredScmStaffProfiles } from "@/lib/scm-staff-store";
import { ensureStaffAppAccountForLinkedStaffProfile } from "@/lib/staff-app-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import type { GigStatus } from "@/types/scm";

const DEFAULT_GIG_START_TIME = "16:00";
const DEFAULT_GIG_END_TIME = "23:00";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string) {
  const value = Number(readString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

function readEquipment(formData: FormData) {
  return equipmentOptions
    .map((item) => ({
      key: item.key,
      label: item.label,
      quantity: readNumber(formData, `equipment.${item.key}`),
    }))
    .filter((item) => item.quantity > 0);
}

export async function submitNewGig(formData: FormData) {
  const intent = readString(formData, "intent");
  const status: GigStatus = "Identified";
  const country = normalizeScandinavianCountry(readString(formData, "country"));
  const selectedTemporaryGigManagerStaffProfileId = readString(
    formData,
    "scmRepresentativeTemporaryGigManagerStaffProfileId",
  );

  if (!country) {
    redirect("/gigs/new");
  }

  const requestedScmRepresentative = readString(formData, "scmRepresentative");
  const scmStaffRepresentativeOptions = buildScmStaffRepresentativeOptions(
    await getAllStoredScmStaffProfiles(),
  );
  const selectedTemporaryGigManagerProfile = selectedTemporaryGigManagerStaffProfileId
    ? await getStoredStaffProfileById(selectedTemporaryGigManagerStaffProfileId)
    : null;
  const resolvedScmRepresentative = selectedTemporaryGigManagerProfile
    ? `${selectedTemporaryGigManagerProfile.firstName} ${selectedTemporaryGigManagerProfile.lastName}`
    : hasRepresentativeOptionDisplayName(
          scmStaffRepresentativeOptions,
          requestedScmRepresentative,
        )
      ? requestedScmRepresentative
      : "";

  if (
    requestedScmRepresentative &&
    !selectedTemporaryGigManagerProfile &&
    !resolvedScmRepresentative
  ) {
    redirect("/gigs/new");
  }

  let createdGig = await createStoredGig({
    artist: readString(formData, "artist"),
    arena: readString(formData, "arena"),
    city: readString(formData, "city"),
    country,
    date: readString(formData, "date"),
    startTime: DEFAULT_GIG_START_TIME,
    endTime: DEFAULT_GIG_END_TIME,
    promoter: readString(formData, "promoter"),
    merchCompany: readString(formData, "merchCompany"),
    merchRepresentative: readString(formData, "merchRepresentative"),
    scmRepresentative: resolvedScmRepresentative,
    projectManager: "",
    ticketsSold: readNumber(formData, "ticketsSold"),
    estimatedSpendPerVisitor: readNumber(formData, "estimatedSpendPerVisitor"),
    arenaNotes: readString(formData, "arenaNotes"),
    securitySetup: readString(formData, "securitySetup"),
    generalComments: readString(formData, "generalComments"),
    equipment: readEquipment(formData),
    status,
  });

  if (selectedTemporaryGigManagerProfile) {
    await ensureStaffAppAccountForLinkedStaffProfile({
      id: selectedTemporaryGigManagerProfile.id,
      firstName: selectedTemporaryGigManagerProfile.firstName,
      lastName: selectedTemporaryGigManagerProfile.lastName,
      email: selectedTemporaryGigManagerProfile.email,
      phone: selectedTemporaryGigManagerProfile.phone,
      country: selectedTemporaryGigManagerProfile.country,
      region: selectedTemporaryGigManagerProfile.region,
      roleProfiles: selectedTemporaryGigManagerProfile.roleProfiles,
      roles: selectedTemporaryGigManagerProfile.roles,
      priority: selectedTemporaryGigManagerProfile.priority,
      profileImageUrl: selectedTemporaryGigManagerProfile.profileImageUrl,
    });

    const updatedGig = await assignStoredGigTemporaryManager(
      createdGig.id,
      selectedTemporaryGigManagerProfile.id,
    );

    if (updatedGig) {
      createdGig = updatedGig;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/gigs");
  revalidatePath(`/gigs/${createdGig.id}`);

  if (intent === "draft") {
    redirect("/dashboard");
  }

  redirect(`/gigs/new?projectManagerGigId=${createdGig.id}`);
}

export async function saveProjectManagerStep(formData: FormData) {
  const gigId = readString(formData, "gigId");
  const projectManager = readString(formData, "projectManager");

  if (!gigId || !projectManager) {
    redirect("/gigs");
  }

  const updatedGig = await updateStoredGigProjectManager(gigId, projectManager);

  if (!updatedGig) {
    redirect("/gigs");
  }

  revalidatePath("/dashboard");
  revalidatePath("/gigs");
  revalidatePath(`/gigs/${gigId}`);

  redirect(`/gigs/${gigId}`);
}
