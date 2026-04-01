"use client";

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SystemSettingsWorkspaceSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  keywords: string[];
  content: ReactNode;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 4a6.5 6.5 0 1 0 4.02 11.61l4.44 4.45 1.06-1.06-4.45-4.44A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={
        open
          ? "system-settings-hub-chevron open"
          : "system-settings-hub-chevron"
      }
    >
      <path
        d="m5 7 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function matchesSection(section: SystemSettingsWorkspaceSection, query: string) {
  if (!query) {
    return true;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  const haystack = normalizeSearchText(
    [
      section.eyebrow,
      section.title,
      section.description,
      section.summary,
      section.keywords.join(" "),
    ].join(" "),
  );

  return tokens.every((token) => haystack.includes(token));
}

export function SystemSettingsWorkspace({
  sections,
}: {
  sections: SystemSettingsWorkspaceSection[];
}) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [query, setQuery] = useState("");
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = useMemo(
    () => normalizeSearchText(deferredQuery),
    [deferredQuery],
  );
  const visibleSections = useMemo(
    () => sections.filter((section) => matchesSection(section, normalizedQuery)),
    [sections, normalizedQuery],
  );
  const visibleSectionIds = useMemo(
    () => visibleSections.map((section) => section.id),
    [visibleSections],
  );
  const hasQuery = normalizedQuery.length > 0;
  const expandedVisibleCount = visibleSectionIds.filter((sectionId) =>
    expandedSectionIds.includes(sectionId),
  ).length;

  function registerSectionRef(sectionId: string, element: HTMLElement | null) {
    sectionRefs.current[sectionId] = element;
  }

  function scrollToSection(sectionId: string) {
    const sectionElement = sectionRefs.current[sectionId];

    if (!sectionElement) {
      return;
    }

    sectionElement.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function expandSection(sectionId: string) {
    setExpandedSectionIds((currentIds) => {
      if (currentIds.includes(sectionId)) {
        return currentIds;
      }

      return [...currentIds, sectionId];
    });
  }

  function handleOverviewClick(sectionId: string) {
    expandSection(sectionId);
    requestAnimationFrame(() => {
      scrollToSection(sectionId);
    });
  }

  function toggleSection(sectionId: string) {
    if (hasQuery) {
      scrollToSection(sectionId);
      return;
    }

    setExpandedSectionIds((currentIds) =>
      currentIds.includes(sectionId)
        ? currentIds.filter((currentId) => currentId !== sectionId)
        : [...currentIds, sectionId],
    );
  }

  function expandVisibleSections() {
    setExpandedSectionIds((currentIds) =>
      Array.from(new Set([...currentIds, ...visibleSectionIds])),
    );
  }

  function collapseAllSections() {
    setExpandedSectionIds([]);
  }

  return (
    <div className="system-settings-workspace">
      <section className="card system-settings-command-card">
        <div className="system-settings-command-copy">
          <p className="eyebrow">SETTINGS OVERVIEW</p>
          <h2>Find the exact change faster</h2>
          <p>
            Search by wage, policy, email, arena, template, guide, or text copy.
            Open only the section you need and keep the rest compact.
          </p>
        </div>

        <div className="system-settings-command-row">
          <label className="system-settings-search-shell">
            <span className="system-settings-search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              placeholder="Search settings: wage, policy, email, arena, template..."
              aria-label="Search system settings"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>

          <div className="system-settings-command-actions">
            <button
              type="button"
              className="button ghost"
              onClick={() => setQuery("")}
              disabled={query.trim().length === 0}
            >
              Clear search
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={collapseAllSections}
              disabled={expandedSectionIds.length === 0 || hasQuery}
            >
              Collapse all
            </button>
            <button
              type="button"
              className="button"
              onClick={expandVisibleSections}
              disabled={
                visibleSections.length === 0 ||
                (!hasQuery && expandedVisibleCount === visibleSections.length)
              }
            >
              Expand visible
            </button>
          </div>
        </div>

        <div className="system-settings-command-foot">
          <span className="helper-caption">
            {hasQuery
              ? `${visibleSections.length} of ${sections.length} settings sections match "${query.trim()}".`
              : `Showing ${sections.length} settings areas on one overview page.`}
          </span>
        </div>
      </section>

      {visibleSections.length === 0 ? (
        <section className="card system-settings-no-results">
          <div className="system-settings-command-copy">
            <h2>No matching settings found</h2>
            <p>
              Try words like policy, hourly rate, template, guide, arena, or email.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="system-settings-overview-grid">
            {visibleSections.map((section) => {
              const isExpanded = hasQuery || expandedSectionIds.includes(section.id);

              return (
                <button
                  key={section.id}
                  type="button"
                  className={
                    isExpanded
                      ? "system-settings-overview-card active"
                      : "system-settings-overview-card"
                  }
                  onClick={() => handleOverviewClick(section.id)}
                >
                  <span className="system-settings-overview-eyebrow">
                    {section.eyebrow}
                  </span>
                  <strong>{section.title}</strong>
                  <p>{section.summary}</p>
                  <div className="system-settings-overview-keywords">
                    {section.keywords.slice(0, 3).map((keyword) => (
                      <span
                        key={`${section.id}-${keyword}`}
                        className="system-settings-overview-chip"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="system-settings-section-list">
            {visibleSections.map((section) => {
              const isExpanded = hasQuery || expandedSectionIds.includes(section.id);

              return (
                <section
                  key={section.id}
                  id={`system-settings-${section.id}`}
                  ref={(element) => registerSectionRef(section.id, element)}
                  className={
                    isExpanded
                      ? "system-settings-hub-section open"
                      : "system-settings-hub-section"
                  }
                >
                  <button
                    type="button"
                    className={
                      isExpanded
                        ? "system-settings-hub-section-toggle open"
                        : "system-settings-hub-section-toggle"
                    }
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="system-settings-hub-section-copy">
                      <small>{section.eyebrow}</small>
                      <strong>{section.title}</strong>
                      <span>{section.description}</span>
                    </span>

                    <span className="system-settings-hub-section-meta">
                      <span className="system-settings-hub-summary-pill">
                        {section.summary}
                      </span>
                      <SectionChevron open={isExpanded} />
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="system-settings-hub-section-body">
                      {section.content}
                    </div>
                  ) : (
                    <div className="system-settings-hub-section-keywords">
                      {section.keywords.map((keyword) => (
                        <span
                          key={`${section.id}-keyword-${keyword}`}
                          className="system-settings-overview-chip"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
