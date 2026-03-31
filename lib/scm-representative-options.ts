import type { StoredStaffProfile } from "@/lib/staff-store";
import {
  getRegionalManagerRegionSummary,
  getScmRoleDefinition,
  type StoredScmStaffProfile,
} from "@/types/scm-rbac";

export type ScmRepresentativeOption = {
  id: string;
  displayName: string;
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
  left: Pick<ScmRepresentativeOption, "displayName">,
  right: Pick<ScmRepresentativeOption, "displayName">,
) {
  return left.displayName.localeCompare(right.displayName, "en", {
    sensitivity: "base",
  });
}

export function buildScmStaffRepresentativeOptions(
  profiles: Array<
    Pick<StoredScmStaffProfile, "id" | "displayName" | "email" | "country" | "regions" | "roleKey">
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
        displayName: profile.displayName,
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
    Pick<StoredStaffProfile, "id" | "displayName" | "email" | "country" | "region">
  >,
) {
  return profiles
    .map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
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
    (option) => normalizeRepresentativeDisplayName(option.displayName) === normalizedValue,
  );
}
