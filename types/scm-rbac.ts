export type ScmStaffRoleKey =
  | "superAdmin"
  | "officeStaff"
  | "regionalManager"
  | "temporaryGigManager";

export type ScmStaffManagedRoleKey = Exclude<ScmStaffRoleKey, "temporaryGigManager">;

export interface ScmRoleDefinition {
  key: ScmStaffRoleKey;
  label: string;
  description: string;
  scopeLabel: string;
  permissions: string[];
  restrictions: string[];
}

export interface StoredScmStaffProfile {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
  passwordPlaintext?: string;
  phone: string;
  roleKey: ScmStaffRoleKey;
  country: string;
  regions: string[];
  assignedGigIds: string[];
  linkedStaffId?: string;
  linkedStaffName?: string;
  profileImageName?: string;
  profileImageUrl?: string;
  notes: string;
}

export const swedenRegionOptions = ["Stockholm", "Gothenburg", "Malmo"] as const;

export const scmStaffRoleOrder = [
  "superAdmin",
  "officeStaff",
  "regionalManager",
  "temporaryGigManager",
] as const satisfies readonly ScmStaffRoleKey[];

export const scmStaffManagedRoleOrder = [
  "superAdmin",
  "officeStaff",
  "regionalManager",
] as const satisfies readonly ScmStaffManagedRoleKey[];

export const scmRoleDefinitions: Record<ScmStaffRoleKey, ScmRoleDefinition> = {
  superAdmin: {
    key: "superAdmin",
    label: "Super Admin",
    description: "Full global access across the entire SCM platform.",
    scopeLabel: "Global",
    permissions: [
      "Manage all countries and regions",
      "Manage all users and role assignments",
      "Manage every gig, shift, and staffing flow",
      "Access contracts, policies, payroll data, and reports",
      "Modify system-wide settings and shared assets",
    ],
    restrictions: [],
  },
  officeStaff: {
    key: "officeStaff",
    label: "Office Staff",
    description: "Broad administrative access for operational and office workflows.",
    scopeLabel: "System-wide admin",
    permissions: [
      "Manage gigs and administrative workflows",
      "Share information and assets across the system",
      "Coordinate staff-facing administration",
      "Support regional teams and gig operations",
    ],
    restrictions: [
      "Cannot modify contracts",
      "Cannot modify global policy documents",
    ],
  },
  regionalManager: {
    key: "regionalManager",
    label: "Regional Manager",
    description: "Operational access limited to an assigned country and region.",
    scopeLabel: "Country and region",
    permissions: [
      "Manage all gigs and shifts in the assigned region",
      "Handle staffing and bookings for the assigned region",
      "Invite Temporary Gig Managers to specific gigs",
      "Access payroll data for the assigned region only",
    ],
    restrictions: [
      "Cannot manage countries or regions outside the assigned scope",
      "Cannot access payroll data outside the assigned region",
    ],
  },
  temporaryGigManager: {
    key: "temporaryGigManager",
    label: "Temporary Gig Manager",
    description: "Gig-specific operational role tied to one or more assigned gigs.",
    scopeLabel: "Assigned gigs only",
    permissions: [
      "Access and manage all data related to assigned gigs",
      "Operate the assigned gig on-site",
      "Coordinate shift-level gig execution",
    ],
    restrictions: [
      "No access outside the assigned gig scope",
      "No regional or global administrative access",
    ],
  },
};

export function getScmRoleDefinition(roleKey: ScmStaffRoleKey) {
  return scmRoleDefinitions[roleKey];
}

export function isManuallyManagedScmStaffRole(
  roleKey: string | null | undefined,
): roleKey is ScmStaffManagedRoleKey {
  return (
    roleKey === "superAdmin" ||
    roleKey === "officeStaff" ||
    roleKey === "regionalManager"
  );
}

export function hasAllSwedenRegions(regions: string[]) {
  return swedenRegionOptions.every((region) => regions.includes(region));
}

export function getRegionalManagerRegionSummary(country: string, regions: string[]) {
  if (country !== "Sweden") {
    return "";
  }

  if (hasAllSwedenRegions(regions)) {
    return "All regions";
  }

  return regions.join(", ");
}
