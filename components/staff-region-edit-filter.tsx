"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StaffRegionEditFilterProps = {
  options: string[];
  activeRegion: string;
};

export function StaffRegionEditFilter({
  options,
  activeRegion,
}: StaffRegionEditFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const sortedOptions = useMemo(
    () => [...options].sort((left, right) => left.localeCompare(right)),
    [options],
  );

  function updateRegion(nextRegion: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!nextRegion) {
      params.delete("region");
    } else {
      params.set("region", nextRegion);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  return (
    <div className="staff-region-edit-filter">
      <button
        type="button"
        className={`chip chip-soft staff-region-edit-trigger${open ? " active" : ""}${activeRegion && !["Stockholm", "Gothenburg", "Malmo"].includes(activeRegion) ? " selected" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        Edit
      </button>

      {open ? (
        <div className="staff-region-edit-dropdown">
          <label className="staff-region-edit-field">
            <span className="small-text">Select region</span>
            <select
              value={activeRegion}
              onChange={(event) => updateRegion(event.currentTarget.value)}
            >
              <option value="">All regions</option>
              {sortedOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "Gothenburg"
                    ? "Göteborg"
                    : option === "Malmo"
                      ? "Malmö"
                      : option}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
