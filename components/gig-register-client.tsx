"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { resolveGigOverviewIndicator } from "@/data/scm-data";
import {
  isGigArchivedForRegister,
  isGigArchivedOnlyForRegister,
  resolveGigRegisterSection,
} from "@/lib/gig-archive";
import type { Gig, GigOverviewIndicator } from "@/types/scm";

const shortMonthLabels: Record<string, string> = {
  "01": "jan",
  "02": "feb",
  "03": "mar",
  "04": "apr",
  "05": "maj",
  "06": "jun",
  "07": "jul",
  "08": "aug",
  "09": "sep",
  "10": "okt",
  "11": "nov",
  "12": "dec",
};

function formatGigRegisterDate(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  const monthLabel = shortMonthLabels[month];

  if (!monthLabel) {
    return date;
  }

  return `${day}-${monthLabel}`;
}

function getOrtLabel(gig: Gig) {
  const cityLabel = gig.city.trim();

  if (cityLabel) {
    return cityLabel;
  }

  const countryCode = {
    Sweden: "SE",
    Norway: "NO",
    Denmark: "DK",
    Finland: "FI",
  }[gig.country];

  const cityCode = {
    stockholm: "STHLM",
    gothenburg: "GBG",
    malmo: "MALMO",
    malmö: "MALMO",
  }[gig.city.trim().toLowerCase()];

  if (gig.country === "Sweden" && cityCode) {
    return cityCode;
  }

  return countryCode ?? gig.country;
}

function getMarkerLabel(value: GigOverviewIndicator) {
  if (value === "identified") {
    return "Identified";
  }

  if (value === "confirmed") {
    return "Confirmed";
  }

  if (value === "noMerch") {
    return "No merch";
  }

  return "In Progress";
}

type EditableRegisterField =
  | "merchCompany"
  | "merchRepresentative"
  | "scmRepresentative"
  | "projectManager";
type RegisterViewMode = "active" | "toBeClosed" | "closed" | "archived";
type RegisterCountryFilter = "all" | "Sweden" | "Norway" | "Denmark" | "Finland";
type DateFilterMode = "all" | "range" | "month";
type RegisterColumnFilterKey =
  | "artist"
  | "arena"
  | "city"
  | "country"
  | "promoter"
  | "merchCompany"
  | "merchRepresentative"
  | "scmRepresentative"
  | "projectManager"
  | "progress";
type RegisterGridColumnKey = "date" | RegisterColumnFilterKey;
type RegisterColumnFilterValue = "" | "__empty__" | string;
type RegisterColumnFilters = Record<RegisterColumnFilterKey, RegisterColumnFilterValue>;
type RegisterColumnWidthOverrides = Partial<Record<RegisterGridColumnKey, number>>;

const registerDateColumn = {
  key: "date" as const,
  label: "DATE",
  minimumWidth: 8,
  maximumWidth: 10,
  extraWidth: 1,
  resizeMinimumWidth: 6,
  resizeMaximumWidth: 14,
};

const gigRegisterResizeChUnit = 8;

