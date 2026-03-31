"use client";

import { useState } from "react";

import type { ScmStaffRoleKey } from "@/types/scm-rbac";

type ScmRolePermissionGuideItem = {
  label: string;
  allowed: boolean;
};

type ScmRolePermissionGuideRole = {
  key: ScmStaffRoleKey;
  label: string;
  scopeLabel: string;
  description: string;
  permissions: ScmRolePermissionGuideItem[];
};

export function ScmRolePermissionGuide({
  roles,
}: {
  roles: ScmRolePermissionGuideRole[];
}) {
  const [activeRoleKey, setActiveRoleKey] = useState<ScmStaffRoleKey | null>(null);

  const activeRole =
    roles.find((role) => role.key === activeRoleKey) ??
    null;

  return (
    <div className="scm-staff-role-guide-dropdown">
      <div className="route-tabs scm-staff-role-guide-tabs" aria-label="Permission role selector">
        {roles.map((role) => (
          <button
            key={role.key}
            type="button"
            className={`route-tab scm-staff-role-guide-tab ${
              role.key === activeRoleKey ? "active" : ""
            }`}
            onClick={() =>
              setActiveRoleKey((current) => (current === role.key ? null : role.key))
            }
          >
            {role.label}
          </button>
        ))}
      </div>

      {activeRole ? (
        <div className="scm-staff-role-guide-panel">
          <div className="scm-staff-role-guide-head">
            <div>
              <strong>{activeRole.label}</strong>
              <span>{activeRole.scopeLabel}</span>
            </div>
          </div>

          <p className="small-text scm-staff-role-guide-description">
            {activeRole.description}
          </p>

          <ul className="scm-staff-role-guide-checklist">
            {activeRole.permissions.map((item) => (
              <li key={`${activeRole.key}-${item.label}`}>
                <span
                  className={`scm-staff-role-guide-check ${
                    item.allowed ? "allowed" : "blocked"
                  }`}
                  aria-hidden="true"
                >
                  {item.allowed ? "x" : ""}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
