import { StaffAppGuidePdfLink } from "@/components/staff-app/guide-pdf-link";
import type { StaffAppGuideEntry } from "@/lib/staff-app-guides";
import {
  getStaffAppScmInfoPdfButtonLabel,
  type StaffAppScmInfoPdfAsset,
} from "@/lib/system-scm-info-pdf-shared";

function StaffAppGuideChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export function StaffAppGuideDisclosureList({
  items,
  itemPdfs,
}: {
  items: StaffAppGuideEntry[];
  itemPdfs?: Array<StaffAppScmInfoPdfAsset[] | undefined>;
}) {
  return (
    <div className="staff-app-guide-list">
      {items.map((item, index) => {
        const visiblePdfs = (itemPdfs?.[index] ?? []).filter((pdf) => pdf.pdfUrl);

        return (
          <details key={`${item.title}-${index}`} className="staff-app-guide-detail">
            <summary className="staff-app-guide-summary">
              <div className="staff-app-guide-summary-copy">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
              <div className="staff-app-guide-summary-actions">
                {visiblePdfs.length > 0 ? (
                  <span className="staff-app-guide-summary-badge">
                    {visiblePdfs.length} PDF{visiblePdfs.length > 1 ? "s" : ""}
                  </span>
                ) : null}
                <span className="staff-app-guide-summary-icon" aria-hidden="true">
                  <StaffAppGuideChevron />
                </span>
              </div>
            </summary>
            <div className="staff-app-guide-panel">
              <p>{item.body}</p>
              {visiblePdfs.length > 0 ? (
                <div className="staff-app-guide-panel-actions">
                  {visiblePdfs.map((pdf, pdfIndex) => (
                    <StaffAppGuidePdfLink
                      key={`${item.title}-${index}-pdf-${pdfIndex}`}
                      href={pdf.pdfUrl}
                      label={getStaffAppScmInfoPdfButtonLabel(pdf, `Open PDF ${pdfIndex + 1}`)}
                      className="staff-app-guide-panel-action"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