const registerColumns: Array<{
  key: RegisterColumnFilterKey;
  label: string;
  allLabel: string;
  minimumWidth: number;
  maximumWidth: number;
  extraWidth?: number;
  resizeMinimumWidth: number;
  resizeMaximumWidth: number;
}> = [
  {
    key: "artist",
    label: "ARTIST",
    allLabel: "ALL",
    minimumWidth: 12,
    maximumWidth: 18,
    resizeMinimumWidth: 9,
    resizeMaximumWidth: 28,
  },
  {
    key: "arena",
    label: "ARENA",
    allLabel: "ALL",
    minimumWidth: 13,
    maximumWidth: 18,
    resizeMinimumWidth: 10,
    resizeMaximumWidth: 28,
  },
  {
    key: "city",
    label: "CITY",
    allLabel: "ALL",
    minimumWidth: 10,
    maximumWidth: 14,
    resizeMinimumWidth: 8,
    resizeMaximumWidth: 22,
  },
  {
    key: "country",
    label: "COUNTRY",
    allLabel: "ALL",
    minimumWidth: 10,
    maximumWidth: 12,
    resizeMinimumWidth: 8,
    resizeMaximumWidth: 18,
  },
  {
    key: "promoter",
    label: "PROMOTOR",
    allLabel: "ALL",
    minimumWidth: 12,
    maximumWidth: 16,
    resizeMinimumWidth: 9,
    resizeMaximumWidth: 24,
  },
  {
    key: "merchCompany",
    label: "M B",
    allLabel: "ALL",
    minimumWidth: 7,
    maximumWidth: 12,
    resizeMinimumWidth: 6,
    resizeMaximumWidth: 18,
  },
  {
    key: "merchRepresentative",
    label: "M.REP",
    allLabel: "ALL",
    minimumWidth: 9,
    maximumWidth: 14,
    resizeMinimumWidth: 7,
    resizeMaximumWidth: 20,
  },
  {
    key: "scmRepresentative",
    label: "SCM REP",
    allLabel: "ALL",
    minimumWidth: 9,
    maximumWidth: 13,
    resizeMinimumWidth: 7,
    resizeMaximumWidth: 20,
  },
  {
    key: "projectManager",
    label: "P.M",
    allLabel: "ALL",
    minimumWidth: 7,
    maximumWidth: 10,
    resizeMinimumWidth: 6,
    resizeMaximumWidth: 16,
  },
  {
    key: "progress",
    label: "PROGRESS",
    allLabel: "ALL",
    minimumWidth: 12,
    maximumWidth: 14,
    resizeMinimumWidth: 10,
    resizeMaximumWidth: 18,
  },
];

const emptyRegisterColumnFilters: RegisterColumnFilters = {
  artist: "",
  arena: "",
  city: "",
  country: "",
  promoter: "",
  merchCompany: "",
  merchRepresentative: "",
  scmRepresentative: "",
  projectManager: "",
  progress: "",
};

function createInitialColumnFilters(
  initialCountryFilter: RegisterCountryFilter,
): RegisterColumnFilters {
  return {
    ...emptyRegisterColumnFilters,
    country: initialCountryFilter === "all" ? "" : initialCountryFilter,
  };
}

const dateMonthOptions = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
] as const;

const progressOptions: Array<{
  value: GigOverviewIndicator;
  label: string;
}> = [
  { value: "identified", label: "Identified" },
  { value: "inProgress", label: "In Progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "noMerch", label: "No merch" },
];

function getColumnValue(gig: Gig, key: RegisterColumnFilterKey) {
  switch (key) {
    case "artist":
      return gig.artist;
    case "arena":
      return gig.arena;
    case "city":
      return getOrtLabel(gig);
    case "country":
      return gig.country;
    case "promoter":
      return gig.promoter;
    case "merchCompany":
      return gig.merchCompany;
    case "merchRepresentative":
      return gig.merchRepresentative;
    case "scmRepresentative":
      return gig.scmRepresentative;
    case "projectManager":
      return gig.projectManager ?? "";
    case "progress":
      return getMarkerLabel(resolveGigOverviewIndicator(gig));
    default:
      return "";
  }
}

function normalizeFilterOptionValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : "__empty__";
}

function getFilterOptions(gigs: Gig[], key: RegisterColumnFilterKey) {
  const seen = new Set<string>();

  return gigs.flatMap((gig) => {
    const rawValue = getColumnValue(gig, key);
    const optionValue = normalizeFilterOptionValue(rawValue);

    if (seen.has(optionValue)) {
      return [];
    }

    seen.add(optionValue);

    return [
      {
        value: optionValue,
        label: rawValue.trim() || "-",
      },
    ];
  });
}

