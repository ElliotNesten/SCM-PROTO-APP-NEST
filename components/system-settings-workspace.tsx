"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 5 15 15M15 5 5 15"
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
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = useMemo(
    () => normalizeSearchText(deferredQuery),
    [deferredQuery],
  );
  const visibleSections = useMemo(
    () => sections.filter((section) => matchesSection(section, normalizedQuery)),
    [sections, normalizedQuery],
  );
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId, sections],
  );
  const hasQuery = normalizedQuery.length > 0;

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveSectionId(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSection]);

  function openSection(sectionId: string) {
    setActiveSectionId(sectionId);
  }

  function closeSection() {
    setActiveSectionId(null);
  }

  function openFirstVisibleSection() {
    if (!visibleSections[0]) {
      return;
    }

    setActiveSectionId(visibleSections[0].id);
  }

  return (
    <div className="system-settings-workspace">
      <section className="card system-settings-command-card">
        <div className="system-settings-command-copy">
          <p className="eyebrow">SETTINGS OVERVIEW</p>
          <h2>Find the exact change faster</h2>
          <p>
            Search by wage, policy, email, arena, template, guide, or text copy.
            Open the setting you need in a focused popup window.
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
              className="button"
              onClick={openFirstVisibleSection}
              disabled={visibleSections.length === 0}
            >
              {hasQuery ? "Open first match" : "Open first card"}
            </button>
          </div>
        </div>

        <div className="system-settings-command-foot">
          <span className="helper-caption">
            {hasQuery
              ? `${visibleSections.length} of ${sections.length} settings sections match "${query.trim()}".`
              : `Showing ${sections.length} settings areas on one overview page.`}
          </span>
          <span className="helper-caption">
            Click <code>Open settings</code> to edit inside a popup window.
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
        <div className="system-settings-overview-grid">
          {visibleSections.map((section) => {
            const isActive = activeSection?.id === section.id;

            return (
              <article
                key={section.id}
                className={
                  isActive
                    ? "system-settings-overview-card active"
                    : "system-settings-overview-card"
                }
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
                <div className="system-settings-overview-card-foot">
                  <span className="system-settings-hub-summary-pill">Opens in popup</span>
                  <button
                    type="button"
                    className={
                      isActive
                        ? "system-settings-open-button active"
                        : "system-settings-open-button"
                    }
                    onClick={() => openSection(section.id)}
                  >
                    Open settings
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeSection ? (
        <div
          className="system-settings-modal-backdrop"
          role="presentation"
          onClick={closeSection}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`system-settings-modal-title-${activeSection.id}`}
            className="system-settings-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-settings-modal-shell">
              <div className="system-settings-modal-header">
                <div className="system-settings-modal-copy">
                  <p className="eyebrow">{activeSection.eyebrow}</p>
                  <h2 id={`system-settings-modal-title-${activeSection.id}`}>
                    {activeSection.title}
                  </h2>
                  <p>{activeSection.description}</p>
                </div>

                <div className="system-settings-modal-actions">
                  <span className="system-settings-hub-summary-pill">
                    {activeSection.summary}
                  </span>
                  <button
                    type="button"
                    className="system-settings-modal-close"
                    onClick={closeSection}
                    aria-label={`Close ${activeSection.title}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="system-settings-modal-keywords">
                {activeSection.keywords.map((keyword) => (
                  <span
                    key={`${activeSection.id}-modal-${keyword}`}
                    className="system-settings-overview-chip"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              <div className="system-settings-modal-body">{activeSection.content}</div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
