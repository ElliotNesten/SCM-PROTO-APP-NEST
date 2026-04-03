"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

export function DashboardFilterButton() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  if (pathname !== "/dashboard") return null;

  const isOpen = searchParams.get("fp") === "1";
  const hasFilters =
    (searchParams.get("country") && searchParams.get("country") !== "all") ||
    (searchParams.get("city") && searchParams.get("city") !== "all") ||
    (searchParams.get("scmRep") && searchParams.get("scmRep") !== "all") ||
    (searchParams.get("arena") && searchParams.get("arena") !== "all") ||
    (searchParams.get("artist") && searchParams.get("artist") !== "all") ||
    (searchParams.get("view") && searchParams.get("view") !== "all") ||
    (searchParams.get("range") && searchParams.get("range") !== "all") ||
    (searchParams.get("marker") && searchParams.get("marker") !== "all") ||
    searchParams.get("from") ||
    searchParams.get("to");

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (isOpen) {
      params.delete("fp");
    } else {
      params.set("fp", "1");
    }
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`header-filter-button ${isOpen || hasFilters ? "active" : ""}`}
      aria-label="Toggle filters"
      aria-expanded={isOpen}
    >
      <FilterIcon />
      <span>Filter</span>
      {hasFilters && !isOpen && <span className="header-filter-dot" />}
    </button>
  );
}