function getDateFilterSummary(
  mode: DateFilterMode,
  startDate: string,
  endDate: string,
  monthValue: string,
) {
  if (mode === "month" && monthValue) {
    return dateMonthOptions.find((option) => option.value === monthValue)?.label ?? "Month";
  }

  if (mode === "range" && (startDate || endDate)) {
    if (startDate && endDate) {
      return `${formatGigRegisterDate(startDate)} - ${formatGigRegisterDate(endDate)}`;
    }

    if (startDate) {
      return `From ${formatGigRegisterDate(startDate)}`;
    }

    if (endDate) {
      return `Until ${formatGigRegisterDate(endDate)}`;
    }
  }

  return "ALL";
}

function matchesDateFilter(
  gigDate: string,
  mode: DateFilterMode,
  startDate: string,
  endDate: string,
  monthValue: string,
) {
  if (mode === "month") {
    return !monthValue || gigDate.slice(5, 7) === monthValue;
  }

  if (mode === "range") {
    if (startDate && gigDate < startDate) {
      return false;
    }

    if (endDate && gigDate > endDate) {
      return false;
    }
  }

  return true;
}

function resolveGigRegisterColumnWidth(
  values: string[],
  minimumWidth: number,
  maximumWidth: number,
  extraWidth = 3,
) {
  const longestValue = values.reduce((longest, value) => {
    return Math.max(longest, value.trim().length);
  }, 0);
  return Math.max(minimumWidth, Math.min(longestValue + extraWidth, maximumWidth));
}

function getGigRegisterGridColumnWidths(gigs: Gig[]) {
  return {
    date: resolveGigRegisterColumnWidth(
      ["DATE", "ALL", ...gigs.map((gig) => formatGigRegisterDate(gig.date))],
      registerDateColumn.minimumWidth,
      registerDateColumn.maximumWidth,
      registerDateColumn.extraWidth,
    ),
    artist: resolveGigRegisterColumnWidth(
      ["ARTIST", "ALL", ...gigs.map((gig) => gig.artist)],
      registerColumns[0].minimumWidth,
      registerColumns[0].maximumWidth,
      registerColumns[0].extraWidth,
    ),
    arena: resolveGigRegisterColumnWidth(
      ["ARENA", "ALL", ...gigs.map((gig) => gig.arena)],
      registerColumns[1].minimumWidth,
      registerColumns[1].maximumWidth,
      registerColumns[1].extraWidth,
    ),
    city: resolveGigRegisterColumnWidth(
      ["CITY", "ALL", ...gigs.map((gig) => getOrtLabel(gig) || "-")],
      registerColumns[2].minimumWidth,
      registerColumns[2].maximumWidth,
      registerColumns[2].extraWidth,
    ),
    country: resolveGigRegisterColumnWidth(
      ["COUNTRY", "ALL", ...gigs.map((gig) => gig.country || "-")],
      registerColumns[3].minimumWidth,
      registerColumns[3].maximumWidth,
      registerColumns[3].extraWidth,
    ),
    promoter: resolveGigRegisterColumnWidth(
      ["PROMOTOR", "ALL", ...gigs.map((gig) => gig.promoter || "-")],
      registerColumns[4].minimumWidth,
      registerColumns[4].maximumWidth,
      registerColumns[4].extraWidth,
    ),
    merchCompany: resolveGigRegisterColumnWidth(
      ["M B", "ALL", ...gigs.map((gig) => gig.merchCompany || "-")],
      registerColumns[5].minimumWidth,
      registerColumns[5].maximumWidth,
      registerColumns[5].extraWidth,
    ),
    merchRepresentative: resolveGigRegisterColumnWidth(
      ["M.REP", "ALL", ...gigs.map((gig) => gig.merchRepresentative || "-")],
      registerColumns[6].minimumWidth,
      registerColumns[6].maximumWidth,
      registerColumns[6].extraWidth,
    ),
    scmRepresentative: resolveGigRegisterColumnWidth(
      ["SCM REP", "ALL", ...gigs.map((gig) => gig.scmRepresentative || "-")],
      registerColumns[7].minimumWidth,
      registerColumns[7].maximumWidth,
      registerColumns[7].extraWidth,
    ),
    projectManager: resolveGigRegisterColumnWidth(
      ["P.M", "ALL", ...gigs.map((gig) => gig.projectManager || "-")],
      registerColumns[8].minimumWidth,
      registerColumns[8].maximumWidth,
      registerColumns[8].extraWidth,
    ),
    progress: resolveGigRegisterColumnWidth(
      [
        "PROGRESS",
        "ALL",
        ...gigs.map((gig) => getMarkerLabel(resolveGigOverviewIndicator(gig))),
      ],
      registerColumns[9].minimumWidth,
      registerColumns[9].maximumWidth,
      registerColumns[9].extraWidth,
    ),
  } as const satisfies Record<RegisterGridColumnKey, number>;
}

