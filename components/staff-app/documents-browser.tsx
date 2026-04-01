"use client";

import { useState } from "react";

import type { StaffAppDocumentLink } from "@/types/staff-app";

type StaffAppDocumentTab = "employmentContracts" | "timeReports";

function formatDocumentDate(value: string) {
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

function matchesDocumentQuery(document: StaffAppDocumentLink, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const formattedDate = formatDocumentDate(document.date).toLowerCase();

  return (
    document.title.toLowerCase().includes(normalizedQuery) ||
    document.date.toLowerCase().includes(normalizedQuery) ||
    formattedDate.includes(normalizedQuery)
  );
}

export function StaffAppDocumentsBrowser({
  employmentContracts,
  timeReports,
}: {
  employmentContracts: StaffAppDocumentLink[];
  timeReports: StaffAppDocumentLink[];
}) {
  const [activeTab, setActiveTab] = useState<StaffAppDocumentTab>("employmentContracts");
  const [query, setQuery] = useState("");

  const allDocuments = {
    employmentContracts,
    timeReports,
  };

  const visibleDocuments = allDocuments[activeTab].filter((document) =>
    matchesDocumentQuery(document, query),
  );
  const hasAnyDocuments = employmentContracts.length > 0 || timeReports.length > 0;

  return (
    <div className="staff-app-card staff-app-documents-card">
      <div className="staff-app-section-head compact">
        <div>
          <p className="staff-app-kicker">Documents</p>
          <h2>Stored files</h2>
        </div>
      </div>

      <div className="staff-app-documents-panel">
        <div className="staff-app-documents-toolbar">
          <label className="staff-app-documents-search">
            <span className="sr-only">Search documents</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search gigs or dates"
            />
          </label>

          <div className="staff-app-documents-tabs" role="tablist" aria-label="Document tabs">
            <button
              type="button"
              className={`staff-app-documents-tab${
                activeTab === "employmentContracts" ? " active" : ""
              }`}
              onClick={() => setActiveTab("employmentContracts")}
              role="tab"
              aria-selected={activeTab === "employmentContracts"}
            >
              Employment Contracts
              <span>{employmentContracts.length}</span>
            </button>
            <button
              type="button"
              className={`staff-app-documents-tab${
                activeTab === "timeReports" ? " active" : ""
              }`}
              onClick={() => setActiveTab("timeReports")}
              role="tab"
              aria-selected={activeTab === "timeReports"}
            >
              Time Reports
              <span>{timeReports.length}</span>
            </button>
          </div>
        </div>

        {visibleDocuments.length === 0 ? (
          <div className="staff-app-empty-state">
            {hasAnyDocuments ? "No documents match this search." : "No documents available yet."}
          </div>
        ) : (
          <div className="staff-app-documents-table">
            <div className="staff-app-documents-table-inner">
              <div className="staff-app-documents-table-head">
                <span>Gig</span>
                <span>Date</span>
                <span>Shift</span>
                <span>Download</span>
              </div>

              <div className="staff-app-documents-table-body">
                {visibleDocuments.map((document) => (
                  <div key={document.id} className="staff-app-documents-row">
                    <div className="staff-app-documents-cell">
                      <span className="staff-app-documents-mobile-label">Gig</span>
                      <strong>{document.title}</strong>
                      <p>{document.kind}</p>
                    </div>
                    <div className="staff-app-documents-cell">
                      <span className="staff-app-documents-mobile-label">Date</span>
                      <strong>{formatDocumentDate(document.date)}</strong>
                      <p>{document.date}</p>
                    </div>
                    <div className="staff-app-documents-cell">
                      <span className="staff-app-documents-mobile-label">Shift</span>
                      <strong>{document.role}</strong>
                      <p>PDF ready</p>
                    </div>
                    <div className="staff-app-documents-cell staff-app-documents-download-cell">
                      <span className="staff-app-documents-mobile-label">Download</span>
                      <a href={document.href} className="staff-app-documents-download">
                        Download PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
