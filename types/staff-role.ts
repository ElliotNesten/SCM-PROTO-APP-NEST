export const staffRoleKeys = [
  "Seller",
  "Stand Leader",
  "Runner",
  "Other",
] as const;

export type StaffRoleKey = (typeof staffRoleKeys)[number];

export type StoredStaffRoleProfile = {
  enabled: boolean;
  priority: number;
  comment: string;
  hourlyRateOverride?: number | null;
};

export type StoredStaffRoleProfiles = Record<StaffRoleKey, StoredStaffRoleProfile>;