function getGigRegisterGridTemplate(
  columnWidths: Record<RegisterGridColumnKey, number>,
  widthOverrides: RegisterColumnWidthOverrides,
) {
  return [
    widthOverrides.date ?? columnWidths.date,
    ...registerColumns.map((column) => widthOverrides[column.key] ?? columnWidths[column.key]),
  ]
    .map((width) => {
      const resolvedWidth = Math.round(width * 100) / 100;
      return `minmax(${resolvedWidth}ch, ${resolvedWidth}fr)`;
    })
    .join(" ");
}

export function GigRegisterClient({
  gigs,
  canCreateGig = true,
  initialViewMode = "active",
  initialCountryFilter = "all",
}: {
  gigs: Gig[];
  canCreateGig?: boolean;
  initialViewMode?: RegisterViewMode;
  initialCountryFilter?: RegisterCountryFilter;
}) {
  const router = useRouter();
  const [registerGigs, setRegisterGigs] = useState(gigs);
  const [viewMode, setViewMode] = useState<RegisterViewMode>(initialViewMode);
  const [columnFilters, setColumnFilters] = useState<RegisterColumnFilters>(
    () => createInitialColumnFilters(initialCountryFilter),
  );
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [dateMonth, setDateMonth] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [columnWidthOverrides, setColumnWidthOverrides] =
    useState<RegisterColumnWidthOverrides>({});
  const [resizingColumn, setResizingColumn] = useState<RegisterGridColumnKey | null>(null);

  const activeGigs = registerGigs.filter(
    (gig) =>
      resolveGigRegisterSection(gig) === "active" &&
      !isGigArchivedOnlyForRegister(gig),
  );
  const toBeClosedGigs = registerGigs.filter(
    (gig) => resolveGigRegisterSection(gig) === "toBeClosed",
  );
  const closedGigs = registerGigs.filter(
    (gig) => resolveGigRegisterSection(gig) === "closed",
  );
  const archivedGigs = registerGigs.filter(
    (gig) => isGigArchivedForRegister(gig),
  );
  const scopedGigs =
    viewMode === "archived"
      ? archivedGigs
      : viewMode === "closed"
        ? closedGigs
      : viewMode === "toBeClosed"
        ? toBeClosedGigs
        : activeGigs;
  const filteredGigs = scopedGigs.filter((gig) => {
    if (
      !matchesDateFilter(gig.date, dateFilterMode, dateRangeStart, dateRangeEnd, dateMonth)
    ) {
      return false;
    }

    return registerColumns.every(({ key }) => {
      const selectedValue = columnFilters[key];

      if (!selectedValue) {
        return true;
      }

      const sourceValue = getColumnValue(gig, key).trim();

      if (selectedValue === "__empty__") {
        return sourceValue === "";
      }

      return sourceValue === selectedValue;
    });
  });
  const autoColumnWidths = getGigRegisterGridColumnWidths(filteredGigs);
  const gigRegisterGridStyle = {
    "--gig-register-grid-columns": getGigRegisterGridTemplate(
      autoColumnWidths,
      columnWidthOverrides,
    ),
  } as CSSProperties;

  function resolveResizableColumnBounds(columnKey: RegisterGridColumnKey) {
    if (columnKey === registerDateColumn.key) {
      return {
        min: registerDateColumn.resizeMinimumWidth,
        max: registerDateColumn.resizeMaximumWidth,
      };
    }

    const column = registerColumns.find((item) => item.key === columnKey);

    return {
      min: column?.resizeMinimumWidth ?? 6,
      max: column?.resizeMaximumWidth ?? 28,
    };
  }

  function resetColumnWidth(columnKey: RegisterGridColumnKey) {
    setColumnWidthOverrides((current) => {
      if (!(columnKey in current)) {
        return current;
      }

      const next = { ...current };
      delete next[columnKey];
      return next;
    });
  }

  function startColumnResize(
    columnKey: RegisterGridColumnKey,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidthOverrides[columnKey] ?? autoColumnWidths[columnKey];
    const { min, max } = resolveResizableColumnBounds(columnKey);
    const ownerWindow = window;

    setResizingColumn(columnKey);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaCh = (moveEvent.clientX - startX) / gigRegisterResizeChUnit;
      const nextWidth = Math.min(
        max,
        Math.max(min, Math.round((startWidth + deltaCh) * 100) / 100),
      );

      setColumnWidthOverrides((current) => {
        if (current[columnKey] === nextWidth) {
          return current;
        }

        return {
          ...current,
          [columnKey]: nextWidth,
        };
      });
    };

    const stopResize = () => {
      setResizingColumn((current) => (current === columnKey ? null : current));
      ownerWindow.removeEventListener("pointermove", handlePointerMove);
      ownerWindow.removeEventListener("pointerup", stopResize);
      ownerWindow.removeEventListener("pointercancel", stopResize);
    };

    ownerWindow.addEventListener("pointermove", handlePointerMove);
    ownerWindow.addEventListener("pointerup", stopResize);
    ownerWindow.addEventListener("pointercancel", stopResize);
  }

  function updateColumnFilter(key: RegisterColumnFilterKey, value: RegisterColumnFilterValue) {
    setColumnFilters((current) => ({
      ...current,
      [key]: value as RegisterColumnFilterValue,
    }));
  }

  function setDateMode(mode: DateFilterMode) {
    setDateFilterMode(mode);

    if (mode === "all") {
      setDateRangeStart("");
      setDateRangeEnd("");
      setDateMonth("");
      return;
    }

    if (mode === "range") {
      setDateMonth("");
      return;
    }

    setDateRangeStart("");
    setDateRangeEnd("");
  }

  function updateRegisterField(gigId: string, field: EditableRegisterField, value: string) {
    setRegisterGigs((current) =>
      current.map((gig) => (gig.id === gigId ? { ...gig, [field]: value } : gig)),
    );
  }

  async function persistRegisterField(gigId: string, field: EditableRegisterField) {
    const gig = registerGigs.find((item) => item.id === gigId);

    if (!gig) {
      return;
    }

    const cellKey = `${gigId}:${field}`;
    setSavingCell(cellKey);

    const response = await fetch(`/api/gigs/${gigId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        [field]: String(gig[field] ?? "").trim(),
      }),
    });

    const payload = (await response.json().catch(() => null)) as { gig?: Gig } | null;

    if (response.ok && payload?.gig) {
      setRegisterGigs((current) =>
        current.map((item) => (item.id === gigId ? payload.gig ?? item : item)),
      );
    } else {
      router.refresh();
    }

    setSavingCell((current) => (current === cellKey ? null : current));
  }

  async function persistRegisterProgress(
    gigId: string,
    overviewIndicator: GigOverviewIndicator,
  ) {
    const cellKey = `${gigId}:overviewIndicator`;

    setRegisterGigs((current) =>
      current.map((gig) => (gig.id === gigId ? { ...gig, overviewIndicator } : gig)),
    );
    setSavingCell(cellKey);

    const response = await fetch(`/api/gigs/${gigId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ overviewIndicator }),
    });

    const payload = (await response.json().catch(() => null)) as { gig?: Gig } | null;

    if (response.ok && payload?.gig) {
      setRegisterGigs((current) =>
        current.map((item) => (item.id === gigId ? payload.gig ?? item : item)),
      );
    } else {
      router.refresh();
    }

    setSavingCell((current) => (current === cellKey ? null : current));
  }

  function openGig(gigId: string) {
    router.push(`/gigs/${gigId}`);
  }

  return (
    <section
      className={`card gig-register-shell ${resizingColumn ? "resizing" : ""}`}
      style={gigRegisterGridStyle}
    >
      <div className="gig-register-toolbar">
        <div className="gig-register-copy">
          <h1>Gig register</h1>
          <p className="muted">Filter and open gigs</p>
        </div>

        <div className="gig-register-toolbar-actions">
          {canCreateGig ? (
            <Link href="/gigs/new" className="button gig-register-new-button">
              New Gig
            </Link>
          ) : null}
        </div>
      </div>

      <div className="segmented-row gig-register-mode-row" aria-label="Gig register mode">
        <button
          type="button"
          className={`segment-chip segment-chip-soft ${viewMode === "active" ? "active" : ""}`}
          onClick={() => setViewMode("active")}
        >
          Active gigs
        </button>
        <button
          type="button"
          className={`segment-chip segment-chip-soft ${viewMode === "toBeClosed" ? "active" : ""}`}
          onClick={() => setViewMode("toBeClosed")}
        >
          To be closed
        </button>
        <button
          type="button"
          className={`segment-chip segment-chip-soft ${viewMode === "closed" ? "active" : ""}`}
          onClick={() => setViewMode("closed")}
        >
          Closed gigs
        </button>
        <button
          type="button"
          className={`segment-chip segment-chip-soft ${viewMode === "archived" ? "active" : ""}`}
          onClick={() => setViewMode("archived")}
        >
          Archived
        </button>
      </div>

      <div className="gig-register-table-shell">
        <div className="gig-register-table-head">
          <div className="gig-register-head-cell gig-register-head-cell-date">
            <span className="gig-register-head-label">DATE</span>
            <button
              type="button"
              className={`gig-register-date-filter-trigger ${
                dateFilterMode !== "all" ? "active" : ""
              }`}
              onClick={() => setShowDateFilter((current) => !current)}
            >
              {getDateFilterSummary(
                dateFilterMode,
                dateRangeStart,
                dateRangeEnd,
                dateMonth,
              )}
            </button>

            {showDateFilter ? (
              <div className="gig-register-date-filter-panel">
                <div className="gig-register-date-filter-modes">
                  <button
                    type="button"
                    className={dateFilterMode === "all" ? "active" : ""}
                    onClick={() => setDateMode("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={dateFilterMode === "range" ? "active" : ""}
                    onClick={() => setDateMode("range")}
                  >
                    Between dates
                  </button>
                  <button
                    type="button"
                    className={dateFilterMode === "month" ? "active" : ""}
                    onClick={() => setDateMode("month")}
                  >
                    By month
                  </button>
                </div>

                {dateFilterMode === "range" ? (
                  <div className="gig-register-date-filter-fields">
                    <label className="gig-register-date-filter-field">
                      <span>From</span>
                      <input
                        type="date"
                        value={dateRangeStart}
                        onChange={(event) => setDateRangeStart(event.currentTarget.value)}
                      />
                    </label>
                    <label className="gig-register-date-filter-field">
                      <span>To</span>
                      <input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(event) => setDateRangeEnd(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                ) : null}

                {dateFilterMode === "month" ? (
                  <label className="gig-register-date-filter-field">
                    <span>Month</span>
                    <select
                      value={dateMonth}
                      onChange={(event) => setDateMonth(event.currentTarget.value)}
                    >
                      <option value="">All months</option>
                      {dateMonthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="gig-register-date-filter-actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => {
                      setDateMode("all");
                      setShowDateFilter(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className={`gig-register-column-resizer ${
                resizingColumn === registerDateColumn.key ? "active" : ""
              }`}
              aria-label="Resize DATE column"
              title="Drag to resize. Double-click to reset."
              onPointerDown={(event) => startColumnResize(registerDateColumn.key, event)}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resetColumnWidth(registerDateColumn.key);
              }}
            />
          </div>

          {registerColumns.map((column) => (
            <div key={column.key} className="gig-register-head-cell">
              <label className="gig-register-head-filter-field">
                <span className="gig-register-head-label">{column.label}</span>
                <select
                  className="gig-register-head-filter"
                  value={columnFilters[column.key]}
                  onChange={(event) =>
                    updateColumnFilter(
                      column.key,
                      event.currentTarget.value as RegisterColumnFilterValue,
                    )
                  }
                >
                  <option value="">{column.allLabel}</option>
                  {getFilterOptions(scopedGigs, column.key).map((option) => (
                    <option key={`${column.key}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`gig-register-column-resizer ${
                  resizingColumn === column.key ? "active" : ""
                }`}
                aria-label={`Resize ${column.label} column`}
                title="Drag to resize. Double-click to reset."
                onPointerDown={(event) => startColumnResize(column.key, event)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resetColumnWidth(column.key);
                }}
              />
            </div>
          ))}
        </div>

        <div className="gig-register-list">
          {filteredGigs.length === 0 ? (
            <div className="empty-panel">No gigs match the current filters.</div>
          ) : (
            filteredGigs.map((gig) => {
              const marker = resolveGigOverviewIndicator(gig);

              return (
                <article
                  key={gig.id}
                  className={`gig-register-row marker-${marker}`}
                  aria-label={`Open ${gig.artist}`}
                  role="link"
                  data-text-edit-exclude="true"
                  tabIndex={0}
                  onClick={() => openGig(gig.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openGig(gig.id);
                    }
                  }}
                >
                  <span className="gig-register-cell gig-register-date" title={gig.date}>
                    {formatGigRegisterDate(gig.date)}
                  </span>
                  <div className="gig-register-cell gig-register-artist-cell">
                    <strong>{gig.artist}</strong>
                  </div>
                  <span className="gig-register-cell" title={gig.arena}>
                    {gig.arena}
                  </span>
                  <span className="gig-register-cell" title={getOrtLabel(gig) || "No city"}>
                    {getOrtLabel(gig)}
                  </span>
                  <span className="gig-register-cell" title={gig.country || "No country"}>
                    {gig.country || "-"}
                  </span>
                  <span className="gig-register-cell" title={gig.promoter || "No promoter"}>
                    {gig.promoter || "-"}
                  </span>
                  {(
                    [
                      ["merchCompany", "No merch company"],
                      ["merchRepresentative", "No merch representative"],
                      ["scmRepresentative", "No SCM representative"],
                      ["projectManager", "No project manager"],
                    ] as const satisfies readonly [EditableRegisterField, string][]
                  ).map(([field, fallbackLabel]) => {
                    const cellKey = `${gig.id}:${field}`;

                    return (
                      <span key={field} className="gig-register-cell">
                        <input
                          type="text"
                          className={`gig-register-inline-input ${
                            savingCell === cellKey ? "saving" : ""
                          }`}
                          value={gig[field] ?? ""}
                          placeholder="-"
                          aria-label={fallbackLabel}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateRegisterField(gig.id, field, event.currentTarget.value)
                          }
                          onBlur={() => {
                            void persistRegisterField(gig.id, field);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();

                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </span>
                    );
                  })}
                  <span className={`gig-register-cell gig-register-progress-cell ${marker}`}>
                    <select
                      className={`gig-register-inline-select gig-register-progress-select ${marker} ${
                        savingCell === `${gig.id}:overviewIndicator` ? "saving" : ""
                      }`}
                      value={marker}
                      aria-label="Overview marker"
                      onClick={(event) => event.stopPropagation()}
                      onFocus={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        void persistRegisterProgress(
                          gig.id,
                          event.currentTarget.value as GigOverviewIndicator,
                        );
                      }}
                    >
                      {progressOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
