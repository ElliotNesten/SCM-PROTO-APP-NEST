"use client";

import { useMemo, useState } from "react";

import type {
  StoredStaffDocument,
  StaffStoredDocumentTab,
} from "@/types/staff-documents";

const documentTabs: Array<{
  id: StaffStoredDocumentTab;
  label: string;
}> = [
  { id: "employmentContracts", label: "Employment Contracts" },
  { id: "timeReports", label: "Time Reports" },
];

function formatGigDate(value: string) {
  const parsedDate = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(parsedDate);
}

function matchesDocumentQuery(document: StoredStaffDocument, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const formattedDate = formatGigDate(document.gigDate).toLowerCase();

  return (
    document.gigName.toLowerCase().includes(normalizedQuery) ||
    document.gigDate.toLowerCase().includes(normalizedQuery) ||
    formattedDate.includes(normalizedQuery)
  );
}

export function StaffDocumentsPanel({
  personId,
  initialDocuments,
}: {
  personId: string;
  initialDocuments: StoredStaffDocument[];
}) {
  const [activeTab, setActiveTab] =
    useState<StaffStoredDocumentTab>("employmentContracts");
  const [query, setQuery] = useState("");

  const visibleDocuments = useMemo(
    () =>
      initialDocuments.filter(
        (document) =>
          document.tab === activeTab && matchesDocumentQuery(document, query),
      ),
    [activeTab, initialDocuments, query],
  );

  const hasAnyDocuments = initialDocuments.length > 0;

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Documents</p>
          <h2>Stored files</h2>
        </div>
      </div>

      <div className="staff-documents-panel">
        <div className="staff-documents-toolbar">
          <label className="staff-documents-search">
            <span className="sr-only">Search documents</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search gigs or dates"
            />
          </label>

          <div className="staff-documents-tabs" role="tablist" aria-label="Document tabs">
            {documentTabs.map((tab) => {
              const tabCount = initialDocuments.filter(
                (document) => document.tab === tab.id,
              ).length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`staff-documents-tab${
                    activeTab === tab.id ? " active" : ""
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                >
                  {tab.label}
                  <span>{tabCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        {visibleDocuments.length === 0 ? (
          <div className="empty-panel">
            {hasAnyDocuments ? "No documents match this search." : "No documents available yet"}
          </div>
        ) : (
          <div className="staff-documents-table">
            <div className="staff-documents-table-head">
              <span>Gig</span>
              <span>Date</span>
              <span>Shift</span>
              <span>Download</span>
            </div>

            <div className="staff-documents-table-body">
              {visibleDocuments.map((document) => (
                <div key={document.id} className="staff-documents-row">
                  <div className="staff-documents-cell">
                    <strong>{document.gigName}</strong>
                    <p className="muted">{document.documentKind}</p>
                  </div>
                  <div className="staff-documents-cell">
                    <strong>{formatGigDate(document.gigDate)}</strong>
                    <p className="muted">{document.gigDate}</p>
                  </div>
                  <div className="staff-documents-cell">
                    <strong>{document.shiftRole}</strong>
                    <p className="muted">PDF ready</p>
                  </div>
                  <div className="staff-documents-cell staff-documents-download-cell">
                    <a
                      className="button ghost"
                      href={`/api/staff/${personId}/documents/${document.id}`}
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
