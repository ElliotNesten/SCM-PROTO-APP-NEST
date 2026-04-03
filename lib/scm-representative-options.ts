import type { StoredStaffProfile } from "@/lib/staff-store";
import {
  getRegionalManagerRegionSummary,
  getScmRoleDefinition,
  type StoredScmStaffProfile,
} from "@/types/scm-rbac";

export type ScmRepresentativeOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  region: string;
  badge: string;
  detail: string;
};

function normalizeRepresentativeDisplayName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compareOptionDisplayName(
  left: Pick<ScmRepresentativeOption, "firstName" | "lastName">,
  right: Pick<ScmRepresentativeOption, "firstName" | "lastName">,
) {
  return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`, "en", {
    sensitivity: "base",
  });
}

export function buildScmStaffRepresentativeOptions(
  profiles: Array<
    Pick<StoredScmStaffProfile, "id" | "firstName" | "lastName" | "email" | "country" | "regions" | "roleKey">
  >,
) {
  return profiles
    .filter((profile) => profile.roleKey !== "temporaryGigManager")
    .map((profile) => {
      const roleDefinition = getScmRoleDefinition(profile.roleKey);
      const scopeLabel =
        profile.roleKey === "regionalManager"
          ? getRegionalManagerRegionSummary(profile.country, profile.regions) || profile.country
          : roleDefinition.scopeLabel;
      const detail = Array.from(new Set([profile.country, scopeLabel].filter(Boolean))).join(
        " | ",
      );

      return {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        country: profile.country,
        region: scopeLabel,
        badge: roleDefinition.label,
        detail,
      } satisfies ScmRepresentativeOption;
    })
    .sort(compareOptionDisplayName);
}

export function buildTemporaryGigManagerOptions(
  profiles: Array<
    Pick<StoredStaffProfile, "id" | "firstName" | "lastName" | "email" | "country" | "region">
  >,
) {
  return profiles
    .map((profile) => ({
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      country: profile.country,
      region: profile.region,
      badge: "Staff Profile",
      detail: [profile.region, profile.country].filter(Boolean).join(", "),
    }))
    .sort(compareOptionDisplayName);
}

export function hasRepresentativeOptionDisplayName(
  options: readonly ScmRepresentativeOption[],
  value: string,
) {
  const normalizedValue = normalizeRepresentativeDisplayName(value);

  if (!normalizedValue) {
    return false;
  }

  return options.some(
    (option) => normalizeRepresentativeDisplayName(`${option.firstName} ${option.lastName}`) === normalizedValue,
  );
}
